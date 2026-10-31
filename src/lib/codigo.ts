/**
 * Código público do agendamento (o que o paciente mostra/recebe).
 *
 * Regras:
 * - gerado com gerador criptográfico (crypto.randomInt), NUNCA Math.random;
 * - 8 caracteres;
 * - alfabeto sem caracteres ambíguos (0/O, 1/I/L);
 * - única no banco (quem chama confere com `gerarCodigoUnico`);
 * - minúsculas são aceitas e convertidas para MAIÚSCULAS no servidor.
 *
 * Módulo exclusivo do servidor (importa `crypto`).
 */
import { randomInt } from 'crypto'

export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const TAMANHO_CODIGO = 8

/** Gera um código aleatório criptograficamente seguro. */
export function gerarCodigo(): string {
  let codigo = ''
  for (let i = 0; i < TAMANHO_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  }
  return codigo
}

/** Normaliza a entrada do paciente: sem espaços, sempre maiúsculo. */
export function normalizarCodigo(valor: string | null | undefined): string {
  return String(valor ?? '').trim().toUpperCase()
}

/** True quando o código tem o formato exato esperado (após normalizar). */
export function codigoValido(valor: string | null | undefined): boolean {
  const normalizado = normalizarCodigo(valor)
  if (normalizado.length !== TAMANHO_CODIGO) return false
  for (const caractere of normalizado) {
    if (!ALFABETO_CODIGO.includes(caractere)) return false
  }
  return true
}

/**
 * Gera um código que ainda não existe no banco.
 * `existe` deve consultar o banco (ex.: prisma.agendamento.findUnique).
 */
export async function gerarCodigoUnico(
  existe: (codigo: string) => Promise<boolean>,
  tentativas = 12
): Promise<string> {
  for (let i = 0; i < tentativas; i++) {
    const codigo = gerarCodigo()
    if (!(await existe(codigo))) return codigo
  }
  throw new Error('Não foi possível gerar um código único para o agendamento')
}
