import { Servico, Agendamento, BloqueioAgenda, Configuracao, Paciente } from '@prisma/client'

export type { Servico, Agendamento, BloqueioAgenda, Configuracao, Paciente }

// SQLite não gera enum no Prisma Client; o status é String no schema.
export type StatusAgendamento =
  | 'PENDENTE'
  | 'CONFIRMADO'
  | 'CANCELADO'
  | 'CONCLUIDO'
  | 'FALTA'
  | 'REMARCADO'

export type ServicoComRelacoes = Servico & {
  agendamentos?: Agendamento[]
}

export type AgendamentoComRelacoes = Agendamento & {
  servico: Servico
}

export type PacienteComHistorico = Paciente & {
  agendamentos: (Agendamento & { servico: Servico })[]
}

export type ConfiguracoesClinica = {
  clinicaNome: string
  clinicaEndereco: string
  clinicaTelefone: string
  clinicaWhatsApp: string
  clinicaEmail: string
  dentistaNome: string
  dentistaCRO: string
  dentistaFoto: string
  horarioFuncionamento: {
    [dia: number]: { inicio: string; fim: string }[]
  }
  duracaoPadraoMinutos: number
  antecedenciaMinimaHoras: number
  limiteDiasFuturo: number
  intervaloAgendamentoMinutos: number
  limiteAgendamentosIpHora: number
}

export type SlotDisponivel = {
  horario: string
  dataHoraISO: string
  disponivel: boolean
}

export type DiaDisponibilidade = {
  data: string
  diaSemana: number
  slots: SlotDisponivel[]
  temDisponibilidade: boolean
}

export type PeriodoDisponibilidade = {
  dias: DiaDisponibilidade[]
  servicoDuracao: number
  timezone: string
}

export type PassoAgendamento = 'servico' | 'data' | 'horario' | 'dados' | 'confirmacao' | 'sucesso'

export type EstadoAgendamento = {
  passoAtual: PassoAgendamento
  servicoId?: string
  data?: string
  horario?: string
  dadosPaciente?: {
    nome: string
    telefone: string
    dataNascimento?: string
    email?: string
    observacoes?: string
    consentimentoLGPD: boolean
  }
  agendamentoConfirmado?: {
    codigo: string
    servicoNome: string
    dataHora: string
    endereco: string
  }
  erro?: string
}

export type Depoimento = {
  id: string
  nome: string
  texto: string
  servico?: string
  data: string
  ficticio: boolean
}

export type PerguntaFrequente = {
  pergunta: string
  resposta: string
}

export type HorarioFuncionamentoDia = {
  inicio: string
  fim: string
}

export type BloqueioFormData = {
  inicio: string
  fim: string
  motivo?: string
  recorrente: boolean
  diaSemana?: number
}