import { NextRequest, NextResponse } from 'next/server'
import { pacienteDaSessaoOTP } from '@/lib/paciente-api'
import { diagnosticosLiberados, registrarAcessoDiagnosticos } from '@/lib/paciente-consulta'
import { renovarSessaoOTP } from '@/lib/paciente-sessao-otp'
import { ipDaRequisicao } from '@/lib/paciente-rate-limit'

/**
 * GET /api/paciente/email/diagnosticos
 *
 * Diagnósticos que a dentista liberou para o PRÓPRIO paciente da sessão.
 * Exige o cookie HttpOnly assinado no servidor. Registra o acesso (LGPD):
 * quando e quais registros foram lidos — nunca o conteúdo.
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
  const diagnosticos = await diagnosticosLiberados(paciente.id)

  await registrarAcessoDiagnosticos({
    pacienteId: paciente.id,
    agendamentoId: paciente.agendamentos[0]?.id ?? null,
    registros: diagnosticos.map(item => item.id),
    ip: ipDaRequisicao(request),
  })

  const resposta = NextResponse.json(
    {
      diagnosticos: diagnosticos.map(item => ({
        id: item.id,
        texto: item.texto,
        criadoEm: item.criadoEm.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  renovarSessaoOTP(request, resposta, paciente.id)
  return resposta
}
