import { NextRequest, NextResponse } from 'next/server'
import { calcularDisponibilidade } from '@/lib/disponibilidade'
import { getConfiguracoes } from '@/lib/config'
import { z } from 'zod'

// Query params: servicoId, dataInicio, dataFim, dias (default: limite configurado)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cfg = await getConfiguracoes()

    const esquema = z.object({
      servicoId: z.string().min(1, 'servicoId é obrigatório'),
      dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dias: z.coerce.number().int().min(1).max(365).optional(),
    })

    const resultado = esquema.safeParse(Object.fromEntries(searchParams))
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Parâmetros inválidos', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { servicoId, dataInicio, dataFim, dias } = resultado.data

    // Verificar se o serviço existe e está ativo
    const servico = await prismaServico(servicoId)
    if (!servico) {
      return NextResponse.json({ erro: 'Serviço não encontrado' }, { status: 404 })
    }

    // Janela: a partir de hoje (hoje + dataInicio se informado; usar o maior)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    let inicio = hoje
    if (dataInicio) {
      const d = new Date(`${dataInicio}T00:00:00`)
      if (d > inicio) inicio = d
    }

    let fim: Date
    if (dataFim) {
      fim = new Date(`${dataFim}T00:00:00`)
      // Garante ao menos o dia solicitado
    } else {
      const qtdDias = dias ?? cfg.limiteDiasFuturo
      fim = new Date(inicio)
      fim.setDate(fim.getDate() + qtdDias - 1)
    }

    if (fim < inicio) {
      fim = new Date(inicio)
    }

    const disponibilidade = await calcularDisponibilidade(inicio, fim, servicoId, cfg)

    const diasComDisponibilidade = disponibilidade.dias
      .filter(d => d.temDisponibilidade)
      .map(d => d.data)

    return NextResponse.json({
      servicoId,
      servicoDuracao: disponibilidade.servicoDuracao,
      dias: disponibilidade.dias,
      diasComDisponibilidade,
    })
  } catch (error) {
    console.error('Erro em /api/agendamentos/disponibilidade:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro ao calcular disponibilidade'
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}

async function prismaServico(servicoId: string) {
  const { prisma } = await import('@/lib/prisma')
  return prisma.servico.findUnique({ where: { id: servicoId } })
}