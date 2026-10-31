/**
 * Normalização de nome de pessoa para comparação (regra do agendamento).
 *
 * Ignora:
 * - maiúsculas/minúsculas;
 * - acentos (NFD + remoção de diacríticos);
 * - espaços extras (trim + colapso de espaços internos).
 *
 * NÃO remove espaços internos por completo: "Ana Maria" e "AnaMaria"
 * continuam sendo nomes diferentes.
 */
export function normalizarNomePessoa(nome: string): string {
  return nome
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** True quando os dois nomes são o "mesmo nome" pela regra acima. */
export function nomesConferem(a: string, b: string): boolean {
  return normalizarNomePessoa(a) === normalizarNomePessoa(b)
}
