import { describe, expect, it } from 'vitest'
import { normalizarNomePessoa, nomesConferem } from './nome-pessoa'

describe('normalizarNomePessoa', () => {
  it('ignora maiúsculas, acentos e espaços extras', () => {
    expect(normalizarNomePessoa('  JOÃO   da   Silva ')).toBe('joao da silva')
    expect(normalizarNomePessoa('Joao da Silva')).toBe('joao da silva')
    expect(normalizarNomePessoa('MARIA   JOSÉ')).toBe('maria jose')
  })

  it('não considera nomes diferentes como iguais', () => {
    expect(nomesConferem('Ana Maria', 'AnaMaria')).toBe(false)
    expect(nomesConferem('Ana Maria', 'Ana  Maria')).toBe(true)
    expect(nomesConferem('José', 'Jose')).toBe(true)
  })

  it('mantém o nome vazio estável', () => {
    expect(normalizarNomePessoa('   ')).toBe('')
  })
})
