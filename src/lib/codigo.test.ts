import { describe, expect, it } from 'vitest'
import {
  ALFABETO_CODIGO,
  TAMANHO_CODIGO,
  codigoValido,
  gerarCodigo,
  gerarCodigoUnico,
  normalizarCodigo,
} from './codigo'

describe('código do agendamento', () => {
  it('gera 8 caracteres usando o alfabeto seguro', () => {
    for (let i = 0; i < 300; i++) {
      const codigo = gerarCodigo()
      expect(codigo).toHaveLength(TAMANHO_CODIGO)
      for (const caractere of codigo) {
        expect(ALFABETO_CODIGO).toContain(caractere)
      }
    }
  })

  it('nunca usa caracteres ambíguos (0, O, 1, I, L)', () => {
    const amostra = Array.from({ length: 500 }, () => gerarCodigo()).join('')
    expect(amostra).not.toMatch(/[0O1IL]/)
  })

  it('gera códigos únicos na prática (500 amostras)', () => {
    const codigos = new Set(Array.from({ length: 500 }, () => gerarCodigo()))
    expect(codigos.size).toBe(500)
  })

  it('aceita minúsculas e normaliza para maiúsculas', () => {
    expect(normalizarCodigo('  abcd2345 ')).toBe('ABCD2345')
    expect(codigoValido('abcd2345')).toBe(true)
    expect(codigoValido('ABCD2345')).toBe(true)
  })

  it('rejeita formatos inválidos', () => {
    expect(codigoValido('')).toBe(false)
    expect(codigoValido('ABC')).toBe(false)
    expect(codigoValido('ABCD23456')).toBe(false)
    expect(codigoValido('ABCD23O5')).toBe(false)
    expect(codigoValido('ABCD-345')).toBe(false)
  })

  it('gerarCodigoUnico descarta colisões com o que já existe no banco', async () => {
    const tentativasVistas: string[] = []
    const codigo = await gerarCodigoUnico(async candidato => {
      tentativasVistas.push(candidato)
      // Simula o primeiro candidato já existente no banco.
      if (tentativasVistas.length === 1) return true
      return false
    })
    expect(tentativasVistas.length).toBe(2)
    expect(codigo).toBe(tentativasVistas[1])
    expect(codigoValido(codigo)).toBe(true)
  })
})
