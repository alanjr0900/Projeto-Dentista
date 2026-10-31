import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelarRemarcarSchema } from '@/lib/validations'
import { getConfiguracoes } from '@/lib/config'
import { validarHorarioDisponivel, calcularDisponibilidade } from '@/lib/disponibilidade'
import { normalizarCodigo } from '@/lib/codigo'
import { PRAZO_REAGENDAMENTO_HORAS, mensagemPrazoReagendamento, respeitaPrazo } from '@/lib/prazos'
import { googleAtivo, horarioLivre, moverEvento, criarEvento, type DadosEventoConsulta } from '@/lib/google/agenda'
import { enviarRemarcacao, linkGestao, emailConfigurado } from '@/lib/email'
import { gerarArquivoICS, gerarNomeArquivoICS } from '@/lib/ics'

// POST - Remarcar agendamento
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

    const { telefone, novaData, novoHorario, novoServicoId } = resultado.data
    const telefoneLimpo = telefone.replace(/\D/g, '')

    // Verificar se é remarcação (tem novos dados)
    const ehRemarcacao = novaData && novoHorario && novoServicoId
    if (!ehRemarcacao) {
      return NextResponse.json({ erro: 'Para remarcar, informe nova data, horário e serviço' }, { status: 400 })
    }

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
      return NextResponse.json({ erro: 'Agendamento cancelado não pode ser remarcado' }, { status: 400 })
    }

    if (agendamento.status === 'CONCLUIDO') {
      return NextResponse.json({ erro: 'Consulta já realizada não pode ser remarcada' }, { status: 400 })
    }

    // Verificar antecedência mínima para o agendamento ORIGINAL
    // (fonte única dos prazos: src/lib/prazos.ts)
    const cfg = await getConfiguracoes()
    const agora = new Date()

    if (!respeitaPrazo(agendamento.dataHora, PRAZO_REAGENDAMENTO_HORAS, agora)) {
      return NextResponse.json(
        { erro: mensagemPrazoReagendamento(), codigo: 'PRAZO' },
        { status: 422 }
      )
    }

    // Verificar disponibilidade do NOVO horário
    const validacao = await validarHorarioDisponivel(novoServicoId, novaData, novoHorario)
    if (!validacao.disponivel) {
      return NextResponse.json({ erro: validacao.motivo || 'Novo horário não disponível' }, { status: 409 })
    }

    // Buscar novo serviço
    const novoServico = await prisma.servico.findUnique({ where: { id: novoServicoId } })
    if (!novoServico || !novoServico.ativo) {
      return NextResponse.json({ erro: 'Novo serviço não encontrado' }, { status: 404 })
    }

    // Double-check no Google antes de mexer em qualquer coisa
    const novoInicio = new Date(`${novaData}T${novoHorario}:00-03:00`)
    const novoFim = new Date(novoInicio.getTime() + novoServico.duracaoMin * 60 * 1000)

    // O novo horário também precisa respeitar o prazo mínimo de 48h.
    if (!respeitaPrazo(novoInicio, PRAZO_REAGENDAMENTO_HORAS, agora)) {
      return NextResponse.json(
        { erro: mensagemPrazoReagendamento(), codigo: 'PRAZO' },
        { status: 422 }
      )
    }

    if (googleAtivo()) {
      const check = await horarioLivre(novoInicio, novoFim, agendamento.googleEventoId)
      if (!check.livre) {
        return NextResponse.json({ erro: check.motivo || 'Novo horário não disponível' }, { status: 409 })
      }
    }

    // Remarcar em transação
    await prisma.$transaction(async (tx) => {
      // Verificar conflito novamente
      const conflito = await tx.agendamento.findFirst({
        where: {
          dataHora: new Date(`${novaData}T${novoHorario}:00-03:00`),
          status: { notIn: ['CANCELADO', 'FALTA'] },
          NOT: { codigo: normalizarCodigo(codigo) }, // Excluir o próprio agendamento
        },
      })
      if (conflito) {
        throw new Error('Horário acabou de ser ocupado')
      }

      // Atualizar agendamento
      await tx.agendamento.update({
        where: { codigo: normalizarCodigo(codigo) },
        data: {
          servicoId: novoServicoId,
          dataHora: new Date(`${novaData}T${novoHorario}:00-03:00`),
          duracaoMin: novoServico.duracaoMin,
          status: 'REMARCADO',
        },
      })
    })

    // Dados do evento (novo horário/serviço) reutilizados pelo Google e pelo e-mail
    const dadosEvento: DadosEventoConsulta = {
      codigo: agendamento.codigo,
      pacienteNome: agendamento.pacienteNome,
      pacienteTelefone: agendamento.pacienteTelefone,
      pacienteEmail: agendamento.pacienteEmail,
      servicoNome: novoServico.nome,
      dentistaNome: cfg.dentistaNome,
      inicio: novoInicio,
      fim: novoFim,
      observacoes: agendamento.observacoes,
    }

    // ---- Google Calendar: mover o evento existente ou criar (fallback antigo) ----
    if (googleAtivo()) {
      try {
        if (agendamento.googleEventoId) {
          await moverEvento(agendamento.googleEventoId, dadosEvento)
        } else {
          // Agendamento anterior a integração: cria o evento agora e vincula
          const eventoId = await criarEvento(dadosEvento)
          await prisma.agendamento.update({
            where: { codigo: normalizarCodigo(codigo) },
            data: { googleEventoId: eventoId },
          })
        }
      } catch (erroGoogle) {
        console.error('[Google Calendar] Falha ao sincronizar evento (remarcado no banco):', erroGoogle)
      }
    }

    // ---- E-mail de remarcação com convite atualizado (.ics) ----
    if (emailConfigurado() && agendamento.pacienteEmail) {
      try {
        const ics = await gerarArquivoICS({
          codigo: agendamento.codigo,
          servicoNome: novoServico.nome,
          dataHora: novoInicio,
          duracaoMin: novoServico.duracaoMin,
          endereco: cfg.clinicaEndereco || '',
          clinicaNome: cfg.clinicaNome,
          dentistaNome: cfg.dentistaNome,
          telefone: cfg.clinicaTelefone || '',
        })
        await enviarRemarcacao({
          codigo: agendamento.codigo,
          pacienteNome: agendamento.pacienteNome,
          pacienteEmail: agendamento.pacienteEmail,
          servicoNome: novoServico.nome,
          dataHora: novoInicio,
          duracaoMin: novoServico.duracaoMin,
          dentistaNome: cfg.dentistaNome,
          clinicaNome: cfg.clinicaNome,
          clinicaTelefone: cfg.clinicaTelefone || '',
          linkGestao: linkGestao(agendamento.codigo),
          ics,
          nomeArquivoIcs: gerarNomeArquivoICS(agendamento.codigo),
        }, agendamento.dataHora)
      } catch (erroEmail) {
        console.error('[E-mail] Falha ao enviar remarcação:', erroEmail)
      }
    }

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: 'Agendamento remarcado com sucesso',
      novaDataHora: `${novaData}T${novoHorario}:00`,
      novoServico: novoServico.nome,
    })
  } catch (error) {
    console.error('Erro ao remarcar:', error)
    if (error instanceof Error && error.message === 'Horário acabou de ser ocupado') {
      return NextResponse.json({ erro: 'Este horário acabou de ser ocupado. Escolha outro.' }, { status: 409 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
