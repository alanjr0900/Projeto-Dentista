import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { agendamentoCompletoSchema } from '@/lib/validations'
import { calcularDisponibilidade, validarHorarioDisponivel } from '@/lib/disponibilidade'
import { getConfiguracoes } from '@/lib/config'
import { gerarCodigoAgendamento } from '@/lib/utils'
import { verificarRateLimit } from '@/lib/utils'
import { auth } from '@/lib/auth'
import { googleAtivo, horarioLivre, criarEvento } from '@/lib/google/agenda'
import { enviarConfirmacao, linkGestao, emailConfigurado } from '@/lib/email'
import { gerarArquivoICS, gerarNomeArquivoICS } from '@/lib/ics'

// GET - Listar agendamentos (para admin) ou verificar disponibilidade
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const servicoId = searchParams.get('servicoId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')
  const dias = searchParams.get('dias')

  // Se for consulta de disponibilidade
  if (servicoId && (dataInicio || dias)) {
    try {
      const inicio = dataInicio ? new Date(dataInicio) : new Date()
      const fim = dataFim ? new Date(dataFim) : new Date(inicio.getTime() + (parseInt(dias || '30') * 24 * 60 * 60 * 1000))
      
      const disponibilidade = await calcularDisponibilidade(inicio, fim, servicoId)
      
      // Para o calendário, retornar apenas datas com disponibilidade
      const diasComDisponibilidade = disponibilidade.dias
        .filter(d => d.temDisponibilidade)
        .map(d => d.data)

      return NextResponse.json({
        dias: disponibilidade.dias,
        diasComDisponibilidade,
        servicoDuracao: disponibilidade.servicoDuracao,
      })
    } catch (error) {
      return NextResponse.json({ erro: 'Erro ao calcular disponibilidade' }, { status: 500 })
    }
  }

  // Listar agendamentos (somente admin autenticado)
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado. Faça login na área administrativa.' }, { status: 401 })
  }

  const agendamentos = await prisma.agendamento.findMany({
    include: { servico: true },
    orderBy: { dataHora: 'asc' },
    take: 300,
  })
  return NextResponse.json({ agendamentos })
}

// POST - Criar novo agendamento
export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const cfg = await getConfiguracoes()
    const rateLimit = verificarRateLimit(ip, cfg.limiteAgendamentosIpHora, 60 * 60 * 1000)
    
    if (!rateLimit.permitido) {
      return NextResponse.json(
        { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.resetEm / 1000)) } }
      )
    }

    const body = await request.json()
    
    // Validar entrada
    const resultado = agendamentoCompletoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const dados = resultado.data

    // Verificar honeypot
    if (dados.website) {
      return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 })
    }

    // Verificar disponibilidade do horário
    const validacao = await validarHorarioDisponivel(dados.servicoId, dados.data, dados.horario)
    if (!validacao.disponivel) {
      return NextResponse.json({ erro: validacao.motivo || 'Horário não disponível' }, { status: 409 })
    }

    // Buscar serviço para duração
    const servico = await prisma.servico.findUnique({ where: { id: dados.servicoId } })
    if (!servico || !servico.ativo) {
      return NextResponse.json({ erro: 'Serviço não encontrado' }, { status: 404 })
    }

    // Criar agendamento em transação para evitar race condition
    const codigo = gerarCodigoAgendamento()
    
    const agendamento = await prisma.$transaction(async (tx) => {
      // Verificar novamente dentro da transação (double-check)
      const conflito = await tx.agendamento.findFirst({
        where: {
          dataHora: new Date(`${dados.data}T${dados.horario}:00-03:00`),
          status: { notIn: ['CANCELADO', 'FALTA'] },
        },
      })
      if (conflito) {
        throw new Error('Horário acabou de ser ocupado')
      }

      return tx.agendamento.create({
        data: {
          codigo,
          servicoId: dados.servicoId,
          dataHora: new Date(`${dados.data}T${dados.horario}:00-03:00`),
          duracaoMin: servico.duracaoMin,
          pacienteNome: dados.nome,
          pacienteTelefone: dados.telefone.replace(/\D/g, ''),
          pacienteEmail: dados.email || null,
          observacoes: dados.observacoes || null,
          status: 'PENDENTE',
        },
        include: { servico: true },
      })
    })

    // Atualizar/criar paciente
    await prisma.paciente.upsert({
      where: { telefone: dados.telefone.replace(/\D/g, '') },
      update: {
        nome: dados.nome,
        email: dados.email || null,
      },
      create: {
        nome: dados.nome,
        telefone: dados.telefone.replace(/\D/g, ''),
        email: dados.email || null,
      },
    })

    // ---- Integração Google Calendar (fonte dos horários livres) ----
    // Falha do Google NUNCA derruba o agendamento: o banco é o piso de proteção.
    if (googleAtivo()) {
      try {
        const inicio = new Date(`${dados.data}T${dados.horario}:00-03:00`)
        const fim = new Date(inicio.getTime() + servico.duracaoMin * 60 * 1000)

        // Double-check final: entre a validação e a gravação alguém pode ter
        // ocupado o horário diretamente no calendário da doutora.
        const check = await horarioLivre(inicio, fim)
        if (!check.livre) {
          // Remove o registro recém-criado para não travar o horário no painel
          await prisma.agendamento.delete({ where: { codigo } }).catch(() => undefined)
          return NextResponse.json({ erro: check.motivo || 'Horário não disponível' }, { status: 409 })
        }

        // Cria o evento com nome/telefone/e-mail/motivo e devolve o ID dele.
        // requestId garante idempotência (mesma consulta não duplica evento).
        const eventoId = await criarEvento({
          codigo,
          pacienteNome: dados.nome,
          pacienteTelefone: dados.telefone,
          pacienteEmail: dados.email || null,
          servicoNome: servico.nome,
          dentistaNome: cfg.dentistaNome,
          inicio,
          fim,
          observacoes: dados.observacoes || null,
        })

        await prisma.agendamento.update({
          where: { codigo },
          data: { googleEventoId: eventoId },
        })
      } catch (erroGoogle) {
        // Agenda do banco continua valendo; o painel mostra o agendamento.
        console.error('[Google Calendar] Falha ao criar evento (agendamento mantido no banco):', erroGoogle)
      }
    }

    // ---- E-mail de confirmação para o paciente (com convite .ics anexado) ----
    if (emailConfigurado() && dados.email) {
      try {
        const ics = await gerarArquivoICS({
          codigo,
          servicoNome: servico.nome,
          dataHora: new Date(`${dados.data}T${dados.horario}:00-03:00`),
          duracaoMin: servico.duracaoMin,
          endereco: cfg.clinicaEndereco || '',
          clinicaNome: cfg.clinicaNome,
          dentistaNome: cfg.dentistaNome,
          telefone: cfg.clinicaTelefone || '',
        })
        await enviarConfirmacao({
          codigo,
          pacienteNome: dados.nome,
          pacienteEmail: dados.email,
          servicoNome: servico.nome,
          dataHora: new Date(`${dados.data}T${dados.horario}:00-03:00`),
          duracaoMin: servico.duracaoMin,
          dentistaNome: cfg.dentistaNome,
          clinicaNome: cfg.clinicaNome,
          clinicaTelefone: cfg.clinicaTelefone || '',
          linkGestao: linkGestao(codigo),
          ics,
          nomeArquivoIcs: gerarNomeArquivoICS(codigo),
        })
      } catch (erroEmail) {
        console.error('[E-mail] Falha ao enviar confirmação:', erroEmail)
      }
    }

    return NextResponse.json({
      sucesso: true,
      codigo: agendamento.codigo,
      dataHora: agendamento.dataHora.toISOString(),
      servicoNome: agendamento.servico.nome,
      endereco: (await getConfiguracoes()).clinicaEndereco,
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar agendamento:', error)
    if (error instanceof Error && error.message === 'Horário acabou de ser ocupado') {
      return NextResponse.json({ erro: 'Este horário acabou de ser ocupado. Escolha outro.' }, { status: 409 })
    }
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}