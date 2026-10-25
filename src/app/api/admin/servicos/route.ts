import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { servicoAdminSchema } from '@/lib/validations'

// GET - Listar todos os serviços (admin)
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const servicos = await prisma.servico.findMany({
      orderBy: { ordem: 'asc' },
      include: { _count: { select: { agendamentos: true } } },
    })
    return NextResponse.json({ servicos })
  } catch (error) {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// POST - Criar novo serviço
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const resultado = servicoAdminSchema.safeParse(body)
    
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const servico = await prisma.servico.create({ data: resultado.data })
    return NextResponse.json(servico, { status: 201 })
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao criar serviço' }, { status: 500 })
  }
}