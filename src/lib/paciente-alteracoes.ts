/**
 * Alterações que o PRÓPRIO paciente pode fazer (remarcar/cancelar).
 *
 * Regras revalidadas no servidor, uma única vez, para os dois fluxos de
 * acesso: código do agendamento (legado) e código por e-mail (OTP).
 */
import { prisma } from './prisma'
import { getConfiguracoes } from './config'
import { slotConflitaComAgendamento, validarHorarioDisponivel } from './disponibilidade'
import {
  googleAtivo,
  horarioLivre,
  moverEvento,
  criarEvento,
  type DadosEventoConsulta,
} from './google/agenda'
import { emailConfigurado, enviarRemarcacao, enviarCancelamento, linkGestao } from './email'
import { gerarArquivoICS, gerarNomeArquivoICS } from './ics'
import { dataHoraDoSlot } from './paciente-consulta'
import { avaliarPrazos, mensagemPrazoCancelamento, type PrazoPaciente } from './paciente-prazos'
import { PRAZO_REAGENDAMENTO_HORAS, mensagemPrazoReagendamento, respeitaPrazo } from './prazos'

export type AgendamentoAlteravel = {
  id: string
  codigo: string
  dataHora: Date
  duracaoMin: number
  status: string
  servicoId: string
  pacienteNome: string
  pacienteTelefone: string
  pacienteEmail: string | null
  observacoes: string | null
  googleEventoId: string | null
  servico: { nome: string }
}

export type AgendamentoResumo = {
  id: string
  codigo: string
  dataHora: Date
  duracaoMin: number
  status: string
  servico: { nome: string }
}

export type ResultadoAlteracao =
  | { ok: true; agendamento: AgendamentoResumo; prazos: PrazoPaciente }
  | { ok: false; status: number; erro: string; codigo?: string }

function resumir(agendamento: {
  id: string
  codigo: string
  dataHora: Date
  duracaoMin: number
  status: string
  servico: { nome: string }
}): AgendamentoResumo {
  return {
    id: agendamento.id,
    codigo: agendamento.codigo,
    dataHora: agendamento.dataHora,
    duracaoMin: agendamento.duracaoMin,
    status: agendamento.status,
    servico: { nome: agendamento.servico.nome },
  }
}

export async function remarcarConsulta(
  agendamento: AgendamentoAlteravel,
  data: string,
  horario: string
): Promise<ResultadoAlteracao> {
  const agora = new Date()

  // 1) A consulta ATUAL precisa respeitar o prazo mínimo (48h por padrão).
  const prazos = avaliarPrazos(agendamento, agora)
  if (!prazos.podeRemarcar) {
    return {
      ok: false,
      status: 422,
      erro: prazos.motivoRemarcacao || mensagemPrazoReagendamento(),
      codigo: 'PRAZO',
    }
  }

  // 2) O NOVO horário também precisa respeitar o prazo a partir de agora.
  const novoInicio = dataHoraDoSlot(data, horario)
  if (
    Number.isNaN(novoInicio.getTime()) ||
    !respeitaPrazo(novoInicio, PRAZO_REAGENDAMENTO_HORAS, agora)
  ) {
    return { ok: false, status: 422, erro: mensagemPrazoReagendamento(), codigo: 'PRAZO' }
  }

  // 3) Horário de funcionamento, bloqueios e conflitos.
  const validacao = await validarHorarioDisponivel(agendamento.servicoId, data, horario)
  if (!validacao.disponivel) {
    return {
      ok: false,
      status: 409,
      erro: 'Este horário não está mais disponível. Escolha outro.',
      codigo: 'INDISPONIVEL',
    }
  }

  const duracaoMin = agendamento.duracaoMin
  const novoFim = new Date(novoInicio.getTime() + duracaoMin * 60 * 1000)

  // 4) Double-check no Google, ignorando o próprio evento.
  if (googleAtivo()) {
    const check = await horarioLivre(novoInicio, novoFim, agendamento.googleEventoId)
    if (!check.livre) {
      return {
        ok: false,
        status: 409,
        erro: 'Este horário não está mais disponível. Escolha outro.',
        codigo: 'INDISPONIVEL',
      }
    }
  }

  // 5) Grava a remarcação + histórico em transação.
  const dataHoraAnterior = agendamento.dataHora
  let atualizado
  try {
    atualizado = await prisma.$transaction(async tx => {
      const conflitos = await tx.agendamento.findMany({
        where: {
          id: { not: agendamento.id },
          status: { notIn: ['CANCELADO', 'FALTA'] },
          dataHora: {
            gte: new Date(novoInicio.getTime() - 6 * 60 * 60 * 1000),
            lte: new Date(novoFim.getTime() + 6 * 60 * 60 * 1000),
          },
        },
        select: { dataHora: true, duracaoMin: true },
      })

      if (slotConflitaComAgendamento(novoInicio, duracaoMin, conflitos)) {
        throw new Error('HORARIO_OCUPADO')
      }

      const ag = await tx.agendamento.update({
        where: { id: agendamento.id },
        data: { dataHora: novoInicio, status: 'REMARCADO' },
        include: { servico: true },
      })

      await tx.remarcacao.create({
        data: {
          agendamentoId: agendamento.id,
          de: dataHoraAnterior,
          para: novoInicio,
          por: 'paciente',
        },
      })

      return ag
    })
  } catch (erro) {
    if (erro instanceof Error && erro.message === 'HORARIO_OCUPADO') {
      return {
        ok: false,
        status: 409,
        erro: 'Este horário acabou de ser ocupado. Escolha outro.',
        codigo: 'INDISPONIVEL',
      }
    }
    console.error('[Minha consulta] Falha ao remarcar:', erro)
    return {
      ok: false,
      status: 500,
      erro: 'Não foi possível remarcar agora. Tente novamente.',
    }
  }

  // 6) Integrações falham em silêncio: o banco é a fonte de verdade.
  const cfg = await getConfiguracoes()
  const dadosEvento: DadosEventoConsulta = {
    codigo: agendamento.codigo,
    pacienteNome: agendamento.pacienteNome,
    pacienteTelefone: agendamento.pacienteTelefone,
    pacienteEmail: agendamento.pacienteEmail,
    servicoNome: agendamento.servico.nome,
    dentistaNome: cfg.dentistaNome,
    inicio: novoInicio,
    fim: novoFim,
    observacoes: agendamento.observacoes,
  }

  if (googleAtivo()) {
    try {
      if (agendamento.googleEventoId) {
        await moverEvento(agendamento.googleEventoId, dadosEvento)
      } else {
        const eventoId = await criarEvento(dadosEvento)
        await prisma.agendamento.update({
          where: { id: agendamento.id },
          data: { googleEventoId: eventoId },
        })
      }
    } catch (erroGoogle) {
      console.error('[Google Calendar] Falha ao sincronizar remarcação:', erroGoogle)
    }
  }

  if (emailConfigurado() && agendamento.pacienteEmail) {
    try {
      const ics = await gerarArquivoICS({
        codigo: agendamento.codigo,
        servicoNome: agendamento.servico.nome,
        dataHora: novoInicio,
        duracaoMin,
        endereco: cfg.clinicaEndereco || '',
        clinicaNome: cfg.clinicaNome,
        dentistaNome: cfg.dentistaNome,
        telefone: cfg.clinicaTelefone || '',
      })
      await enviarRemarcacao(
        {
          codigo: agendamento.codigo,
          pacienteNome: agendamento.pacienteNome,
          pacienteEmail: agendamento.pacienteEmail,
          servicoNome: agendamento.servico.nome,
          dataHora: novoInicio,
          duracaoMin,
          dentistaNome: cfg.dentistaNome,
          clinicaNome: cfg.clinicaNome,
          clinicaTelefone: cfg.clinicaTelefone || '',
          linkGestao: linkGestao(agendamento.codigo),
          ics,
          nomeArquivoIcs: gerarNomeArquivoICS(agendamento.codigo),
        },
        dataHoraAnterior
      )
    } catch (erroEmail) {
      console.error('[E-mail] Falha ao enviar remarcação:', erroEmail)
    }
  }

  const resumo = resumir(atualizado)
  return { ok: true, agendamento: resumo, prazos: avaliarPrazos(resumo) }
}

export async function cancelarConsulta(
  agendamento: AgendamentoAlteravel
): Promise<ResultadoAlteracao> {
  const prazos = avaliarPrazos(agendamento)
  if (!prazos.podeCancelar) {
    return {
      ok: false,
      status: 422,
      erro: prazos.motivoCancelamento || mensagemPrazoCancelamento(),
      codigo: 'PRAZO',
    }
  }

  const atualizado = await prisma.agendamento.update({
    where: { id: agendamento.id },
    data: {
      status: 'CANCELADO',
      canceladoEm: new Date(),
      canceladoPor: 'paciente',
    },
    include: { servico: true },
  })

  if (googleAtivo() && agendamento.googleEventoId) {
    try {
      const { excluirEvento } = await import('./google/agenda')
      await excluirEvento(agendamento.googleEventoId)
      await prisma.agendamento.update({
        where: { id: agendamento.id },
        data: { googleEventoId: null },
      })
    } catch (erroGoogle) {
      console.error('[Google Calendar] Falha ao excluir evento cancelado:', erroGoogle)
    }
  }

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

  const resumo = resumir(atualizado)
  return { ok: true, agendamento: resumo, prazos: avaliarPrazos(resumo) }
}
