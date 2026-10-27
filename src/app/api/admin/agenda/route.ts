import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { startOfDay, endOfDay, addDays, subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { googleAtivo, excluirEvento } from '@/lib/google/agenda'
import { getConfiguracoes } from '@/lib/config'

const agendaQuerySchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
})

// GET - Listar agendamentos (admin)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = agendaQuerySchema.parse(Object.fromEntries(searchParams))

    let where: any = {}

    if (params.data) {
      const data = new Date(params.data)
      where.dataHora = { gte: startOfDay(data), lte: endOfDay(data) }
    } else if (params.inicio && params.fim) {
      where.dataHora = { 
        gte: startOfDay(new Date(params.inicio)), 
        lte: endOfDay(new Date(params.fim)) 
      }
    }

    if (params.status && params.status !== 'todos') {
      where.status = params.status
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: { servico: true },
      orderBy: { dataHora: 'asc' },
    })

    return NextResponse.json({ agendamentos })
  } catch (error) {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// PUT - Atualizar agendamento (admin actions)
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, acao, ...dados } = body

    const agendamento = await prisma.agendamento.findUnique({ where: { id } })
    if (!agendamento) {
      return NextResponse.json({ erro: 'Agendamento não encontrado' }, { status: 404 })
    }

    let updateData: any = {}

    switch (acao) {
      case 'confirmar':
        updateData = { status: 'CONFIRMADO', confirmadoEm: new Date() }
        break
      case 'concluir':
        updateData = { status: 'CONCLUIDO', concluidoEm: new Date() }
        break
      case 'cancelar':
        updateData = { status: 'CANCELADO', canceladoEm: new Date(), canceladoPor: 'DENTISTA' }
        break
      case 'falta':
        updateData = { status: 'FALTA' }
        break
      case 'remarcar':
        if (!dados.novaDataHora || !dados.novoServicoId) {
          return NextResponse.json({ erro: 'Nova data/hora e serviço são obrigatórios' }, { status: 400 })
        }
        const novoServico = await prisma.servico.findUnique({ where: { id: dados.novoServicoId } })
        if (!novoServico) {
          return NextResponse.json({ erro: 'Serviço não encontrado' }, { status: 404 })
        }
        // Verificar conflito
        const conflito = await prisma.agendamento.findFirst({
          where: {
            dataHora: new Date(dados.novaDataHora),
            status: { notIn: ['CANCELADO', 'FALTA'] },
            NOT: { id },
          },
        })
        if (conflito) {
          return NextResponse.json({ erro: 'Horário ocupado' }, { status: 409 })
        }
        updateData = {
          status: 'REMARCADO',
          dataHora: new Date(dados.novaDataHora),
          servicoId: dados.novoServicoId,
          duracaoMin: novoServico.duracaoMin,
        }
        break
      default:
        return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 })
    }

    const atualizado = await prisma.agendamento.update({
      where: { id },
      data: updateData,
      include: { servico: true },
    })

    // 3.1 — Cancelamento remove o evento do calendário, quando existir.
    // Falha do Google NUNCA falha a ação: o banco é o registro de verdade.
    if (acao === 'cancelar' && googleAtivo() && agendamento.googleEventoId) {
      try {
        await excluirEvento(agendamento.googleEventoId)
      } catch (erroGoogle) {
        console.error('[Google Calendar] Falha ao remover evento (status atualizado no banco):', erroGoogle)
      }
    }

    return NextResponse.json({ agendamento: atualizado })
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// POST - Criar bloqueio
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { inicio, fim, motivo, recorrente, diaSemana } = body

    const bloqueio = await prisma.bloqueioAgenda.create({
      data: {
        inicio: new Date(inicio),
        fim: new Date(fim),
        motivo,
        recorrente: !!recorrente,
        diaSemana: recorrente ? diaSemana : null,
      },
    })

    return NextResponse.json({ bloqueio }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao criar bloqueio' }, { status: 500 })
  }
}

// DELETE - Remover bloqueio
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ erro: 'ID do bloqueio é obrigatório' }, { status: 400 })
    }

    await prisma.bloqueioAgenda.delete({ where: { id } })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao remover bloqueio' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// 3.2 — Link de WhatsApp para REMARCAR, montado NO SERVIDOR com o número
// lido do banco (só dígitos, com DDI/DDD) e mensagem com nome/serviço/
// data/hora. O navegador nunca monta o número sozinho.
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ erro: 'ID do agendamento é obrigatório' }, { status: 400 })
    }

    const ag = await prisma.agendamento.findUnique({
      where: { id },
      include: { servico: { select: { nome: true } } },
    })
    if (!ag) {
      return NextResponse.json({ erro: 'Agendamento não encontrado' }, { status: 404 })
    }

    // WhatsApp exige celular com DDD + 9 dígitos (ou já com DDI 55).
    const digitos = (ag.pacienteTelefone || '').replace(/\D/g, '')
    const celular =
      digitos.length === 13 && digitos.startsWith('55')
        ? digitos
        : digitos.length === 11
          ? `55${digitos}`
          : ''
    if (!/^55\d{11}$/.test(celular)) {
      return NextResponse.json(
        { erro: `O telefone do paciente (${ag.pacienteTelefone || 'vazio'}) não é um celular válido para WhatsApp.` },
        { status: 422 }
      )
    }

    const cfg = await getConfiguracoes()
    const quando = `${format(new Date(ag.dataHora), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(ag.dataHora), 'HH:mm')}`
    const mensagem =
      `Olá, ${ag.pacienteNome}! Aqui é o consultório da ${cfg.dentistaNome}. ` +
      `Falo para tratar do reagendamento da sua consulta de ${ag.servico.nome}, ` +
      `agendada para ${quando}. Qual novo horário fica melhor para você?`
    const link = `https://wa.me/${celular}?text=${encodeURIComponent(mensagem)}`

    return NextResponse.json({ link })
  } catch {
    return NextResponse.json({ erro: 'Erro ao gerar o link de remarcação' }, { status: 500 })
  }
}