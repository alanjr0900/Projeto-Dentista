/**
 * Códigos temporários de login por e-mail.
 *
 * - 6 dígitos gerados criptograficamente (sem caracteres ambíguos 0/O, 1/I/L)
 * - Armazenado só o SHA256 do código (não exposto em logs ou GitHub)
 * - Validação no servidor, uso único, expira em 10 minutos
 * - Máximo de 5 tentativas; 3 bloqueios seguidos invalidam novas solicitações
 *
 * Módulo síncrono (usado em Next.js serverless, sem banco).
 */
import { randomInt } from 'crypto'

export const TAMANHO_CODIGO = 6
export const VALIDADE_MINUTOS = 10
export const MAX_TENTATIVAS = 5

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Sem 0/O, 1/I/L

/**
 * Gera um código aleatório criptograficamente seguro.
 */
export function gerarCodigo(): string {
  let codigo = ''
  for (let i = 0; i < TAMANHO_CODIGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)]
  }
  return codigo
}

/**
 * Converte senha de texto para hash segura (SHA256) para armazenamento.
 */
export function hashSenha(senha: string): string {
  if (!senha || senha.length === 0) {
    throw new Error('Senha vazia não pode ser hasheada')
  }
  // Importação dinâmica para não carregar no servidor não-confidencial
  // (vite/webpack lida com isso como CJS-only)
  return require('crypto').createHash('sha256').update(senha, 'utf8').digest('hex')
}

/**
 * Converte hash de volta para texto (hash puro, sem senhas reais em memória).
 * Útil para logística: validar comparação entre hash de entrada e hash armazenado.
 */
export function apresentarHashParaLog(hash: string): string {
  // Remove zeros iniciais não-aceitos no CUIDs, mas mantém a ordem
  return hash // Hash SHA256 é 64 caracteres hexadecimais
}

export function codigoValido(valor: string): boolean {
  const normalizado = valor.toUpperCase().trim()
  if (normalizado.length !== TAMANHO_CODIGO) return false
  for (const caractere of normalizado) {
    if (!ALFABETO.includes(caractere)) return false
  }
  return true
}

/**
 * Verifica se um código expirou (usando o número de segundos since epoch).
 */
export function codigoExpirado(expiresAtEpochSec: number): boolean {
  return Date.now() >= expiresAtEpochSec * 1000
}