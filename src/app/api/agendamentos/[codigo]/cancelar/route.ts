import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelarRemarcarSchema } from '@/lib/validations'
import { getConfiguracoes } from '@/lib/config'
import { calcularDisponibilidade, validarHorarioDisponivel } from '@/lib/disponibilidade'
import { normalizarCodigo } from '@/lib/codigo'
import { PRAZO_CANCELAMENTO_HORAS, mensagemPrazoCancelamento, respeitaPrazo } from '@/lib/prazos'
import { excluirEvento } from '@/lib/google/agenda'
import { enviarCancelamento, linkGestao, emailConfigurado } from '@/lib/email'

// POST - Cancelar agendamento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params
    const body = await request.json()
    
    const resultado = cancelarRemarcarSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    }

    const { telefone } = resultado.data
    const telefoneLimpo = telefone.replace(/\D/g, '')

    const agendamento = await prisma.agendamento.findUnique({
      where: { codigo: normalizarCodigo(codigo) },
      include: { servico: true },
    })

    if (!agendamento) {
      return NextResponse.json({ erro: 'Agendamento não encontrado' }, { status: 404 })
    }

    if (agendamento.pacienteTelefone.slice(-8) !== telefoneLimpo.slice(-8)) {
      return NextResponse.json({ erro: 'Código ou telefone incorretos' }, { status: 403 })
    }

    if (agendamento.status === 'CANCELADO') {
      return NextResponse.json({ erro: 'Agendamento já cancelado' }, { status: 400 })
    }

    if (agendamento.status === 'CONCLUIDO') {
      return NextResponse.json({ erro: 'Não é possível cancelar consulta já realizada' }, { status: 400 })
    }

    // Verificar antecedência mínima (fonte única: src/lib/prazos.ts)
    const agora = new Date()
    if (!respeitaPrazo(agendamento.dataHora, PRAZO_CANCELAMENTO_HORAS, agora)) {
      return NextResponse.json(
        { erro: mensagemPrazoCancelamento(), codigo: 'PRAZO' },
        { status: 422 }
      )
    }

    // Cancelar
    await prisma.agendamento.update({
      where: { codigo: normalizarCodigo(codigo) },
      data: {
        status: 'CANCELADO',
        canceladoEm: new Date(),
        canceladoPor: 'PACIENTE',
      },
    })

    // Remover o evento do Google Calendar (se a integração criou o evento)
    if (agendamento.googleEventoId) {
      try {
        await excluirEvento(agendamento.googleEventoId)
      } catch (erroGoogle) {
        console.error('[Google Calendar] Falha ao excluir evento:', erroGoogle)
      }
    }

    // E-mail de cancelamento para o paciente (fallback silencioso)
    if (emailConfigurado() && agendamento.pacienteEmail) {
      try {
        const cfg = await getConfiguracoes()
        await enviarCancelamento({
          codigo: agendamento.codigo,
          pacienteNome: agendamento.pacienteNome,
          pacienteEmail: agendamento.pacienteEmail,
          servicoNome: agendamento.servico.nome,
          dataHora: agendamento.dataHora,
          duracaoMin: agendamento.duracaoMin,
          dentistaNome: cfg.dentistaNome,
          clinicaNome: cfg.clinicaNome,
          clinicaTelefone: cfg.clinicaTelefone || '',
          linkGestao: linkGestao(agendamento.codigo),
        })
      } catch (erroEmail) {
        console.error('[E-mail] Falha ao enviar cancelamento:', erroEmail)
      }
    }

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: 'Agendamento cancelado com sucesso' 
    })
  } catch (error) {
    console.error('Erro ao cancelar:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}