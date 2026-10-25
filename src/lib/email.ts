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
import nodemailer from 'nodemailer'
import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'America/Sao_Paulo'

/** Transporter criado preguiçosamente e cacheado por processo */
let transporterCache: nodemailer.Transporter | null = null

export function emailConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_PASS))
}

function obterTransporter(): nodemailer.Transporter {
  if (!emailConfigurado()) {
    throw new Error('SMTP não configurado (ver .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)')
  }
  if (!transporterCache) {
    transporterCache = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          }
        : undefined,
    })
  }
  return transporterCache
}

interface DadosMensagem {
  destino: string
  assunto: string
  html: string
  /** Anexo do convite (.ics) para o paciente importar no próprio calendário */
  ics?: { nomeArquivo: string; conteudo: string }
}

async function enviar(dados: DadosMensagem): Promise<boolean> {
  if (!emailConfigurado()) return false
  try {
    const transport = obterTransporter()
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: dados.destino,
      subject: dados.assunto,
      html: dados.html,
      attachments: dados.ics
        ? [
            {
              filename: dados.ics.nomeArquivo,
              content: dados.ics.conteudo,
              contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            },
          ]
        : undefined,
    })
    return true
  } catch (erro) {
    // E-mail é um extra: nunca deve derrubar confirmarços de agendamento
    console.error('[E-mail] Falha ao enviar:', erro)
    return false
  }
}

/** Layout base dos e-mails: simples, elegante, com o detalhe visual da marca */
function layoutEmail(titulo: string, corpoHtml: string): string {
  return `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
    <div style="background:#0f766e;color:#ffffff;padding:24px 32px">
      <h1 style="margin:0;font-size:20px;font-weight:600">${titulo}</h1>
    </div>
    <div style="padding:32px;color:#333333;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7">
      ${corpoHtml}
    </div>
    <div style="padding:16px 32px;background:#f8fafc;color:#8a8a8a;font-size:12px;font-family:Helvetica,Arial,sans-serif">
      Você está recebendo porque agendou uma consulta pelo site do consultório.
      Não responda a este e-mail — use o código do agendamento no próprio site para cancelar ou remarcar.
    </div>
  </div>`
}

interface DadosConsultaEmail {
  codigo: string
  pacienteNome: string
  pacienteEmail: string
  servicoNome: string
  dataHora: Date
  duracaoMin: number
  dentistaNome: string
  clinicaNome: string
  clinicaTelefone: string
  /** URL para consultar/cancelar/remarcar sem login */
  linkGestao: string
  /** Conteúdo do arquivo .ics para anexo */
  ics?: string
  nomeArquivoIcs?: string
}

function dataBonita(d: Date): string {
  const data = formatInTimeZone(d, TZ, "EEEE, d 'de' MMMM 'de' yyyy")
  const hora = formatInTimeZone(d, TZ, 'HH:mm')
  const maiuscula = data.charAt(0).toUpperCase() + data.slice(1)
  return `${maiuscula} às ${hora}`
}

/** E-mail de confirmação com o convite (.ics) anexado */
export async function enviarConfirmacao(d: DadosConsultaEmail): Promise<boolean> {
  const html = layoutEmail(
    'Sua consulta está agendada 💚',
    `
    <p>Olá, <strong>${d.pacienteNome}</strong>!</p>
    <p>Recebemos o seu agendamento. Prontinho: 😊</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${d.servicoNome}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Data e hora</td><td style="padding:6px"><strong>${dataBonita(d.dataHora)}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Duração</td><td style="padding:6px">cerca de ${d.duracaoMin} minutos</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Profissional</td><td style="padding:6px">${d.dentistaNome} — ${d.clinicaNome}</td></tr>
    </table>
    <p style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:12px 16px">
      Guarde este código: <strong style="font-size:18px;letter-spacing:1px">${d.codigo}</strong><br>
      Com ele + seu telefone você pode <a href="${d.linkGestao}">consultar, cancelar ou remarcar</a> no site, sem login.
    </p>
    <p>Anexamos o convite da consulta (.ics) para adicionar ao seu calendário. Lembre-se de chegar uns 10 minutos antes. 😉</p>
    `
  )
  return enviar({
    destino: d.pacienteEmail,
    assunto: `Confirmação de consulta — ${d.clinicaNome} (${dataBonita(d.dataHora)})`,
    html,
    ics: d.ics ? { nomeArquivo: d.nomeArquivoIcs || 'convite-consulta.ics', conteudo: d.ics } : undefined,
  })
}

/** E-mail de cancelamento da consulta */
export async function enviarCancelamento(d: DadosConsultaEmail): Promise<boolean> {
  const html = layoutEmail(
    'Consulta cancelada',
    `
    <p>Olá, <strong>${d.pacienteNome}</strong>.</p>
    <p>A consulta abaixo foi <strong>cancelada</strong> conforme solicitado:</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${d.servicoNome}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Data e hora</td><td style="padding:6px"><s>${dataBonita(d.dataHora)}</s></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Código</td><td style="padding:6px">${d.codigo}</td></tr>
    </table>
    <p>Se foi um engano ou quiser escolher outro horário, estaremos felizes em recebê-lo:
       <a href="${d.linkGestao}">agendar nova consulta</a>.</p>
    `
  )
  return enviar({
    destino: d.pacienteEmail,
    assunto: `Consulta cancelada — ${d.clinicaNome}`,
    html,
  })
}

/** E-mail de remarcação da consulta */
export async function enviarRemarcacao(d: DadosConsultaEmail, dataHoraAnterior: Date): Promise<boolean> {
  const html = layoutEmail(
    'Consulta remarcada 🗓️',
    `
    <p>Olá, <strong>${d.pacienteNome}</strong>!</p>
    <p>Sua consulta foi <strong>remarcada</strong>:</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Era</td><td style="padding:6px"><s>${dataBonita(dataHoraAnterior)}</s></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Agora é</td><td style="padding:6px"><strong>${dataBonita(d.dataHora)}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${d.servicoNome}</strong></td></tr>
    </table>
    <p>O convite do seu calendário foi atualizado e está anexado novamente. Até lá! 🌸</p>
    `
  )
  return enviar({
    destino: d.pacienteEmail,
    assunto: `Consulta remarcada — ${d.clinicaNome}`,
    html: html,
    // Convite atualizado (.ics) segue em anexo quando o chamador fornecer
    ics: d.ics ? { nomeArquivo: d.nomeArquivoIcs || 'convite-consulta.ics', conteudo: d.ics } : undefined,
  })
}

/** Base do link público para o paciente gerir sua própria consulta */
export function linkGestao(codigo: string): string {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
  return `${base}/agendar?consulta=${encodeURIComponent(codigo)}`
}
