import { describe, expect, it } from 'vitest'
import { mensagemSegura } from './log-seguro'

describe('mensagemSegura', () => {
  it('mascara e-mail completo', () => {
    const texto = mensagemSegura(new Error('Falha ao enviar para joao.silva@email.com'))
    expect(texto).toContain('***@***')
    expect(texto).not.toContain('joao.silva')
  })

  it('mascara códigos de 6 dígitos', () => {
    const texto = mensagemSegura('Código 042424 inválido')
    expect(texto).toBe('Código ****** inválido')
  })

  it('não altera mensagens sem dados pessoais', () => {
    expect(mensagemSegura('SMTP indisponível')).toBe('SMTP indisponível')
  })

  it('limita o tamanho e remove quebras de linha', () => {
    const texto = mensagemSegura('a\n'.repeat(500))
    expect(texto).not.toContain('\n')
    expect(texto.length).toBeLessThanOrEqual(300)
  })

  it('lida com valores que não são Error', () => {
    expect(mensagemSegura(undefined)).toBe('erro desconhecido')
    expect(mensagemSegura({ x: 1 })).toBe('erro desconhecido')
  })
})
