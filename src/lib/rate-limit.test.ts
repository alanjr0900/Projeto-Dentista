import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BLOQUEIO_MINUTOS,
  MAX_TENTATIVAS,
  limparTentativas,
  registrarFalha,
  verificarBloqueio,
} from './rate-limit'

describe('limite de tentativas de login', () => {
  beforeEach(() => {
    limparTentativas()
    vi.useRealTimers()
  })

  it('não bloqueia antes do limite', () => {
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) {
      expect(registrarFalha().bloqueado).toBe(false)
    }
    expect(verificarBloqueio().tentativasRestantes).toBe(1)
  })

  it('bloqueia ao atingir o limite', () => {
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      registrarFalha()
    }

    const situacao = verificarBloqueio()
    expect(situacao.bloqueado).toBe(true)
    expect(situacao.minutosRestantes).toBe(BLOQUEIO_MINUTOS)
  })

  it('libera automaticamente após o tempo de bloqueio', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      registrarFalha()
    }
    expect(verificarBloqueio().bloqueado).toBe(true)

    vi.setSystemTime(new Date(Date.now() + (BLOQUEIO_MINUTOS + 1) * 60_000))
    expect(verificarBloqueio().bloqueado).toBe(false)
  })

  it('login correto zera as tentativas', () => {
    registrarFalha()
    registrarFalha()
    limparTentativas()

    expect(verificarBloqueio()).toMatchObject({
      bloqueado: false,
      tentativasRestantes: MAX_TENTATIVAS,
    })
  })
})
