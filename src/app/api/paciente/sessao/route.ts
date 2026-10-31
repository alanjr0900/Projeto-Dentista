import { NextRequest, NextResponse } from 'next/server'
import { agendamentoDaSessao, resumoAgendamento } from '@/lib/paciente-api'
import { avaliarPrazos } from '@/lib/paciente-prazos'
import {
  COOKIE_SESSAO_PACIENTE,
  criarTokenSessao,
  opcoesCookieSessao,
} from '@/lib/paciente-sessao'

/**
 * Estado da sessão do paciente. Sempre validado no servidor.
 * Renova o cookie (janela deslizante de 15 min) enquanto o paciente navega.
 */
export async function GET(request: NextRequest) {
  const dados = await agendamentoDaSessao(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  const { sessao, agendamento } = dados
  const resposta = NextResponse.json({
    nivel: sessao.nivel,
    agendamento: resumoAgendamento(agendamento),
    prazos: avaliarPrazos(agendamento),
  })

  resposta.cookies.set(
    COOKIE_SESSAO_PACIENTE,
    criarTokenSessao(agendamento.id, sessao.nivel),
    opcoesCookieSessao(request)
  )
  return resposta
}
