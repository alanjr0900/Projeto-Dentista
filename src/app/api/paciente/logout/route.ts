import { NextRequest, NextResponse } from 'next/server'
import {
  COOKIE_SESSAO_PACIENTE,
  opcoesCookieLogout,
} from '@/lib/paciente-sessao'

/** Encerra a sessão do paciente apagando o cookie assinado. */
export async function POST(request: NextRequest) {
  const resposta = NextResponse.json({ sucesso: true })
  resposta.cookies.set(COOKIE_SESSAO_PACIENTE, '', opcoesCookieLogout(request))
  return resposta
}
