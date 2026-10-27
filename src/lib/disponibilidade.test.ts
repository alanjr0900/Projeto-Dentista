import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  horarioParaMinutos, 
  minutosParaHorario, 
  gerarSlotsTeoricos,
  slotConflitaComAgendamento,
  slotEmBloqueio 
} from './disponibilidade'
import { addMinutes, setHours, setMinutes } from 'date-fns'

describe('Lógica de disponibilidade', () => {
  describe('horarioParaMinutos', () => {
    it('converte HH:MM para minutos', () => {
      expect(horarioParaMinutos('08:00')).toBe(480)
      expect(horarioParaMinutos('13:30')).toBe(810)
      expect(horarioParaMinutos('17:45')).toBe(1065)
      expect(horarioParaMinutos('00:00')).toBe(0)
      expect(horarioParaMinutos('23:59')).toBe(1439)
    })
  })

  describe('minutosParaHorario', () => {
    it('converte minutos para HH:MM', () => {
      expect(minutosParaHorario(480)).toBe('08:00')
      expect(minutosParaHorario(810)).toBe('13:30')
      expect(minutosParaHorario(1065)).toBe('17:45')
      expect(minutosParaHorario(0)).toBe('00:00')
      expect(minutosParaHorario(1439)).toBe('23:59')
    })
  })

  describe('gerarSlotsTeoricos', () => {
    const data = new Date('2024-01-15T00:00:00') // Segunda-feira
    const horarioFuncionamento = [
      { inicio: '08:00', fim: '12:00' },
      { inicio: '13:30', fim: '17:00' },
    ]

    it('gera slots com intervalo padrão de 15 min', () => {
      const slots = gerarSlotsTeoricos(data, horarioFuncionamento, 60, 15)
      
      // Manhã: 08:00 a 12:00 → starts de 60min a cada 15min (08:00 a 11:00) = 13
      expect(slots.filter(s => s.horario.startsWith('08') || s.horario.startsWith('09') || s.horario.startsWith('10') || s.horario.startsWith('11'))).toHaveLength(13)
      
      // Tarde: 13:30 a 17:00 → starts 13:30 a 15:30 a cada 15min = 11
      expect(slots.filter(s => s.horario.startsWith('13') || s.horario.startsWith('14') || s.horario.startsWith('15') || s.horario.startsWith('16'))).toHaveLength(11)
      
      expect(slots[0].horario).toBe('08:00')
      expect(slots[0].disponivel).toBe(true)
    })

    it('respeita duração do serviço', () => {
      // Serviço de 90 min - último slot da manhã deve ser 10:30
      const slots = gerarSlotsTeoricos(data, horarioFuncionamento, 90, 15)
      const manhaSlots = slots.filter(s => parseInt(s.horario.split(':')[0]) < 12)
      expect(manhaSlots[manhaSlots.length - 1].horario).toBe('10:30')
    })

    it('retorna array vazio se horário de funcionamento vazio', () => {
      const slots = gerarSlotsTeoricos(data, [], 60, 15)
      expect(slots).toHaveLength(0)
    })
  })

  describe('slotConflitaComAgendamento', () => {
    // Datas com milissegundos zerados: sem isto, "borda exata" fica sujeita
    // ao ms residual de new Date() e o teste é instável.
    const dh = (h: number, m: number) => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), h, m, 0, 0)
    const agendamentos = [
      { dataHora: dh(9, 0), duracaoMin: 60 }, // 09:00-10:00
      { dataHora: dh(14, 0), duracaoMin: 50 }, // 14:00-14:50
    ]

    it('detecta conflito exato', () => {
      const slot = dh(9, 0)
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(true)
    })

    it('detecta sobreposição parcial no início', () => {
      const slot = dh(8, 30) // 08:30-09:30
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(true)
    })

    it('detecta sobreposição parcial no fim', () => {
      const slot = dh(9, 30) // 09:30-10:30
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(true)
    })

    it('detecta slot dentro do agendamento', () => {
      const slot = dh(9, 15) // 09:15-09:45
      expect(slotConflitaComAgendamento(slot, 30, agendamentos)).toBe(true)
    })

    it('não detecta conflito quando slot termina exatamente no início', () => {
      const slot = dh(8, 0) // 08:00-09:00
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(false)
    })

    it('não detecta conflito quando slot começa exatamente no fim', () => {
      const slot = dh(10, 0) // 10:00-11:00
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(false)
    })

    it('não detecta conflito em horários distantes', () => {
      const slot = dh(16, 0) // 16:00-17:00
      expect(slotConflitaComAgendamento(slot, 60, agendamentos)).toBe(false)
    })
  })

  describe('slotEmBloqueio', () => {
    const hoje = new Date()
    const bloqueios = [
      // Bloqueio não recorrente: 15/01/2024 14:00-16:00
      { 
        inicio: new Date('2024-01-15T14:00:00'), 
        fim: new Date('2024-01-15T16:00:00'), 
        recorrente: false, 
        diaSemana: null 
      },
      // Bloqueio recorrente: segundas-feiras 10:00-11:00
      { 
        inicio: new Date('2024-01-01T10:00:00'), 
        fim: new Date('2024-01-01T11:00:00'), 
        recorrente: true, 
        diaSemana: 1 // Segunda
      },
    ]

    it('detecta bloqueio não recorrente', () => {
      const slot = new Date('2024-01-15T15:00:00')
      expect(slotEmBloqueio(slot, 60, bloqueios)).toBe(true)
    })

    it('não detecta fora do bloqueio não recorrente', () => {
      const slot = new Date('2024-01-15T16:30:00')
      expect(slotEmBloqueio(slot, 60, bloqueios)).toBe(false)
    })

    it('detecta bloqueio recorrente no dia correto', () => {
      // Segunda-feira 15/01/2024 às 10:30
      const slot = new Date('2024-01-15T10:30:00')
      expect(slotEmBloqueio(slot, 30, bloqueios)).toBe(true)
    })

    it('não detecta bloqueio recorrente em dia errado', () => {
      // Terça-feira 16/01/2024 às 10:30
      const slot = new Date('2024-01-16T10:30:00')
      expect(slotEmBloqueio(slot, 30, bloqueios)).toBe(false)
    })

    it('detecta bloqueio recorrente com slot que começa antes e termina durante', () => {
      const slot = new Date('2024-01-15T09:30:00') // 09:30-10:30
      expect(slotEmBloqueio(slot, 60, bloqueios)).toBe(true)
    })
  })
})

// Mock do Prisma para testes de integração
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servico: { findUnique: vi.fn() },
    agendamento: { findMany: vi.fn() },
    bloqueioAgenda: { findMany: vi.fn() },
    configuracao: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/config', () => ({
  getConfiguracoes: vi.fn(),
}))