/**
 * Sessão do paciente após validar o código de e-mail.
 *
 * - cookie HttpOnly, SameSite configurável e Secure automático em HTTPS;
 * - token assinado com HMAC (AUTH_SECRET), sem dados sensíveis no payload;
 * - 30 minutos de INATIVIDADE (renovado a cada requisição autenticada);
 * - a sessão é do PACIENTE: não carrega código de agendamento.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'

function numeroEnv(nome: string, padrao: number): number {
  const numero = Number(process.env[nome])
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao
}

export const COOKIE_SESSAO_PACIENTE_OTP =
  process.env.PACIENTE_COOKIE_NAME?.trim() || 'consulta-sessao-otp'

export const SESSAO_PACIENTE_MINUTOS = numeroEnv('PACIENTE_SESSAO_MINUTOS', 30)

type SameSite = 'lax' | 'strict' | 'none'

function sameSiteConfigurado(): SameSite {
  const valor = (process.env.PACIENTE_COOKIE_SAMESITE || 'lax').trim().toLowerCase()
  return valor === 'strict' || valor === 'none' ? valor : 'lax'
}

export type SessaoPacienteOTP = {
  pacienteId: string
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

export function criarTokenSessaoOTP(
  pacienteId: string,
  agoraMs: number = Date.now()
): string {
  const sessao: SessaoPacienteOTP = {
    pacienteId,
    exp: Math.floor(agoraMs / 1000) + SESSAO_PACIENTE_MINUTOS * 60,
  }
  const payload = Buffer.from(JSON.stringify(sessao), 'utf8').toString('base64url')
  return `${payload}.${assinar(payload)}`
}

export function lerTokenSessaoOTP(
  token: string | null | undefined,
  agoraMs: number = Date.now()
): SessaoPacienteOTP | null {
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
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessaoPacienteOTP
    if (!dados || typeof dados.pacienteId !== 'string') return null
    if (typeof dados.exp !== 'number' || dados.exp * 1000 <= agoraMs) return null
    return dados
  } catch {
    return null
  }
}

export function sessaoDaRequisicaoOTP(request: NextRequest): SessaoPacienteOTP | null {
  return lerTokenSessaoOTP(request.cookies.get(COOKIE_SESSAO_PACIENTE_OTP)?.value)
}

/** HTTPS real (inclusive atrás de túnel/proxy com x-forwarded-proto). */
export function requisicaoSegura(request: NextRequest): boolean {
  const proto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()
  if (proto) return proto === 'https'
  return request.nextUrl.protocol === 'https:'
}

export function opcoesCookieSessaoOTP(request: NextRequest) {
  const sameSite = sameSiteConfigurado()
  const secure = sameSite === 'none' ? true : requisicaoSegura(request)
  const domain = process.env.PACIENTE_COOKIE_DOMAIN?.trim()

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: SESSAO_PACIENTE_MINUTOS * 60,
    ...(domain ? { domain } : {}),
  }
}

export function opcoesCookieLogoutOTP(request: NextRequest) {
  return { ...opcoesCookieSessaoOTP(request), maxAge: 0 }
}

/** Renova o cookie (janela deslizante de inatividade). */
export function renovarSessaoOTP(
  request: NextRequest,
  resposta: NextResponse,
  pacienteId: string
): void {
  resposta.cookies.set(
    COOKIE_SESSAO_PACIENTE_OTP,
    criarTokenSessaoOTP(pacienteId),
    opcoesCookieSessaoOTP(request)
  )
}
