import { NextRequest, NextResponse } from 'next/server'
import { agendamentoDaSessao } from '@/lib/paciente-api'
import { listarHorariosLivres } from '@/lib/paciente-consulta'
import { avaliarPrazos } from '@/lib/paciente-prazos'
import { PRAZO_REAGENDAMENTO_HORAS } from '@/lib/prazos'

/**
 * Horários LIVRES para remarcar (somente).
 *
 * Nunca devolve nomes, serviços de outros pacientes ou detalhes de horários
 * ocupados. Exige sessão válida e respeita o prazo mínimo no servidor.
 */
export async function GET(request: NextRequest) {
  const dados = await agendamentoDaSessao(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  const prazos = avaliarPrazos(dados.agendamento)
  if (!prazos.podeRemarcar) {
    return NextResponse.json(
      { erro: prazos.motivoRemarcacao || 'Remarcação não permitida', codigo: 'PRAZO' },
      { status: 422 }
    )
  }

  const { dias, duracaoMin } = await listarHorariosLivres(dados.agendamento)

  return NextResponse.json({ dias, duracaoMin, prazoHoras: PRAZO_REAGENDAMENTO_HORAS })
}
