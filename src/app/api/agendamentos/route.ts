import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { agendamentoCompletoSchema } from '@/lib/validations'
import { calcularDisponibilidade, validarHorarioDisponivel } from '@/lib/disponibilidade'
import { getConfiguracoes } from '@/lib/config'
import { gerarCodigoUnico } from '@/lib/codigo'
import { parseDataNascimento } from '@/lib/data-nascimento'
import { normalizarNomePessoa } from '@/lib/nome-pessoa'
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
    const codigo = await gerarCodigoUnico(async candidato => {
      const existente = await prisma.agendamento.findUnique({
        where: { codigo: candidato },
        select: { id: true },
      })
      return Boolean(existente)
    })

    // Data de nascimento (opcional) — confirmação de identidade em "Minha consulta".
    let dataNascimento: Date | null = null
    if (dados.dataNascimento) {
      dataNascimento = parseDataNascimento(dados.dataNascimento)
      if (!dataNascimento) {
        return NextResponse.json({ erro: 'Data de nascimento inválida' }, { status: 400 })
      }
    }

    // 3.3 — Vincular/criar o paciente ANTES, para ligar o agendamento a ele
    // (histórico da aba Pacientes) e registrar consentimento + 1º agendamento.
    // Regra: se e-mail já existe, só permite agendar se o nome for o mesmo (ignorando maiúsculas, acentos, espaços extras).
    const telefoneDigitos = dados.telefone.replace(/\D/g, '')
    const agora = new Date()
    const datasAgendamento = new Date(`${dados.data}T${dados.horario}:00-03:00`)

    let paciente
    if (dados.email) {
      const emailNormalizado = dados.email.trim().toLowerCase()
      const candidatos = await prisma.paciente.findMany({
        where: { email: { not: null } },
        select: { id: true, nome: true, email: true },
        orderBy: { atualizadoEm: 'desc' },
      })
      const existentesPorEmail = candidatos.filter(
        candidato =>
          candidato.email && candidato.email.trim().toLowerCase() === emailNormalizado
      )

      if (existentesPorEmail.length > 0) {
        // Pode haver cadastros duplicados com o mesmo e-mail (dados antigos).
        // Só permite se ALGUM deles tiver o mesmo nome pela regra do projeto.
        const mesmoNome = existentesPorEmail.find(
          candidato => normalizarNomePessoa(candidato.nome) === normalizarNomePessoa(dados.nome)
        )
        if (!mesmoNome) {
          return NextResponse.json({ 
            erro: 'Este e-mail já está cadastrado com outro nome. Use o mesmo nome ou entre em contato.' 
          }, { status: 409 })
        }
        // Mesmo paciente: atualiza telefone e data de nascimento se vierem
        paciente = await prisma.paciente.update({
          where: { id: mesmoNome.id },
          data: {
            telefone: telefoneDigitos,
            ...(dataNascimento ? { dataNascimento } : {}),
          }
        })
      } else {
        // Novo paciente com este e-mail
        paciente = await prisma.paciente.create({
          data: {
            nome: dados.nome,
            telefone: telefoneDigitos,
            email: emailNormalizado,
            dataNascimento,
            consentimentoEm: agora,
            primeiroAgendamentoEm: datasAgendamento,
          }
        })
      }
    } else {
      // Sem e-mail: usa telefone como chave (comportamento legado)
      paciente = await prisma.paciente.upsert({
        where: { telefone: telefoneDigitos },
        update: {
          nome: dados.nome,
          ...(dataNascimento ? { dataNascimento } : {}),
        },
        create: {
          nome: dados.nome,
          telefone: telefoneDigitos,
          email: null,
          dataNascimento,
          consentimentoEm: agora,
          primeiroAgendamentoEm: datasAgendamento,
        },
      })
    }

    // Preenche o que faltar (paciente antigo criado antes destes campos).
    await prisma.paciente.updateMany({
      where: { id: paciente.id, consentimentoEm: null },
      data: { consentimentoEm: agora },
    })
    await prisma.paciente.updateMany({
      where: { id: paciente.id, primeiroAgendamentoEm: null },
      data: { primeiroAgendamentoEm: datasAgendamento },
    })
    
    const agendamento = await prisma.$transaction(async (tx) => {
      // Verificar novamente dentro da transação (double-check)
      const conflito = await tx.agendamento.findFirst({
        where: {
          dataHora: datasAgendamento,
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
          dataHora: datasAgendamento,
          duracaoMin: servico.duracaoMin,
          pacienteId: paciente.id,
          pacienteNome: dados.nome,
          pacienteTelefone: telefoneDigitos,
          pacienteEmail: dados.email || null,
          observacoes: dados.observacoes || null,
          status: 'PENDENTE',
        },
        include: { servico: true },
      })
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