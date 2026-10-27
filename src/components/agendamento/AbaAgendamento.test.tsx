import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AbaAgendamento } from './AbaAgendamento'

// Mock das dependências de roteamento (o restante vem via fetch, como na API real)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Respostas fake das API usadas pelo componente
const servicosFake = [
  { id: '1', nome: 'Consulta', descricao: 'Desc', duracaoMin: 60, ativo: true, ordem: 1 },
  { id: '2', nome: 'Limpeza', descricao: 'Desc', duracaoMin: 50, ativo: true, ordem: 2 },
]

const respostaJson = (dados: unknown) =>
  ({ ok: true, json: async () => dados }) as Response

describe('AbaAgendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async (entrada: unknown) => {
      const url = String(entrada)
      if (url.includes('/api/servicos')) {
        return respostaJson({ servicos: servicosFake })
      }
      // Disponibilidade de dias/slots: volta sempre configurado para o fluxo seguir
      if (url.includes('/api/agendamentos/disponibilidade')) {
        return respostaJson({
          dias: [],
          servicoDuracao: 60,
          timezone: 'America/Sao_Paulo',
        })
      }
      return respostaJson({})
    }) as unknown as typeof fetch
  })

  it('renderiza a lista de serviços no passo inicial', async () => {
    render(<AbaAgendamento />)

    await waitFor(() => {
      expect(screen.getByText('Qual serviço você deseja?')).toBeInTheDocument()
      expect(screen.getByText('Consulta')).toBeInTheDocument()
      expect(screen.getByText('Limpeza')).toBeInTheDocument()
    })
  })

  it('avança para passo de data ao selecionar serviço', async () => {
    render(<AbaAgendamento />)

    await waitFor(() => expect(screen.getAllByText('Consulta').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Consulta')[0])

    await waitFor(() => {
      expect(screen.getByText('Escolha a data')).toBeInTheDocument()
    })
  })

  it('mostra erro se tentar avançar sem selecionar data', async () => {
    render(<AbaAgendamento />)

    await waitFor(() => expect(screen.getAllByText('Consulta').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Consulta')[0])
    await waitFor(() => expect(screen.getByText('Escolha a data')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Continuar'))

    // Deve permanecer no passo de data (botão desabilitado)
    const btnContinuar = screen.getByText('Continuar')
    expect(btnContinuar).toBeDisabled()
  })
})

// Teste de validação de telefone (usa a implementação REAL, sem mock)
describe('formatarTelefone', () => {
  const real = () => vi.importActual<Record<string, unknown>>('@/lib/utils')

  it('formata celular com 9 dígitos', async () => {
    const { formatarTelefone } = await real()
    expect(formatarTelefone('11999998888')).toBe('(11) 99999-8888')
  })

  it('formata fixo com 8 dígitos', async () => {
    const { formatarTelefone } = await real()
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })

  it('remove caracteres não numéricos', async () => {
    const { formatarTelefone } = await real()
    expect(formatarTelefone('(11) 99999-8888')).toBe('(11) 99999-8888')
  })
})
