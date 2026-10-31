/**
 * Camada isolada de envio de e-mail — o resto do sistema só conhece
 * `enviarEmail()`. Para trocar de provedor:
 *
 *  1. implemente o provedor em `providers/` (ex.: `providers/resend.ts`);
 *  2. adicione um `case` abaixo;
 *  3. defina `EMAIL_PROVIDER` no .env.
 *
 * Nenhuma chave/remetente fica neste arquivo: tudo vem de variáveis de
 * ambiente. O arquivo `providers/brevo.ts` já funciona com QUALQUER SMTP
 * (Brevo, Gmail, Resend SMTP, SendGrid, etc.).
 */
export interface AnexoEmail {
  filename: string
  content: string | Buffer
  contentType?: string
}

export interface OpcoesEmail {
  para: string
  assunto: string
  texto: string
  html?: string
  anexos?: AnexoEmail[]
  responderPara?: string
}

/** Resultado padrão para o chamador não precisar conhecer o provedor. */
export interface ResultadoEnvio {
  sucesso: boolean
  erro?: string
}

/** Remove e-mails/códigos de qualquer mensagem de erro antes de logar. */
import { mensagemSegura } from '../log-seguro'
export { mensagemSegura }

/** Envia um e-mail usando o provedor configurado. */
export async function enviarEmail(opcoes: OpcoesEmail): Promise<ResultadoEnvio> {
  const provedor = (process.env.EMAIL_PROVIDER || 'brevo').trim().toLowerCase()

  try {
    switch (provedor) {
      case 'brevo':
      case 'smtp': {
        const { enviarViaBrevo } = await import('./providers/brevo')
        return await enviarViaBrevo(opcoes)
      }
      default:
        return { sucesso: false, erro: `Provedor de e-mail desconhecido: ${provedor}` }
    }
  } catch (erro) {
    return {
      sucesso: false,
      erro: mensagemSegura(erro),
    }
  }
}

/** Verifica se o e-mail está configurado (para modo silencioso). */
export function emailConfigurado(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM?.trim()
  )
}
