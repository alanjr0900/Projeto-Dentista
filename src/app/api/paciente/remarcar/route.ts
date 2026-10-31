import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { agendamentoDaSessao, resumoAgendamento } from '@/lib/paciente-api'
import { remarcarConsulta } from '@/lib/paciente-alteracoes'
import {
  COOKIE_SESSAO_PACIENTE,
  criarTokenSessao,
  opcoesCookieSessao,
} from '@/lib/paciente-sessao'

/** Remarcação pelo paciente — TODAS as regras revalidadas no servidor. */
const remarcarSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
})

export async function POST(request: NextRequest) {
  const dados = await agendamentoDaSessao(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
  }

  const resultado = remarcarSchema.safeParse(body)
  if (!resultado.success) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
  }

  const alteracao = await remarcarConsulta(
    dados.agendamento,
    resultado.data.data,
    resultado.data.horario
  )

  if (!alteracao.ok) {
    return NextResponse.json(
      { erro: alteracao.erro, ...(alteracao.codigo ? { codigo: alteracao.codigo } : {}) },
      { status: alteracao.status }
    )
  }

  const resposta = NextResponse.json({
    sucesso: true,
    mensagem: 'Consulta remarcada com sucesso.',
    agendamento: resumoAgendamento(alteracao.agendamento),
    prazos: alteracao.prazos,
  })
  // Renova a sessão curta após a alteração.
  resposta.cookies.set(
    COOKIE_SESSAO_PACIENTE,
    criarTokenSessao(dados.agendamento.id, dados.sessao.nivel),
    opcoesCookieSessao(request)
  )
  return resposta
}
