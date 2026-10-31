import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  agendamentoDoPaciente,
  pacienteDaSessaoOTP,
  resumoAgendamentoComPrazos,
} from '@/lib/paciente-api'
import { cancelarConsulta } from '@/lib/paciente-alteracoes'
import { renovarSessaoOTP } from '@/lib/paciente-sessao-otp'

const cancelarSchema = z.object({
  agendamentoId: z.string().min(1, 'Consulta não informada'),
})

/**
 * POST /api/paciente/email/cancelar
 * Exige sessão OTP e confirma que o agendamento pertence ao paciente.
 */
export async function POST(request: NextRequest) {
  const dados = await pacienteDaSessaoOTP(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const resultado = cancelarSchema.safeParse(body)
  if (!resultado.success) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
  }

  const agendamento = await agendamentoDoPaciente(
    dados.paciente.id,
    resultado.data.agendamentoId
  )
  if (!agendamento) {
    return NextResponse.json({ erro: 'Consulta não encontrada' }, { status: 404 })
  }

  const alteracao = await cancelarConsulta(agendamento)
  if (!alteracao.ok) {
    return NextResponse.json(
      { erro: alteracao.erro, ...(alteracao.codigo ? { codigo: alteracao.codigo } : {}) },
      { status: alteracao.status }
    )
  }

  const resposta = NextResponse.json({
    sucesso: true,
    mensagem: 'Consulta cancelada.',
    agendamento: resumoAgendamentoComPrazos(alteracao.agendamento),
  })
  renovarSessaoOTP(request, resposta, dados.paciente.id)
  return resposta
}
