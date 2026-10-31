import { NextRequest, NextResponse } from 'next/server'
import { pacienteDaSessaoOTP, resumoAgendamentoComPrazos } from '@/lib/paciente-api'
import {
  SESSAO_PACIENTE_MINUTOS,
  renovarSessaoOTP,
} from '@/lib/paciente-sessao-otp'

/**
 * GET /api/paciente/email/sessao
 *
 * Devolve o paciente da sessão e as consultas ativas com os prazos já
 * calculados no servidor. Renova o cookie (janela de 30 min de inatividade).
 */
export async function GET(request: NextRequest) {
  const dados = await pacienteDaSessaoOTP(request)
  if (!dados) {
    return NextResponse.json(
      { erro: 'Sessão expirada' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { paciente } = dados
  const resposta = NextResponse.json(
    {
      paciente: {
        id: paciente.id,
        nome: paciente.nome,
        email: paciente.email,
        telefone: paciente.telefone,
      },
      agendamentos: paciente.agendamentos.map(resumoAgendamentoComPrazos),
      sessaoMinutos: SESSAO_PACIENTE_MINUTOS,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  renovarSessaoOTP(request, resposta, paciente.id)
  return resposta
}
