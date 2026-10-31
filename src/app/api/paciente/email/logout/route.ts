import { NextRequest, NextResponse } from 'next/server'
import {
  COOKIE_SESSAO_PACIENTE_OTP,
  opcoesCookieLogoutOTP,
} from '@/lib/paciente-sessao-otp'

/** POST /api/paciente/email/logout - Encerra a sessão do paciente. */
export async function POST(request: NextRequest) {
  const resposta = NextResponse.json(
    { sucesso: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  resposta.cookies.set(COOKIE_SESSAO_PACIENTE_OTP, '', opcoesCookieLogoutOTP(request))
  return resposta
}
