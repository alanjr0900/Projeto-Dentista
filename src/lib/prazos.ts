/**
 * Prazos (em horas) que o paciente precisa respeitar para alterar a própria
 * consulta. Fonte ÚNICA desses números — nenhum outro arquivo repete o valor.
 *
 * Podem ser ajustados sem tocar no código pelas variáveis de ambiente:
 *   PRAZO_REAGENDAMENTO_HORAS=48
 *   PRAZO_CANCELAMENTO_HORAS=48
 */

const HORAS_PADRAO_REAGENDAMENTO = 48
const HORAS_PADRAO_CANCELAMENTO = 48

function lerHoras(valor: string | undefined, padrao: number): number {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : padrao
}

export const PRAZO_REAGENDAMENTO_HORAS = lerHoras(
  process.env.PRAZO_REAGENDAMENTO_HORAS,
  HORAS_PADRAO_REAGENDAMENTO
)

export const PRAZO_CANCELAMENTO_HORAS = lerHoras(
  process.env.PRAZO_CANCELAMENTO_HORAS,
  HORAS_PADRAO_CANCELAMENTO
)

const MS_POR_HORA = 60 * 60 * 1000

/** Horas entre agora e a data informada (negativo = já passou). */
export function horasAte(data: Date, agora: Date = new Date()): number {
  return (data.getTime() - agora.getTime()) / MS_POR_HORA
}

/** True quando a data ainda respeita o prazo mínimo em horas. */
export function respeitaPrazo(data: Date, horas: number, agora: Date = new Date()): boolean {
  return horasAte(data, agora) >= horas
}

/** Primeiro instante permitido para um novo horário (agora + prazo). */
export function primeiroHorarioPermitido(horas: number, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + horas * MS_POR_HORA)
}

export function mensagemPrazoReagendamento(horas: number = PRAZO_REAGENDAMENTO_HORAS): string {
  return `Remarcações precisam ser feitas com pelo menos ${horas} horas de antecedência. Fale com a clínica pelo WhatsApp.`
}

export function mensagemPrazoCancelamento(horas: number = PRAZO_CANCELAMENTO_HORAS): string {
  return `Cancelamentos precisam ser feitos com pelo menos ${horas} horas de antecedência. Fale com a clínica pelo WhatsApp.`
}
