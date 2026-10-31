/**
 * Data de nascimento: parsing/formatacão seguras para o fuso de São Paulo.
 *
 * A data é gravada como um instante fixo ao MEIO-DIA UTC (09:00 em São Paulo),
 * para que nunca "pule" de dia ao formatar em America/Sao_Paulo, qualquer que
 * seja o fuso do servidor ou do navegador.
 *
 * Módulo isomórfico (usado no servidor e em componentes cliente).
 */

export const TZ_BR = 'America/Sao_Paulo'

/** Aceita "YYYY-MM-DD" (input type=date) ou "DD/MM/YYYY". */
export function parseDataNascimento(valor: string | null | undefined): Date | null {
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null

  let ano: number
  let mes: number
  let dia: number

  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    ano = Number(iso[1])
    mes = Number(iso[2])
    dia = Number(iso[3])
  } else {
    const brasileira = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!brasileira) return null
    dia = Number(brasileira[1])
    mes = Number(brasileira[2])
    ano = Number(brasileira[3])
  }

  if (!ano || !mes || !dia) return null
  if (ano < 1900) return null

  // Valida a data no calendário (rejeita 31/02, etc.)
  const candidata = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0))
  if (
    candidata.getUTCFullYear() !== ano ||
    candidata.getUTCMonth() !== mes - 1 ||
    candidata.getUTCDate() !== dia
  ) {
    return null
  }
  if (candidata.getTime() > Date.now()) return null

  return candidata
}

/** Formata como DD/MM/AAAA (ou '' quando vazio/inválido). */
export function formatarDataNascimentoBR(valor: Date | string | null | undefined): string {
  if (!valor) return ''
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ_BR,
  }).format(data)
}

/** Formato "YYYY-MM-DD" para preencher <input type="date">. */
export function dataNascimentoParaInput(valor: Date | string | null | undefined): string {
  if (!valor) return ''
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ_BR,
  }).format(data)
}

/** Compara a data de nascimento do cadastro com a digitada pelo paciente. */
export function dataNascimentoConfere(
  cadastrada: Date | string | null | undefined,
  informada: Date | null
): boolean {
  if (!cadastrada || !informada) return false
  return dataNascimentoParaInput(cadastrada) === dataNascimentoParaInput(informada)
}
