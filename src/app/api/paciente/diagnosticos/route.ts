import { NextRequest, NextResponse } from 'next/server'
import { agendamentoDaSessao } from '@/lib/paciente-api'
import { diagnosticosLiberados, registrarAcessoDiagnosticos } from '@/lib/paciente-consulta'
import { ipDaRequisicao } from '@/lib/paciente-rate-limit'

/**
 * Diagnósticos liberados para o PRÓPRIO paciente.
 *
 * Exige sessão de nível "completo" (código + data de nascimento/finais do
 * telefone). Só devolve notas marcadas como liberadas pela dentista e
 * registra o acesso (quando e quais registros — nunca o conteúdo).
 */
export async function GET(request: NextRequest) {
  const dados = await agendamentoDaSessao(request)
  if (!dados) {
    return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
  }

  const { sessao, agendamento } = dados
  if (sessao.nivel !== 'completo') {
    return NextResponse.json(
      { erro: 'Para ver os diagnósticos, confirme sua identidade com a data de nascimento ou os 4 últimos dígitos do telefone.' },
      { status: 403 }
    )
  }

  if (!agendamento.pacienteId) {
    return NextResponse.json({ registros: [] })
  }

  const registros = await diagnosticosLiberados(agendamento.pacienteId)

  await registrarAcessoDiagnosticos({
    pacienteId: agendamento.pacienteId,
    agendamentoId: agendamento.id,
    registros: registros.map(r => r.id),
    ip: ipDaRequisicao(request),
  })

  return NextResponse.json({
    registros: registros.map(r => ({
      id: r.id,
      texto: r.texto,
      criadoEm: r.criadoEm.toISOString(),
    })),
  })
}
