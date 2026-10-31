import { NextRequest, NextResponse } from 'next/server'
import { agendamentoDoPaciente, pacienteDaSessaoOTP } from '@/lib/paciente-api'
import { listarHorariosLivres } from '@/lib/paciente-consulta'
import { avaliarPrazos } from '@/lib/paciente-prazos'
import { renovarSessaoOTP } from '@/lib/paciente-sessao-otp'
import { PRAZO_REAGENDAMENTO_HORAS } from '@/lib/prazos'

/**
 * GET /api/paciente/email/horarios?agendamentoId=...
 *
 * Horários LIVRES para remarcar. Não devolve nomes nem detalhes de horários
 * ocupados. Exige sessão OTP e que o agendamento pertença ao paciente.
 */
export async function GET(request: NextRequest) {
  const dados = await pacienteDaSessaoOTP(request)
  if (!dados) {
    return NextResponse.json(
      { erro: 'Sessão expirada' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const agendamentoId = new URL(request.url).searchParams.get('agendamentoId') || ''
  if (!agendamentoId) {
    return NextResponse.json({ erro: 'Agendamento não informado' }, { status: 400 })
  }

  const agendamento = await agendamentoDoPaciente(dados.paciente.id, agendamentoId)
  if (!agendamento) {
    // Não confirma se o agendamento existe para outro paciente.
    return NextResponse.json({ erro: 'Consulta não encontrada' }, { status: 404 })
  }

  const prazos = avaliarPrazos(agendamento)
  if (!prazos.podeRemarcar) {
    return NextResponse.json(
      { erro: prazos.motivoRemarcacao || 'Remarcação não permitida', codigo: 'PRAZO' },
      { status: 422 }
    )
  }

  const { dias, duracaoMin } = await listarHorariosLivres(agendamento)

  const resposta = NextResponse.json(
    {
      dias,
      duracaoMin,
      prazoHoras: PRAZO_REAGENDAMENTO_HORAS,
      prazos,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  renovarSessaoOTP(request, resposta, dados.paciente.id)
  return resposta
}
