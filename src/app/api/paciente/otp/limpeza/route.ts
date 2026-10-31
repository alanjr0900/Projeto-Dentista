import { NextResponse } from 'next/server'
import { limparRegistrosOTP } from '@/lib/paciente-otp'
import { mensagemSegura } from '@/lib/log-seguro'

/**
 * POST /api/paciente/otp/limpeza
 *
 * Remove códigos expirados, contadores antigos e auditoria vencida.
 * Protegido por CRON_SECRET para ser chamado por um agendador externo
 * (Vercel Cron, Task Scheduler, cron do servidor). Em desenvolvimento, sem
 * CRON_SECRET, a própria rota de login já faz uma limpeza "preguiçosa".
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    await limparRegistrosOTP()
    return NextResponse.json({ sucesso: true })
  } catch (erro) {
    console.error('[OTP Limpeza] Erro:', mensagemSegura(erro))
    return NextResponse.json({ erro: 'Erro na limpeza' }, { status: 500 })
  }
}
