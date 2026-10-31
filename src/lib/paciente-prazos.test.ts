import { describe, expect, it } from 'vitest'
import { avaliarPrazos } from './paciente-prazos'
import { PRAZO_CANCELAMENTO_HORAS, PRAZO_REAGENDAMENTO_HORAS } from './prazos'

const AGORA = new Date('2026-10-30T12:00:00-03:00')
const emHoras = (horas: number) => new Date(AGORA.getTime() + horas * 60 * 60 * 1000)

const MENSAGEM_REAGENDAMENTO =
  'Remarcações precisam ser feitas com pelo menos 48 horas de antecedência. Fale com a clínica pelo WhatsApp.'

describe('prazos da consulta do paciente', () => {
  it('usa 48h como padrão único de configuração', () => {
    expect(PRAZO_REAGENDAMENTO_HORAS).toBe(48)
    expect(PRAZO_CANCELAMENTO_HORAS).toBe(48)
  })

  it('bloqueia remarcação com menos de 48h e devolve a mensagem exata', () => {
    const prazos = avaliarPrazos({ dataHora: emHoras(47), status: 'PENDENTE' }, AGORA)
    expect(prazos.podeRemarcar).toBe(false)
    expect(prazos.motivoRemarcacao).toBe(MENSAGEM_REAGENDAMENTO)
    expect(prazos.podeCancelar).toBe(false)
    expect(prazos.horasParaConsulta).toBeCloseTo(47, 5)
    expect(prazos.prazoHoras).toBe(48)
    expect(prazos.prazoCancelamentoHoras).toBe(48)
  })

  it('libera remarcação a partir de 48h exatas', () => {
    const prazos = avaliarPrazos({ dataHora: emHoras(48), status: 'CONFIRMADO' }, AGORA)
    expect(prazos.podeRemarcar).toBe(true)
    expect(prazos.motivoRemarcacao).toBeUndefined()
    expect(prazos.podeCancelar).toBe(true)
  })

  it('libera remarcação com mais de 48h', () => {
    const prazos = avaliarPrazos({ dataHora: emHoras(72), status: 'REMARCADO' }, AGORA)
    expect(prazos.podeRemarcar).toBe(true)
  })

  it('não permite alterar consulta cancelada, concluída ou falta', () => {
    for (const status of ['CANCELADO', 'CONCLUIDO', 'FALTA']) {
      const prazos = avaliarPrazos({ dataHora: emHoras(72), status }, AGORA)
      expect(prazos.podeRemarcar).toBe(false)
      expect(prazos.podeCancelar).toBe(false)
    }
  })
})
