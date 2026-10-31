import { describe, expect, it } from 'vitest'
import {
  MENSAGEM_ACESSO_INVALIDO,
  MENSAGEM_BLOQUEIO_TEMPORARIO,
  MAX_TENTATIVAS_POR_CODIGO,
  MAX_TENTATIVAS_POR_IP,
  chavesTentativa,
  limparTentativasPaciente,
  registrarFalhaPaciente,
  verificarBloqueioPaciente,
} from './paciente-rate-limit'

describe('limite de tentativas do paciente', () => {
  it('bloqueia o código após o limite de falhas', () => {
    const chaves = chavesTentativa('ip-teste-codigo', 'CODIGO1')
    for (let i = 0; i < MAX_TENTATIVAS_POR_CODIGO; i++) {
      expect(verificarBloqueioPaciente(chaves).bloqueado).toBe(false)
      registrarFalhaPaciente(chaves)
    }
    expect(verificarBloqueioPaciente(chaves).bloqueado).toBe(true)
  })

  it('bloqueia o IP após o limite de falhas (mesmo com códigos diferentes)', () => {
    const ip = 'ip-teste-ip'
    for (let i = 0; i < MAX_TENTATIVAS_POR_IP; i++) {
      registrarFalhaPaciente(chavesTentativa(ip, `CODIGO${i}`))
    }
    expect(verificarBloqueioPaciente([`ip:${ip}`]).bloqueado).toBe(true)
  })

  it('limpa as tentativas após acesso bem-sucedido', () => {
    const chaves = chavesTentativa('ip-teste-limpar', 'LIMPAR-CODIGO')
    for (let i = 0; i < MAX_TENTATIVAS_POR_CODIGO - 1; i++) registrarFalhaPaciente(chaves)
    expect(verificarBloqueioPaciente(chaves).bloqueado).toBe(false)
    limparTentativasPaciente(chaves)
    registrarFalhaPaciente(chaves)
    expect(verificarBloqueioPaciente(chaves).bloqueado).toBe(false)
  })

  it('usa mensagens genéricas (não revela qual dado falhou)', () => {
    expect(MENSAGEM_ACESSO_INVALIDO.toLowerCase()).not.toContain('código inexistente')
    expect(MENSAGEM_ACESSO_INVALIDO.toLowerCase()).not.toContain('telefone')
    expect(MENSAGEM_ACESSO_INVALIDO.toLowerCase()).not.toContain('nascimento')
    expect(MENSAGEM_BLOQUEIO_TEMPORARIO.toLowerCase()).toContain('muitas tentativas')
  })
})
