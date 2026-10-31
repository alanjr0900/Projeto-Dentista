import { NextRequest, NextResponse } from 'next/server'
import { agendamentoDaSessao, resumoAgendamento } from '@/lib/paciente-api'
import { cancelarConsulta } from '@/lib/paciente-alteracoes'
import {
  COOKIE_SESSAO_PACIENTE,
  criarTokenSessao,
  opcoesCookieSessao,
} from '@/lib/paciente-sessao'

/** Cancelamento pelo paciente — prazo revalidado no servidor. */
export async function POST(request: NextRequest) {
  const dados = await agendamentoDaSessao(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  const alteracao = await cancelarConsulta(dados.agendamento)
  if (!alteracao.ok) {
    return NextResponse.json(
      { erro: alteracao.erro, ...(alteracao.codigo ? { codigo: alteracao.codigo } : {}) },
      { status: alteracao.status }
    )
  }

  const resposta = NextResponse.json({
    sucesso: true,
    mensagem: 'Consulta cancelada.',
    agendamento: resumoAgendamento(alteracao.agendamento),
    prazos: alteracao.prazos,
  })
  resposta.cookies.set(
    COOKIE_SESSAO_PACIENTE,
    criarTokenSessao(dados.agendamento.id, dados.sessao.nivel),
    opcoesCookieSessao(request)
  )
  return resposta
}
