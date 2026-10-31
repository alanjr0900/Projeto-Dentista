import nodemailer from 'nodemailer'
import type { OpcoesEmail, ResultadoEnvio } from '../service'
import { mensagemSegura } from '../../log-seguro'

/**
 * Provedor SMTP — funciona com Brevo, Gmail (senha de app), Resend SMTP,
 * SendGrid e qualquer servidor SMTP compatível.
 *
 * Configurações lidas de (todas em variáveis de ambiente):
 * - SMTP_HOST (ex.: smtp-relay.brevo.com)
 * - SMTP_PORT (ex.: 587 ou 465)
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM (e-mail verificado no provedor)
 * - EMAIL_FROM_NAME (nome exibido; opcional)
 */
let cache: { chave: string; transporter: nodemailer.Transporter } | null = null

function env(nome: string): string {
  return (process.env[nome] || '').trim()
}

function obterTransporte() {
  const host = env('SMTP_HOST')
  const port = Number(env('SMTP_PORT') || 587)
  const user = env('SMTP_USER')
  const pass = env('SMTP_PASS')

  if (!host || !user || !pass) {
    throw new Error('SMTP não configurado (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)')
  }

  const chave = `${host}:${port}:${user}`
  if (!cache || cache.chave !== chave) {
    cache = {
      chave,
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { minVersion: 'TLSv1.2' },
      }),
    }
  }
  return cache.transporter
}

export async function enviarViaBrevo(opcoes: OpcoesEmail): Promise<ResultadoEnvio> {
  const remetente = env('SMTP_FROM')
  if (!remetente) {
    return { sucesso: false, erro: 'SMTP_FROM não configurado' }
  }

  const nomeRemetente = env('EMAIL_FROM_NAME') || 'Dra. Luciana'

  try {
    const transporte = obterTransporte()
    await transporte.sendMail({
      from: { name: nomeRemetente, address: remetente },
      to: opcoes.para,
      subject: opcoes.assunto,
      text: opcoes.texto,
      html: opcoes.html,
      ...(opcoes.responderPara ? { replyTo: opcoes.responderPara } : {}),
      ...(opcoes.anexos?.length
        ? {
            attachments: opcoes.anexos.map(anexo => ({
              filename: anexo.filename,
              content: anexo.content,
              contentType: anexo.contentType,
            })),
          }
        : {}),
    })
    return { sucesso: true }
  } catch (erro) {
    // Nunca inclua o destinatário na mensagem de erro/log.
    return {
      sucesso: false,
      erro: mensagemSegura(erro),
    }
  }
}
