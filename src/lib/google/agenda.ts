/**
 * Camada de INTEGRAÇÃO com o Google Calendar — isolada de propósito para ser
 * fácil de trocar ou evoluir depois.
 *
 * Autenticação: conta de serviço (service account) — a mais simples e segura
 * para UM calendário fixo. O e-mail da conta de serviço precisa ter acesso
 * de "editor" ao calendário da doutora (ver README, passo a passo).
 *
 * Pontos de design:
 * - `googleAtivo()` devolve true SOMENTE se as 3 variáveis existirem no .env.
 *   Sem credenciais, o site funciona normalmente com a agenda do banco (fallback).
 * - Falhas de rede/credenciais não derrubam o site: `janelasOcupadas` devolve
 *   [] e registra no console; criação/remoção de evento lançam erro que os
 *   chamadores tratam.
 * - Horários em offset fixo -03:00 (São Paulo não tem horário de verão desde 2019).
 */
import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'America/Sao_Paulo'

const config = {
  get calendarId() {
    return process.env.GOOGLE_CALENDAR_ID || ''
  },
  get clientEmail() {
    return process.env.GOOGLE_CLIENT_EMAIL || ''
  },
  get privateKey() {
    // A chave vem do .env com \n literais; o JWT exige as quebras reais
    return (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  },
}

/** A integração só liga quando as 3 variáveis existem */
export function googleAtivo(): boolean {
  return Boolean(config.calendarId && config.clientEmail && config.privateKey)
}

/** Cliente do Calendar criado uma única vez por processo (JWT da service account) */
let clienteCache: calendar_v3.Calendar | null = null

function obterCliente(): calendar_v3.Calendar {
  if (!googleAtivo()) {
    throw new Error(
      'Integração Google Calendar não configurada (ver .env: GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)'
    )
  }
  if (!clienteCache) {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      // Escopo mínimo: apenas eventos (criar/alterar/consultar)
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    })
    clienteCache = google.calendar({ version: 'v3', auth })
  }
  return clienteCache
}

/** Bloqueio de agenda vindo do calendário do Google */
export interface JanelaOcupada {
  /** ID do evento no Google (usado para ignorar o próprio evento em remarcação) */
  id: string
  inicio: Date
  fim: Date
  titulo: string
}

/**
 * Horários ocupados dentro de um intervalo, lidos do calendário.
 * Usa events.list com singleEvents (instâncias de repetições vêm "abertas"),
 * devolvendo também os IDs — o que permite ignorar um evento específico.
 */
export async function janelasOcupadas(
  inicio: Date,
  fim: Date
): Promise<JanelaOcupada[]> {
  if (!googleAtivo()) return []
  try {
    const cal = obterCliente()
    const resposta = await cal.events.list({
      calendarId: config.calendarId,
      timeMin: inicio.toISOString(),
      timeMax: fim.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    })
    return (resposta.data.items || [])
      .filter(e => e.status !== 'cancelled') // backups excluídos não ocupam horário
      .map(e => ({
        id: e.id || '',
        inicio: new Date(e.start?.dateTime || e.start?.date || inicio),
        fim: new Date(e.end?.dateTime || e.end?.date || fim),
        titulo: e.summary || '',
      }))
      // Eventos "do sistema" que criamos para bloquear horários também ocupam:
      // aqui vale tudo que estiver no calendário.
  } catch (erro) {
    console.error('[Google Calendar] Falha ao consultar ocupação:', erro)
    return [] // degrada para "não sei"; o banco continua sendo o piso de proteção
  }
}

/**
 * Double-check antes de gravar: o horário continua livre no Google?
 * `ignorarEventoId` é usado na REMARCAÇÃO: o evento sendo movido não pode
 * bloquear o próprio novo horário.
 */
export async function horarioLivre(
  inicio: Date,
  fim: Date,
  ignorarEventoId?: string | null
): Promise<{ livre: boolean; motivo?: string }> {
  if (!googleAtivo()) return { livre: true }
  const ocupados = await janelasOcupadas(inicio, fim)
  for (const janela of ocupados) {
    if (ignorarEventoId && janela.id === ignorarEventoId) continue
    const sobrepoe = inicio < janela.fim && fim > janela.inicio
    if (sobrepoe) {
      return {
        livre: false,
        motivo: 'Este horário acabou de ser ocupado no calendário. Escolha outro.',
      }
    }
  }
  return { livre: true }
}

/** Dados do evento do paciente no calendário da doutora */
export interface DadosEventoConsulta {
  codigo: string
  pacienteNome: string
  pacienteTelefone: string
  pacienteEmail?: string | null
  servicoNome: string
  dentistaNome: string
  inicio: Date
  fim: Date
  observacoes?: string | null
}

/** Descrição do evento com TODOS os dados pedidos no documento */
function descricaoEvento(d: DadosEventoConsulta): string {
  return [
    `Código do agendamento: ${d.codigo}`,
    `Paciente: ${d.pacienteNome}`,
    `Telefone: ${d.pacienteTelefone}`,
    d.pacienteEmail ? `E-mail: ${d.pacienteEmail}` : null,
    `Serviço: ${d.servicoNome}`,
    `Profissional: ${d.dentistaNome}`,
    d.observacoes ? `Observações: ${d.observacoes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Formato RFC3339 com offset fixo -03:00 (São Paulo) */
function formatoFuso(data: Date): string {
  return formatInTimeZone(data, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/** Cria o evento no calendário da doutora e devolve o ID dele */
export async function criarEvento(d: DadosEventoConsulta): Promise<string> {
  const cal = obterCliente()
  const resposta = await cal.events.insert({
    calendarId: config.calendarId,
    requestBody: {
      summary: `Consulta: ${d.pacienteNome} — ${d.servicoNome}`,
      description: descricaoEvento(d),
      start: { dateTime: formatoFuso(d.inicio), timeZone: TZ },
      end: { dateTime: formatoFuso(d.fim), timeZone: TZ },
      // Com e-mail do paciente, o próprio Google envia o convite/confirmação
      attendees: d.pacienteEmail ? [{ email: d.pacienteEmail }] : [],
      colorId: '2', // tom suave no calendário da doutora
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 dia antes
          { method: 'popup', minutes: 2 * 60 },  // 2 horas antes
        ],
      },
    },
    // Notifica presences sobre o convite (e-mail ao paciente)
    sendUpdates: 'all',
  })
  if (!resposta.data.id) throw new Error('Google não devolveu ID do evento')
  return resposta.data.id
}

/** Move o evento para o novo horário/serviço (remarcação) */
export async function moverEvento(
  eventoId: string,
  d: DadosEventoConsulta
): Promise<void> {
  const cal = obterCliente()
  await cal.events.update({
    calendarId: config.calendarId,
    eventId: eventoId,
    requestBody: {
      summary: `Consulta: ${d.pacienteNome} — ${d.servicoNome}`,
      description: descricaoEvento(d),
      start: { dateTime: formatoFuso(d.inicio), timeZone: TZ },
      end: { dateTime: formatoFuso(d.fim), timeZone: TZ },
      attendees: d.pacienteEmail ? [{ email: d.pacienteEmail }] : [],
    },
    sendUpdates: 'all',
  })
}

/** Exclui o evento (cancelamento) */
export async function excluirEvento(eventoId: string): Promise<void> {
  const cal = obterCliente()
  await cal.events.delete({ calendarId: config.calendarId, eventId: eventoId })
}
