import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AbaAgendamento } from './AbaAgendamento'

// Mock das dependências
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/servicos-padrao', () => ({
  servicosPadrao: [
    { id: '1', nome: 'Consulta', descricao: 'Desc', duracaoMin: 60, ativo: true, ordem: 1, criadoEm: new Date(), atualizadoEm: new Date() },
    { id: '2', nome: 'Limpeza', descricao: 'Desc', duracaoMin: 50, ativo: true, ordem: 2, criadoEm: new Date(), atualizadoEm: new Date() },
  ],
}))

vi.mock('@/lib/utils', () => ({
  ...vi.requireActual('@/lib/utils'),
  formatarDataBR: vi.fn((d) => new Date(d).toLocaleDateString('pt-BR')),
  formatarHoraBR: vi.fn((d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
  formatarTelefone: vi.fn((t) => t),
}))

describe('AbaAgendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renderiza a lista de serviços no passo inicial', () => {
    render(<AbaAgendamento />)
    
    expect(screen.getByText('Qual serviço você deseja?')).toBeInTheDocument()
    expect(screen.getByText('Consulta')).toBeInTheDocument()
    expect(screen.getByText('Limpeza')).toBeInTheDocument()
  })

  it('avança para passo de data ao selecionar serviço', async () => {
    render(<AbaAgendamento />)
    
    fireEvent.click(screen.getByText('Consulta'))
    
    await waitFor(() => {
      expect(screen.getByText('Escolha a data')).toBeInTheDocument()
    })
  })

  it('mostra erro se tentar avançar sem selecionar data', async () => {
    render(<AbaAgendamento />)
    
    fireEvent.click(screen.getByText('Consulta'))
    await waitFor(() => expect(screen.getByText('Escolha a data')).toBeInTheDocument())
    
    fireEvent.click(screen.getByText('Continuar'))
    
    // Deve permanecer no passo de data (botão desabilitado)
    const btnContinuar = screen.getByText('Continuar')
    expect(btnContinuar).toBeDisabled()
  })
})

// Teste de validação de telefone
describe('formatarTelefone', () => {
  const { formatarTelefone } = vi.requireActual('@/lib/utils')
  
  it('formata celular com 9 dígitos', () => {
    expect(formatarTelefone('11999998888')).toBe('(11) 99999-8888')
  })
  
  it('formata fixo com 8 dígitos', () => {
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })
  
  it('remove caracteres não numéricos', () => {
    expect(formatarTelefone('(11) 99999-8888')).toBe('(11) 99999-8888')
  })
})