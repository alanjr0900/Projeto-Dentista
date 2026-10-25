import ical, {
  ICalAlarmType,
  ICalCalendarMethod,
  ICalEventBusyStatus,
  ICalEventStatus,
  ICalEventTransparency,
} from 'ical-generator'
import { formatInTimeZone } from 'date-fns-tz'
import { getConfiguracoes } from './config'

export interface DadosEventoICS {
  codigo: string
  servicoNome: string
  dataHora: Date
  duracaoMin: number
  endereco: string
  clinicaNome: string
  dentistaNome: string
  telefone: string
}

export async function gerarArquivoICS(dados: DadosEventoICS): Promise<string> {
  const cfg = await getConfiguracoes()
  
  const inicio = dados.dataHora
  const fim = new Date(inicio.getTime() + dados.duracaoMin * 60 * 1000)

  const cal = ical({
    name: cfg.clinicaNome,
    timezone: 'America/Sao_Paulo',
    prodId: { company: 'dentista-app', product: 'agendamento' },
    scale: 'GREGORIAN',
    method: ICalCalendarMethod.REQUEST,
  })

  cal.createEvent({
    id: dados.codigo,
    summary: `Consulta: ${dados.servicoNome} - ${cfg.dentistaNome}`,
    description: [
      `Código do agendamento: ${dados.codigo}`,
      `Serviço: ${dados.servicoNome}`,
      `Profissional: ${cfg.dentistaNome} (${cfg.dentistaCRO})`,
      `Local: ${cfg.clinicaNome}`,
      `Endereço: ${cfg.clinicaEndereco}`,
      `Telefone: ${cfg.clinicaTelefone}`,
      `WhatsApp: ${cfg.clinicaWhatsApp}`,
      '',
      'Este compromisso foi agendado automaticamente pelo sistema do consultório.',
      'Para cancelar ou remarcar, use o código acima no site ou entre em contato.',
      '',
      `Telefone para contato: ${dados.telefone}`,
    ].join('\n'),
    location: `${cfg.clinicaNome}, ${cfg.clinicaEndereco}`,
    start: inicio,
    end: fim,
    status: ICalEventStatus.CONFIRMED,
    busystatus: ICalEventBusyStatus.BUSY,
    transparency: ICalEventTransparency.OPAQUE,
    sequence: 0,
    created: new Date(),
    lastModified: new Date(),
    organizer: {
      name: cfg.clinicaNome,
      email: cfg.clinicaEmail || undefined,
    },
    alarms: [
      {
        triggerBefore: 24 * 60 * 60, // 24h antes (segundos)
        type: ICalAlarmType.display,
        description: `Lembrete: Consulta amanhã às ${formatInTimeZone(inicio, 'America/Sao_Paulo', 'HH:mm')}`,
      },
      {
        triggerBefore: 2 * 60 * 60, // 2h antes (segundos)
        type: ICalAlarmType.display,
        description: `Lembrete: Consulta em 2 horas às ${formatInTimeZone(inicio, 'America/Sao_Paulo', 'HH:mm')}`,
      },
    ],
  })

  return cal.toString()
}

export function gerarNomeArquivoICS(codigo: string): string {
  return `agendamento-${codigo}.ics`
}