/**
 * Regras de prazo da consulta do paciente (48h por padrão).
 *
 * A fonte dos números é `src/lib/prazos.ts`. Este módulo é puro para poder ser
 * testado sem banco e é reutilizado pelas rotas de API.
 */
import {
  PRAZO_CANCELAMENTO_HORAS,
  PRAZO_REAGENDAMENTO_HORAS,
  horasAte,
  mensagemPrazoCancelamento,
  mensagemPrazoReagendamento,
  respeitaPrazo,
} from './prazos'

export const STATUS_ALTERAVEIS = ['PENDENTE', 'CONFIRMADO', 'REMARCADO']

// Re-export para uso nas rotas de API
export { mensagemPrazoCancelamento, mensagemPrazoReagendamento }

export type PrazoPaciente = {
  podeRemarcar: boolean
  motivoRemarcacao?: string
  podeCancelar: boolean
  motivoCancelamento?: string
  horasParaConsulta: number
  /** Prazos vigentes — usados nos textos da tela. */
  prazoHoras: number
  prazoCancelamentoHoras: number
}

/** Avalia os prazos (48h padrão) para a consulta do paciente. */
export function avaliarPrazos(
  agendamento: { dataHora: Date; status: string },
  agora: Date = new Date()
): PrazoPaciente {
  const statusOk = STATUS_ALTERAVEIS.includes(agendamento.status)
  const horas = horasAte(agendamento.dataHora, agora)

  const podeRemarcar = statusOk && respeitaPrazo(agendamento.dataHora, PRAZO_REAGENDAMENTO_HORAS, agora)
  const podeCancelar = statusOk && respeitaPrazo(agendamento.dataHora, PRAZO_CANCELAMENTO_HORAS, agora)

  let motivoRemarcacao: string | undefined
  if (!statusOk) {
    motivoRemarcacao =
      agendamento.status === 'CANCELADO'
        ? 'Esta consulta está cancelada.'
        : 'Esta consulta não pode mais ser remarcada pelo site.'
  } else if (!podeRemarcar) {
    motivoRemarcacao = mensagemPrazoReagendamento()
  }

  let motivoCancelamento: string | undefined
  if (!statusOk) {
    motivoCancelamento = 'Esta consulta não pode mais ser cancelada pelo site.'
  } else if (!podeCancelar) {
    motivoCancelamento = mensagemPrazoCancelamento()
  }

  return {
    podeRemarcar,
    motivoRemarcacao,
    podeCancelar,
    motivoCancelamento,
    horasParaConsulta: horas,
    prazoHoras: PRAZO_REAGENDAMENTO_HORAS,
    prazoCancelamentoHoras: PRAZO_CANCELAMENTO_HORAS,
  }
}
