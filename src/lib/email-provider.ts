/**
 * Templates de e-mail do consultório.
 *
 * O ENVIO fica em `src/lib/email/service.ts` (provedor trocável). Este arquivo
 * só monta o conteúdo e chama `enviarEmail()`. Chaves e remetente continuam
 * exclusivamente em variáveis de ambiente.
 *
 * Convenção LGPD: e-mails de confirmação/cancelamento/remarcação só são
 * enviados quando o paciente informou o e-mail no agendamento.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { emailConfigurado, enviarEmail } from './email/service'

const TZ = 'America/Sao_Paulo'

export { emailConfigurado }

/** URL pública do site, sem domínio fixo no código. */
export function urlPublica(): string {
  const base = (process.env.PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL || '').trim()
  return base.replace(/\/+$/, '')
}

/** Link público para o paciente gerir a consulta (sem identificadores na URL). */
export function linkGestao(_codigo: string): string {
  const base = urlPublica()
  return base ? `${base}/minha-consulta` : '/minha-consulta'
}

/**
 * Código temporário de acesso à "Minha consulta".
 * Texto simples, acolhedor, no tom da Dra. Luciana.
 */
export async function enviarCodigoAcesso(
  email: string,
  nome: string,
  codigo: string
): Promise<boolean> {
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome

  const texto = [
    `Olá, ${primeiroNome}!`,
    '',
    `Seu código de acesso para "Minha consulta" é: ${codigo}`,
    '',
    'Ele vale por 10 minutos e pode ser usado uma única vez.',
    'Se você não pediu este código, pode ignorar este e-mail — nada foi alterado.',
    '',
    'Com carinho,',
    'Dra. Luciana',
  ].join('\n')

  const html = layoutEmail(
    'Seu código de acesso',
    `
    <p>Olá, <strong>${escapeHtml(primeiroNome)}</strong>!</p>
    <p>Seu código para acessar <strong>Minha consulta</strong> é:</p>
    <p style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
      <strong style="font-size:34px;letter-spacing:6px;color:#0f766e">${codigo}</strong>
    </p>
    <p>Ele vale por <strong>10 minutos</strong> e pode ser usado uma única vez.</p>
    <p>Se você não pediu este código, pode ignorar este e-mail — nada foi alterado.</p>
    <p>Com carinho,<br><strong>Dra. Luciana</strong></p>
  `
  )

  const resultado = await enviarEmail({
    para: email,
    assunto: 'Seu código de acesso — Minha consulta',
    texto,
    html,
  })

  if (!resultado.sucesso) {
    console.error('[Email] Falha ao enviar código de acesso:', resultado.erro)
  }
  return resultado.sucesso
}

/** Envia e-mail de confirmação de agendamento. */
export async function enviarConfirmacao(dados: {
  codigo: string
  pacienteNome: string
  pacienteEmail: string
  servicoNome: string
  dataHora: Date
  duracaoMin: number
  dentistaNome: string
  clinicaNome: string
  clinicaTelefone: string
  linkGestao: string
  ics?: string
  nomeArquivoIcs?: string
}): Promise<boolean> {
  if (!emailConfigurado()) return false

  const dataBonita = formatarDataBonita(dados.dataHora)

  const texto = [
    `Olá, ${dados.pacienteNome}!`,
    '',
    'Sua consulta está agendada:',
    `Serviço: ${dados.servicoNome}`,
    `Data e hora: ${dataBonita}`,
    `Duração: cerca de ${dados.duracaoMin} minutos`,
    `Profissional: ${dados.dentistaNome} — ${dados.clinicaNome}`,
    '',
    `Código da consulta: ${dados.codigo}`,
    `Acesse ${dados.linkGestao} com seu e-mail para ver diagnósticos, remarcar ou cancelar.`,
    '',
    'Anexamos o convite (.ics) para a sua agenda. Chegue uns 10 minutos antes. 😉',
  ].join('\n')

  const html = layoutEmail(
    'Sua consulta está agendada 💚',
    `
    <p>Olá, <strong>${escapeHtml(dados.pacienteNome)}</strong>!</p>
    <p>Recebemos o seu agendamento. Prontinho: 😊</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${escapeHtml(dados.servicoNome)}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Data e hora</td><td style="padding:6px"><strong>${dataBonita}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Duração</td><td style="padding:6px">cerca de ${dados.duracaoMin} minutos</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Profissional</td><td style="padding:6px">${escapeHtml(dados.dentistaNome)} — ${escapeHtml(dados.clinicaNome)}</td></tr>
    </table>
    <p style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:12px 16px">
      Guarde o código da consulta: <strong style="font-size:18px;letter-spacing:1px">${dados.codigo}</strong><br>
      No site, acesse <a href="${dados.linkGestao}">Minha consulta</a> com seu e-mail para ver diagnósticos liberados, cancelar ou remarcar.
    </p>
    <p>Anexamos o convite da consulta (.ics) para adicionar ao seu calendário. Lembre-se de chegar uns 10 minutos antes. 😉</p>
    `
  )

  const resultado = await enviarEmail({
    para: dados.pacienteEmail,
    assunto: `Confirmação de consulta — ${dados.clinicaNome} (${dataBonita})`,
    texto,
    html,
    anexos: dados.ics
      ? [
          {
            filename: dados.nomeArquivoIcs || 'convite-consulta.ics',
            content: dados.ics,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ]
      : undefined,
  })

  if (!resultado.sucesso) {
    console.error('[Email] Falha ao enviar confirmação:', resultado.erro)
  }
  return resultado.sucesso
}

/** Envia e-mail de cancelamento. */
export async function enviarCancelamento(dados: {
  codigo: string
  pacienteNome: string
  pacienteEmail: string
  servicoNome: string
  dataHora: Date
  duracaoMin: number
  dentistaNome: string
  clinicaNome: string
  clinicaTelefone: string
  linkGestao: string
}): Promise<boolean> {
  if (!emailConfigurado()) return false

  const dataBonita = formatarDataBonita(dados.dataHora)

  const texto = [
    `Olá, ${dados.pacienteNome}.`,
    '',
    'A consulta abaixo foi cancelada conforme solicitado:',
    `Serviço: ${dados.servicoNome}`,
    `Data e hora: ${dataBonita}`,
    `Código: ${dados.codigo}`,
    '',
    `Se foi um engano ou quiser escolher outro horário, acesse ${dados.linkGestao}.`,
  ].join('\n')

  const html = layoutEmail(
    'Consulta cancelada',
    `
    <p>Olá, <strong>${escapeHtml(dados.pacienteNome)}</strong>.</p>
    <p>A consulta abaixo foi <strong>cancelada</strong> conforme solicitado:</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${escapeHtml(dados.servicoNome)}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Data e hora</td><td style="padding:6px">${dataBonita}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Código</td><td style="padding:6px">${dados.codigo}</td></tr>
    </table>
    <p>Se foi um engano ou quiser escolher outro horário, estaremos felizes em recebê-lo:
       <a href="${dados.linkGestao}">acessar minha consulta</a>.</p>
    `
  )

  const resultado = await enviarEmail({
    para: dados.pacienteEmail,
    assunto: `Consulta cancelada — ${dados.clinicaNome}`,
    texto,
    html,
  })

  if (!resultado.sucesso) {
    console.error('[Email] Falha ao enviar cancelamento:', resultado.erro)
  }
  return resultado.sucesso
}

/** Envia e-mail de remarcação. */
export async function enviarRemarcacao(
  dados: {
    codigo: string
    pacienteNome: string
    pacienteEmail: string
    servicoNome: string
    dataHora: Date
    duracaoMin: number
    dentistaNome: string
    clinicaNome: string
    clinicaTelefone: string
    linkGestao: string
    ics?: string
    nomeArquivoIcs?: string
  },
  dataHoraAnterior: Date
): Promise<boolean> {
  if (!emailConfigurado()) return false

  const novaData = formatarDataBonita(dados.dataHora)
  const dataAnterior = formatarDataBonita(dataHoraAnterior)

  const texto = [
    `Olá, ${dados.pacienteNome}!`,
    '',
    'Sua consulta foi remarcada:',
    `Era: ${dataAnterior}`,
    `Agora é: ${novaData}`,
    `Serviço: ${dados.servicoNome}`,
    '',
    'O convite do seu calendário foi atualizado e está anexado novamente. Até lá! 🌸',
  ].join('\n')

  const html = layoutEmail(
    'Consulta remarcada 🗓️',
    `
    <p>Olá, <strong>${escapeHtml(dados.pacienteNome)}</strong>!</p>
    <p>Sua consulta foi <strong>remarcada</strong>:</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><td style="padding:6px 12px 6px 0;color:#666">Era</td><td style="padding:6px">${dataAnterior}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Agora é</td><td style="padding:6px"><strong>${novaData}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">Serviço</td><td style="padding:6px"><strong>${escapeHtml(dados.servicoNome)}</strong></td></tr>
    </table>
    <p>O convite do seu calendário foi atualizado e está anexado novamente. Até lá! 🌸</p>
    `
  )

  const resultado = await enviarEmail({
    para: dados.pacienteEmail,
    assunto: `Consulta remarcada — ${dados.clinicaNome}`,
    texto,
    html,
    anexos: dados.ics
      ? [
          {
            filename: dados.nomeArquivoIcs || 'convite-consulta.ics',
            content: dados.ics,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ]
      : undefined,
  })

  if (!resultado.sucesso) {
    console.error('[Email] Falha ao enviar remarcação:', resultado.erro)
  }
  return resultado.sucesso
}

/** Layout base dos e-mails. */
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
      Você está recebendo porque agendou ou pediu acesso a uma consulta pelo site do consultório.
      Se não reconhece este e-mail, ignore-o.
    </div>
  </div>`
}

function formatarDataBonita(d: Date): string {
  return formatInTimeZone(d, TZ, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
