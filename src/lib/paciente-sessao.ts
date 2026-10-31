/**
 * Sessão curta do paciente ("Minha consulta").
 *
 * - Cookie httpOnly, assinado com HMAC-SHA256 (segredo AUTH_SECRET), sem
 *   tabela de sessão no banco.
 * - Validade de 15 minutos, renovada a cada login.
 * - Dois níveis:
 *     básico   → só o código do agendamento (remarcar/cancelar);
 *     completo → código + segundo dado (data de nascimento ou 4 últimos
 *                dígitos do telefone) para ver diagnósticos liberados.
 * - `secure` é derivado do protocolo real da requisição (https, ou host que
 *   não seja localhost) para funcionar em teste local via http.
 *
 * A sessão NUNCA carrega dado de saúde — apenas id do agendamento e nível.
 * Módulo exclusivo do servidor.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const COOKIE_SESSAO_PACIENTE = 'consulta-sessao'
export const SESSAO_PACIENTE_MINUTOS = 15

export type NivelSessaoPaciente = 'basico' | 'completo'

export type SessaoPaciente = {
  /** id interno do agendamento (não é dado de saúde) */
  agendamentoId: string
  nivel: NivelSessaoPaciente
  /** expiração em epoch (segundos) */
  exp: number
}

function segredo(): string {
  const valor = process.env.AUTH_SECRET
  if (!valor) throw new Error('AUTH_SECRET não configurado')
  return valor
}

function assinar(payload: string): string {
  return createHmac('sha256', segredo()).update(payload).digest('base64url')
}

/** Cria o token assinado (payload + assinatura), pronto para o cookie. */
export function criarTokenSessao(
  agendamentoId: string,
  nivel: NivelSessaoPaciente,
  agoraMs: number = Date.now()
): string {
  const sessao: SessaoPaciente = {
    agendamentoId,
    nivel,
    exp: Math.floor(agoraMs / 1000) + SESSAO_PACIENTE_MINUTOS * 60,
  }
  const payload = Buffer.from(JSON.stringify(sessao), 'utf8').toString('base64url')
  return `${payload}.${assinar(payload)}`
}

/** Lê e valida o token; devolve null se inválido, adulterado ou expirado. */
export function lerTokenSessao(
  token: string | null | undefined,
  agoraMs: number = Date.now()
): SessaoPaciente | null {
  if (!token) return null

  const partes = token.split('.')
  if (partes.length !== 2) return null

  const [payload, assinatura] = partes
  const esperada = assinar(payload)
  const recebidaBuffer = Buffer.from(assinatura, 'utf8')
  const esperadaBuffer = Buffer.from(esperada, 'utf8')
  if (recebidaBuffer.length !== esperadaBuffer.length) return null
  if (!timingSafeEqual(recebidaBuffer, esperadaBuffer)) return null

  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessaoPaciente
    if (!dados || typeof dados.agendamentoId !== 'string') return null
    if (dados.nivel !== 'basico' && dados.nivel !== 'completo') return null
    if (typeof dados.exp !== 'number' || dados.exp * 1000 <= agoraMs) return null
    return dados
  } catch {
    return null
  }
}

/** Sessão do paciente a partir da requisição (cookie), ou null. */
export function sessaoDaRequisicao(request: NextRequest): SessaoPaciente | null {
  return lerTokenSessao(request.cookies.get(COOKIE_SESSAO_PACIENTE)?.value)
}

/** True quando o acesso está em https (ou o host não é local). */
export function requisicaoSegura(request: NextRequest): boolean {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto) return proto === 'https'

  const host = (request.headers.get('host') || request.nextUrl.hostname || '').toLowerCase()
  if (!host) return request.nextUrl.protocol === 'https:'
  return !(host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]'))
}

/** Opções do cookie de sessão (httpOnly + secure derivado da requisição). */
export function opcoesCookieSessao(request: NextRequest) {
  return {
    httpOnly: true,
    secure: requisicaoSegura(request),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSAO_PACIENTE_MINUTOS * 60,
  }
}

/** Opções para apagar o cookie no logout. */
export function opcoesCookieLogout(request: NextRequest) {
  return { ...opcoesCookieSessao(request), maxAge: 0 }
}
