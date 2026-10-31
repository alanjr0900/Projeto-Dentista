import { beforeAll, describe, expect, it, vi } from 'vitest'
import { criarTokenSessao, lerTokenSessao, SESSAO_PACIENTE_MINUTOS } from './paciente-sessao'

describe('sessão do paciente', () => {
  beforeAll(() => {
    vi.stubEnv('AUTH_SECRET', 'segredo-de-teste-minha-consulta')
  })

  const agora = Date.UTC(2026, 9, 30, 12, 0, 0)

  it('cria e lê a sessão básica', () => {
    const token = criarTokenSessao('agendamento-1', 'basico', agora)
    const sessao = lerTokenSessao(token, agora + 1000)
    expect(sessao).toEqual({
      agendamentoId: 'agendamento-1',
      nivel: 'basico',
      exp: Math.floor(agora / 1000) + SESSAO_PACIENTE_MINUTOS * 60,
    })
  })

  it('preserva o nível completo', () => {
    const token = criarTokenSessao('agendamento-2', 'completo', agora)
    expect(lerTokenSessao(token, agora)?.nivel).toBe('completo')
  })

  it('expira após 15 minutos', () => {
    const token = criarTokenSessao('agendamento-3', 'basico', agora)
    expect(lerTokenSessao(token, agora + SESSAO_PACIENTE_MINUTOS * 60 * 1000 - 1)).not.toBeNull()
    expect(lerTokenSessao(token, agora + SESSAO_PACIENTE_MINUTOS * 60 * 1000 + 1)).toBeNull()
  })

  it('rejeita token adulterado, vazio ou com formato inválido', () => {
    const token = criarTokenSessao('agendamento-4', 'basico', agora)
    const adulterado = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    expect(lerTokenSessao(adulterado, agora)).toBeNull()
    expect(lerTokenSessao('', agora)).toBeNull()
    expect(lerTokenSessao('sem-assinatura', agora)).toBeNull()
    expect(lerTokenSessao('a.b.c', agora)).toBeNull()
  })
})
