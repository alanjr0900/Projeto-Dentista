import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizarCodigo } from '@/lib/codigo'
import {
  COOKIE_SESSAO_PACIENTE,
  criarTokenSessao,
  opcoesCookieSessao,
} from '@/lib/paciente-sessao'
import {
  MENSAGEM_ACESSO_INVALIDO,
  MENSAGEM_BLOQUEIO_TEMPORARIO,
  chavesTentativa,
  ipDaRequisicao,
  limparTentativasPaciente,
  registrarFalhaPaciente,
  verificarBloqueioPaciente,
} from '@/lib/paciente-rate-limit'
import { avaliarPrazos } from '@/lib/paciente-prazos'
import { buscarAgendamentoPorCodigo, segundoFatorConfere } from '@/lib/paciente-consulta'
import { resumoAgendamento } from '@/lib/paciente-api'

/**
 * Login do paciente em "Minha consulta".
 *
 * - código sozinho → sessão "básico" (remarcar/cancelar);
 * - código + segundo dado → sessão "completo" (diagnósticos liberados).
 *
 * Erros são SEMPRE genéricos: não revelam se o código existe nem qual dado
 * estava errado (LGPD + anti-enumeração).
 */
const loginSchema = z.object({
  codigo: z.string().trim().min(6).max(40).regex(/^[A-Za-z0-9]+$/, 'Código inválido'),
  segundoFator: z.string().trim().max(20).optional().or(z.literal('')),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: MENSAGEM_ACESSO_INVALIDO }, { status: 400 })
  }

  const resultado = loginSchema.safeParse(body)
  if (!resultado.success) {
    return NextResponse.json({ erro: MENSAGEM_ACESSO_INVALIDO }, { status: 400 })
  }

  const ip = ipDaRequisicao(request)
  const codigo = normalizarCodigo(resultado.data.codigo)
  const segundoFator = String(resultado.data.segundoFator ?? '').trim()
  const chaves = chavesTentativa(ip, codigo)

  const bloqueio = verificarBloqueioPaciente(chaves)
  if (bloqueio.bloqueado) {
    return NextResponse.json({ erro: MENSAGEM_BLOQUEIO_TEMPORARIO }, { status: 429 })
  }

  const agendamento = await buscarAgendamentoPorCodigo(codigo)
  if (!agendamento) {
    registrarFalhaPaciente(chaves)
    return NextResponse.json({ erro: MENSAGEM_ACESSO_INVALIDO }, { status: 401 })
  }

  // Se o paciente informou o segundo dado, ele PRECISA conferir.
  let nivel: 'basico' | 'completo' = 'basico'
  if (segundoFator) {
    if (!segundoFatorConfere(agendamento, segundoFator)) {
      registrarFalhaPaciente(chaves)
      return NextResponse.json({ erro: MENSAGEM_ACESSO_INVALIDO }, { status: 401 })
    }
    nivel = 'completo'
  }

  limparTentativasPaciente(chaves)

  const prazos = avaliarPrazos(agendamento)
  const resposta = NextResponse.json({
    nivel,
    agendamento: resumoAgendamento(agendamento),
    prazos,
  })
  resposta.cookies.set(
    COOKIE_SESSAO_PACIENTE,
    criarTokenSessao(agendamento.id, nivel),
    opcoesCookieSessao(request)
  )
  return resposta
}
