import type { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { sessaoDaRequisicao } from './paciente-sessao'
import { sessaoDaRequisicaoOTP } from './paciente-sessao-otp'
import { avaliarPrazos } from './paciente-prazos'

/**
 * Sessão do paciente por CÓDIGO DE AGENDAMENTO (fluxo legado).
 * A sessão é sempre revalidada no servidor a cada requisição.
 */
export async function agendamentoDaSessao(request: NextRequest) {
  const sessao = sessaoDaRequisicao(request)
  if (!sessao) return null

  const agendamento = await prisma.agendamento.findUnique({
    where: { id: sessao.agendamentoId },
    include: { servico: true, paciente: true },
  })
  if (!agendamento) return null

  return { sessao, agendamento }
}

/**
 * Sessão do paciente por CÓDIGO DE E-MAIL (OTP).
 * A sessão é do paciente — não de um agendamento específico.
 */
export async function pacienteDaSessaoOTP(request: NextRequest) {
  const sessao = sessaoDaRequisicaoOTP(request)
  if (!sessao) return null

  const paciente = await prisma.paciente.findUnique({
    where: { id: sessao.pacienteId },
    include: {
      agendamentos: {
        where: { status: { in: ['PENDENTE', 'CONFIRMADO', 'REMARCADO'] } },
        include: { servico: true },
        orderBy: { dataHora: 'asc' },
        take: 20,
      },
    },
  })
  if (!paciente) return null

  return { sessao, paciente }
}

/**
 * Busca um agendamento GARANTINDO que ele pertence ao paciente da sessão.
 * Nunca aceite um `agendamentoId` vindo do cliente sem esta checagem.
 */
export async function agendamentoDoPaciente(pacienteId: string, agendamentoId: string) {
  if (!agendamentoId) return null
  return prisma.agendamento.findFirst({
    where: { id: agendamentoId, pacienteId },
    include: { servico: true, paciente: true },
  })
}

/** Dados do PRÓPRIO agendamento que podem ir para a tela do paciente. */
export function resumoAgendamento(agendamento: {
  codigo: string
  dataHora: Date
  duracaoMin: number
  status: string
  servico: { nome: string }
}) {
  return {
    codigo: agendamento.codigo,
    dataHora: agendamento.dataHora.toISOString(),
    duracaoMin: agendamento.duracaoMin,
    status: agendamento.status,
    servicoNome: agendamento.servico.nome,
  }
}

/** Resumo + regras de prazo (48h) para a tela "Minha consulta". */
export function resumoAgendamentoComPrazos(agendamento: {
  id: string
  codigo: string
  dataHora: Date
  duracaoMin: number
  status: string
  servico: { nome: string }
}) {
  return {
    id: agendamento.id,
    codigo: agendamento.codigo,
    dataHora: agendamento.dataHora.toISOString(),
    duracaoMin: agendamento.duracaoMin,
    status: agendamento.status,
    servico: { nome: agendamento.servico.nome },
    prazos: avaliarPrazos(agendamento),
  }
}
