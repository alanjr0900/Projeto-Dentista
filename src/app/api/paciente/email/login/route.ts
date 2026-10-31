import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ipDaRequisicao } from '@/lib/paciente-rate-limit'
import {
  MENSAGEM_NEUTRA_ENVIO,
  aguardarRespostaNeutra,
  buscarPacientePorEmail,
  gerarCodigoOTP,
  hashCodigo,
  normalizarEmail,
  reservarEnvio,
  salvarCodigoOTP,
  talvezLimparRegistrosOTP,
  verificarBloqueioEmail,
} from '@/lib/paciente-otp'
import { enviarCodigoAcesso } from '@/lib/email'
import { mensagemSegura } from '@/lib/log-seguro'

const emailSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(160),
})

/**
 * POST /api/paciente/email/login
 *
 * Pede um código de acesso. A resposta é SEMPRE a mesma (200 + mensagem
 * neutra) quando o formato do e-mail é válido — exista ou não o cadastro.
 * O tempo também é padronizado por `aguardarRespostaNeutra`.
 *
 * O envio em si é feito fora do caminho da resposta para que a duração não
 * dependa do servidor SMTP (o processo do Next continua ativo neste projeto).
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now()

  try {
    const body = await request.json().catch(() => null)
    const resultado = emailSchema.safeParse(body)

    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Informe um e-mail válido.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const email = normalizarEmail(resultado.data.email)
    const ip = ipDaRequisicao(request)

    // Passos iguais para e-mail existente ou não (evita enumeração).
    const paciente = await buscarPacientePorEmail(email)
    const bloqueadoAte = paciente ? await verificarBloqueioEmail(paciente.id) : null
    const reserva = await reservarEnvio(email, ip)

    if (paciente && !bloqueadoAte && reserva.permitido) {
      const codigo = gerarCodigoOTP()
      await salvarCodigoOTP(paciente.id, codigo)

      // Não aguarda o SMTP: a resposta não pode revelar a existência do e-mail.
      void enviarCodigoAcesso(email, paciente.nome, codigo).catch(erro => {
        console.error('[OTP] Falha inesperada no envio do código:', mensagemSegura(erro))
      })
    } else {
      // Trabalho equivalente quando não há envio (hash descartado).
      hashCodigo(gerarCodigoOTP())
    }

    void talvezLimparRegistrosOTP()
    await aguardarRespostaNeutra(inicio)

    return NextResponse.json(
      {
        mensagem: MENSAGEM_NEUTRA_ENVIO,
        // Sempre o mesmo valor: o contador do botão é local, no cliente.
        reenviarEm: 60,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (erro) {
    console.error('[OTP Login] Erro:', mensagemSegura(erro))
    await aguardarRespostaNeutra(inicio)
    return NextResponse.json(
      { mensagem: MENSAGEM_NEUTRA_ENVIO, reenviarEm: 60 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
