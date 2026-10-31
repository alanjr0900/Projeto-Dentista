import { beforeAll, describe, expect, it } from 'vitest'
import {
  MAX_BLOQUEIOS_CONSECUTIVOS,
  MAX_TENTATIVAS_POR_CODIGO,
  gerarCodigoOTP,
  hashCodigo,
  hashEmail,
  hashesConferem,
  mascararEmail,
  normalizarEmail,
} from './paciente-otp'

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-otp'
})

describe('geração do código OTP', () => {
  it('gera sempre 6 dígitos numéricos', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = gerarCodigoOTP()
      expect(codigo).toMatch(/^\d{6}$/)
      expect(codigo.length).toBe(6)
    }
  })

  it('usa a faixa completa (inclui zeros à esquerda)', () => {
    const codigos = new Set(Array.from({ length: 500 }, () => gerarCodigoOTP()))
    expect(codigos.size).toBeGreaterThan(450)
  })
})

describe('hash do código', () => {
  it('é determinístico e não expõe o código', () => {
    const hash = hashCodigo('123456')
    expect(hash).toBe(hashCodigo('123456'))
    expect(hash).not.toContain('123456')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('muda quando o código muda', () => {
    expect(hashCodigo('123456')).not.toBe(hashCodigo('123457'))
  })

  it('compara hashes sem vazar tempo', () => {
    const a = hashCodigo('000000')
    const b = hashCodigo('000000')
    expect(hashesConferem(a, b)).toBe(true)
    expect(hashesConferem(a, hashCodigo('000001'))).toBe(false)
    expect(hashesConferem(a, 'hash-curto')).toBe(false)
  })
})

describe('normalização e máscara do e-mail', () => {
  it('normaliza caixa e espaços', () => {
    expect(normalizarEmail('  Joao@Email.COM ')).toBe('joao@email.com')
  })

  it('mascara sem gravar o endereço completo', () => {
    expect(mascararEmail('joao@email.com')).toBe('j***@email.com')
    expect(mascararEmail('a@b.com')).toBe('a***@b.com')
    expect(mascararEmail('sem-arroba')).toBe('***')
  })

  it('hash do e-mail ignora caixa/espaços', () => {
    expect(hashEmail(' Joao@Email.com ')).toBe(hashEmail('joao@email.com'))
    expect(hashEmail('joao@email.com')).not.toBe(hashEmail('maria@email.com'))
  })
})

describe('limites padrão', () => {
  it('segue a especificação do projeto', () => {
    expect(MAX_TENTATIVAS_POR_CODIGO).toBe(5)
    expect(MAX_BLOQUEIOS_CONSECUTIVOS).toBe(3)
  })
})
