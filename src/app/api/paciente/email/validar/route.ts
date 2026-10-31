import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ipDaRequisicao } from '@/lib/paciente-rate-limit'
import {
  buscarPacientePorEmail,
  hashCodigo,
  normalizarEmail,
  registrarTentativaAcesso,
  validarCodigoOTP,
} from '@/lib/paciente-otp'
import {
  COOKIE_SESSAO_PACIENTE_OTP,
  criarTokenSessaoOTP,
  opcoesCookieSessaoOTP,
} from '@/lib/paciente-sessao-otp'
import { mensagemSegura } from '@/lib/log-seguro'

const validarSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(160),
  codigo: z.string().trim().regex(/^\d{6}$/, 'O código deve ter 6 dígitos'),
})

const ERRO_GENERICO = 'Código inválido ou expirado.'

/**
 * POST /api/paciente/email/validar
 *
 * Valida o código e cria a sessão do paciente. A mensagem de erro é genérica
 * (não revela se o e-mail existe, se o código expirou ou se já foi usado).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const resultado = validarSchema.safeParse(body)

    if (!resultado.success) {
      return NextResponse.json(
        { erro: ERRO_GENERICO },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const email = normalizarEmail(resultado.data.email)
    const codigo = resultado.data.codigo
    const ip = ipDaRequisicao(request)

    const paciente = await buscarPacientePorEmail(email)
    if (!paciente) {
      // Mesmo custo de hash do caminho normal, mesma resposta.
      hashCodigo(codigo)
      await registrarTentativaAcesso({
        email,
        ip,
        sucesso: false,
        motivo: 'email_nao_encontrado',
      })
      return NextResponse.json(
        { erro: ERRO_GENERICO },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const validacao = await validarCodigoOTP(paciente.id, codigo)

    await registrarTentativaAcesso({
      email,
      ip,
      sucesso: validacao.valido,
      motivo: validacao.valido ? 'sucesso' : validacao.motivo,
    })

    if (!validacao.valido) {
      const mensagem =
        validacao.motivo === 'bloqueado'
          ? 'Muitas tentativas. Por segurança, aguarde alguns minutos e tente novamente.'
          : validacao.motivo === 'tentativas'
            ? 'Muitas tentativas. Peça um novo código.'
            : ERRO_GENERICO
      return NextResponse.json(
        { erro: mensagem },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const resposta = NextResponse.json(
      { sucesso: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    resposta.cookies.set(
      COOKIE_SESSAO_PACIENTE_OTP,
      criarTokenSessaoOTP(paciente.id),
      opcoesCookieSessaoOTP(request)
    )
    return resposta
  } catch (erro) {
    console.error('[OTP Validar] Erro:', mensagemSegura(erro))
    return NextResponse.json(
      { erro: 'Não foi possível validar agora. Tente novamente.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
