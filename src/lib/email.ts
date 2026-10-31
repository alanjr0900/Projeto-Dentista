/**
 * Envio de e-mail confirmations/cancelamento ao paciente — Nodemailer com
 * SMTP genérico (Gmail com senha de app, Resend SMTP, SendGrid, etc.).
 *
 * Fallback silencioso: enquanto SMTP_HOST/SMTP_* não existirem no .env,
 * `emailConfigurado()` devolve false e nada é enviado — o site segui funcionando
 * e o paciente recebe o código da consulta na tela (e o convite pelo próprio
 * Google quando a integração Calendar estiver ativa).
 *
 * Convenção LGPD: enviado apenas quando o paciente informa o e-mail e
 * CONSENTE explicitamente em receber confirmações (campo `aceite` do formulário).
 */
import {
  emailConfigurado,
  enviarCodigoAcesso,
  enviarCancelamento,
  enviarConfirmacao,
  enviarRemarcacao,
  linkGestao,
} from './email-provider'

export {
  emailConfigurado,
  enviarCodigoAcesso,
  enviarCancelamento,
  enviarConfirmacao,
  enviarRemarcacao,
  linkGestao,
}

