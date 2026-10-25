import { formatInTimeZone } from 'date-fns-tz'
import { parse, isBefore, isAfter, addMinutes, startOfDay, endOfDay, setHours, setMinutes, getDay } from 'date-fns'
import { z } from 'zod'
import { getConfiguracoes, type ConfiguracoesClinica, type HorarioFuncionamento } from './config'
import { prisma } from './prisma'
import { googleAtivo, janelasOcupadas, type JanelaOcupada } from './google/agenda'

// Tipos para a lógica de disponibilidade
export type SlotDisponivel = {
  horario: string // HH:MM
  dataHoraISO: string // ISO string no timezone America/Sao_Paulo
  disponivel: boolean
}

export type DiaDisponibilidade = {
  data: string // YYYY-MM-DD
  diaSemana: number // 0-6
  slots: SlotDisponivel[]
  temDisponibilidade: boolean
}

export type PeriodoDisponibilidade = {
  dias: DiaDisponibilidade[]
  servicoDuracao: number
  timezone: string
}

// Função auxiliar: converter HH:MM para minutos desde meia-noite
function horarioParaMinutos(horario: string): number {
  const [h, m] = horario.split(':').map(Number)
  return h * 60 + m
}

// Função auxiliar: converter minutos para HH:MM
function minutosParaHorario(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0')
  const m = (minutos % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// Função pura: gerar slots teóricos para um dia baseado no horário de funcionamento
function gerarSlotsTeoricos(
  data: Date,
  horarioFuncionamento: HorarioFuncionamento[],
  duracaoServico: number,
  intervaloMinutos: number
): SlotDisponivel[] {
  const slots: SlotDisponivel[] = []

  for (const periodo of horarioFuncionamento) {
    let inicioMin = horarioParaMinutos(periodo.inicio)
    const fimMin = horarioParaMinutos(periodo.fim)

    while (inicioMin + duracaoServico <= fimMin) {
      const horarioStr = minutosParaHorario(inicioMin)
      const dataHora = new Date(data)
      dataHora.setHours(Math.floor(inicioMin / 60), inicioMin % 60, 0, 0)

      slots.push({
        horario: horarioStr,
        dataHoraISO: dataHora.toISOString(),
        disponivel: true,
      })

      inicioMin += intervaloMinutos
    }
  }

  return slots
}

// Função pura: verificar se um slot conflita com agendamentos existentes
function slotConflitaComAgendamento(
  slotInicio: Date,
  duracaoMin: number,
  agendamentos: { dataHora: Date; duracaoMin: number }[]
): boolean {
  const slotFim = addMinutes(slotInicio, duracaoMin)

  for (const ag of agendamentos) {
    const agFim = addMinutes(ag.dataHora, ag.duracaoMin)
    // Verifica sobreposição: !(fim1 <= inicio2 || fim2 <= inicio1)
    if (!(slotFim <= ag.dataHora || agFim <= slotInicio)) {
      return true
    }
  }

  return false
}

// Função pura: verificar se um slot sobrepõe alguma janela ocupada do Google Calendar
function slotConflitaComGoogle(
  slotInicio: Date,
  duracaoMin: number,
  janelas: JanelaOcupada[]
): boolean {
  const slotFim = addMinutes(slotInicio, duracaoMin)
  for (const janela of janelas) {
    if (!(slotFim <= janela.inicio || janela.fim <= slotInicio)) {
      return true
    }
  }
  return false
}

// Função pura: verificar se um slot cai em bloqueio
function slotEmBloqueio(
  slotInicio: Date,
  duracaoMin: number,
  bloqueios: { inicio: Date; fim: Date; recorrente: boolean; diaSemana: number | null }[]
): boolean {
  const slotFim = addMinutes(slotInicio, duracaoMin)
  const slotDiaSemana = getDay(slotInicio)

  for (const bl of bloqueios) {
    if (bl.recorrente) {
      if (bl.diaSemana !== slotDiaSemana) continue
      // Para recorrente, compara apenas hora
      const blInicioMin = bl.inicio.getHours() * 60 + bl.inicio.getMinutes()
      const blFimMin = bl.fim.getHours() * 60 + bl.fim.getMinutes()
      const slotInicioMin = slotInicio.getHours() * 60 + slotInicio.getMinutes()
      const slotFimMin = slotFim.getHours() * 60 + slotFim.getMinutes()

      if (!(slotFimMin <= blInicioMin || blFimMin <= slotInicioMin)) {
        return true
      }
    } else {
      if (!(slotFim <= bl.inicio || bl.fim <= slotInicio)) {
        return true
      }
    }
  }

  return false
}

// Função principal pura: calcular disponibilidade para um período
export async function calcularDisponibilidade(
  dataInicio: Date,
  dataFim: Date,
  servicoId: string,
  configuracoes?: ConfiguracoesClinica
): Promise<PeriodoDisponibilidade> {
  const cfg = configuracoes || await getConfiguracoes()
  const servico = await prisma.servico.findUnique({ where: { id: servicoId } })

  if (!servico || !servico.ativo) {
    throw new Error('Serviço não encontrado ou inativo')
  }

  const duracaoServico = servico.duracaoMin
  const intervaloMinutos = cfg.intervaloAgendamentoMinutos
  const timezone = 'America/Sao_Paulo'

  // Buscar agendamentos no período (apenas não cancelados)
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      dataHora: {
        gte: startOfDay(dataInicio),
        lte: endOfDay(dataFim),
      },
      status: {
        notIn: ['CANCELADO', 'FALTA'],
      },
    },
    select: {
      dataHora: true,
      duracaoMin: true,
    },
  })

  // Buscar bloqueios no período
  const bloqueios = await prisma.bloqueioAgenda.findMany({
    where: {
      OR: [
        // Bloqueios não recorrentes no período
        {
          recorrente: false,
          inicio: { lte: endOfDay(dataFim) },
          fim: { gte: startOfDay(dataInicio) },
        },
        // Bloqueios recorrentes (sempre ativos)
        { recorrente: true },
      ],
    },
  })

  // Horários ocupados no Google Calendar (fonte dos horários livres quando ativa).
  // Uma única consulta para o período inteiro; sem credenciais devolve [].
  const ocupacoesGoogle: JanelaOcupada[] = googleAtivo()
    ? await janelasOcupadas(startOfDay(dataInicio), endOfDay(dataFim))
    : []

  const dias: DiaDisponibilidade[] = []
  let currentDate = startOfDay(dataInicio)
  const endDate = endOfDay(dataFim)

  while (currentDate <= endDate) {
    const diaSemana = getDay(currentDate)
    const horariosDia = cfg.horarioFuncionamento[diaSemana] || []

    // Pular dias sem horário de funcionamento (ex: domingos)
    if (horariosDia.length === 0) {
      currentDate = addMinutes(currentDate, 24 * 60)
      continue
    }

    // Gerar slots teóricos
    const slots = gerarSlotsTeoricos(currentDate, horariosDia, duracaoServico, intervaloMinutos)

    // Filtrar slots passados (para hoje)
    const agora = new Date()
    const slotsFiltrados = slots.map(slot => {
      const slotDate = new Date(slot.dataHoraISO)
      let disponivel = slot.disponivel

      // Slot no passado
      if (isBefore(slotDate, agora)) {
        disponivel = false
      }
      // Conflito com agendamentos
      else if (slotConflitaComAgendamento(slotDate, duracaoServico, agendamentos)) {
        disponivel = false
      }
      // Em bloqueio do painel
      else if (slotEmBloqueio(slotDate, duracaoServico, bloqueios)) {
        disponivel = false
      }
      // Ocupado no Google Calendar (outro compromisso da doutora)
      else if (slotConflitaComGoogle(slotDate, duracaoServico, ocupacoesGoogle)) {
        disponivel = false
      }

      return { ...slot, disponivel }
    })

    const temDisponibilidade = slotsFiltrados.some(s => s.disponivel)

    dias.push({
      data: formatInTimeZone(currentDate, timezone, 'yyyy-MM-dd'),
      diaSemana,
      slots: slotsFiltrados,
      temDisponibilidade,
    })

    currentDate = addMinutes(currentDate, 24 * 60)
  }

  return {
    dias,
    servicoDuracao: duracaoServico,
    timezone,
  }
}

// Função para obter próximos dias com disponibilidade (para o calendário)
export async function obterDiasComDisponibilidade(
  servicoId: string,
  limiteDias: number = 60,
  configuracoes?: ConfiguracoesClinica
): Promise<string[]> {
  const cfg = configuracoes || await getConfiguracoes()
  const hoje = startOfDay(new Date())
  const dataFim = addMinutes(hoje, limiteDias * 24 * 60)

  const disponibilidade = await calcularDisponibilidade(hoje, dataFim, servicoId, cfg)

  return disponibilidade.dias
    .filter(d => d.temDisponibilidade)
    .map(d => d.data)
}

// Função para validar se um horário específico está disponível (para confirmação)
export async function validarHorarioDisponivel(
  servicoId: string,
  data: string, // YYYY-MM-DD
  horario: string, // HH:MM
  configuracoes?: ConfiguracoesClinica
): Promise<{ disponivel: boolean; motivo?: string }> {
  const cfg = configuracoes || await getConfiguracoes()
  const servico = await prisma.servico.findUnique({ where: { id: servicoId } })

  if (!servico || !servico.ativo) {
    return { disponivel: false, motivo: 'Serviço não encontrado ou inativo' }
  }

  const [ano, mes, dia] = data.split('-').map(Number)
  const [hora, minuto] = horario.split(':').map(Number)

  // São Paulo não adotou horário de verão desde 2019: offset fixo -03:00.
  // Construímos com offset explícito para não depender do fuso do servidor.
  const dataHora = new Date(`${data}T${horario}:00-03:00`)
  const agora = new Date()

  // Verificar se é passado
  if (isBefore(dataHora, agora)) {
    return { disponivel: false, motivo: 'Horário no passado' }
  }

  // Verificar limite de dias no futuro
  const limiteFuturo = addMinutes(agora, cfg.limiteDiasFuturo * 24 * 60)
  if (isAfter(dataHora, limiteFuturo)) {
    return { disponivel: false, motivo: `Agendamento só pode ser feito com até ${cfg.limiteDiasFuturo} dias de antecedência` }
  }

  // Verificar dia da semana (independente do fuso: pela data pura)
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  const horariosDia = cfg.horarioFuncionamento[diaSemana] || []
  if (horariosDia.length === 0) {
    return { disponivel: false, motivo: 'Consultório fechado neste dia da semana' }
  }

  // Verificar se horário está dentro do funcionamento
  const horarioMin = hora * 60 + minuto
  const dentroHorario = horariosDia.some(h => {
    const ini = horarioParaMinutos(h.inicio)
    const fim = horarioParaMinutos(h.fim)
    return horarioMin >= ini && horarioMin + servico.duracaoMin <= fim
  })

  if (!dentroHorario) {
    return { disponivel: false, motivo: 'Horário fora do expediente' }
  }

  // Verificar agendamentos conflitantes
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      dataHora: {
        // Janela do dia em São Paulo, expressa como instantes UTC fixos
        gte: new Date(`${data}T00:00:00-03:00`),
        lte: new Date(`${data}T23:59:59.999-03:00`),
      },
      status: { notIn: ['CANCELADO', 'FALTA'] },
    },
  })

  if (slotConflitaComAgendamento(dataHora, servico.duracaoMin, agendamentos)) {
    return { disponivel: false, motivo: 'Horário já ocupado' }
  }

  // Verificar bloqueios
  const bloqueios = await prisma.bloqueioAgenda.findMany({
    where: {
      OR: [
        { recorrente: false, inicio: { lte: dataHora }, fim: { gte: dataHora } },
        { recorrente: true, diaSemana },
      ],
    },
  })

  if (slotEmBloqueio(dataHora, servico.duracaoMin, bloqueios)) {
    return { disponivel: false, motivo: 'Horário indisponível (bloqueio na agenda)' }
  }

  // Double-check no Google Calendar: o horário está livre lá também?
  if (googleAtivo()) {
    const fimSlot = addMinutes(dataHora, servico.duracaoMin)
    const ocupados = await janelasOcupadas(dataHora, fimSlot)
    if (slotConflitaComGoogle(dataHora, servico.duracaoMin, ocupados)) {
      return { disponivel: false, motivo: 'Horário já ocupado na agenda da doutora' }
    }
  }

  return { disponivel: true }
}

// Schema Zod para validar entrada da API
export const disponibilidadeQuerySchema = z.object({
  servicoId: z.string().cuid(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dias: z.coerce.number().int().min(1).max(90).default(30),
})