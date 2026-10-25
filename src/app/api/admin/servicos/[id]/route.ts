import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { servicoAdminSchema } from '@/lib/validations'

// PUT - Atualizar serviço
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    
    const resultado = servicoAdminSchema.partial().safeParse(body)
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const servico = await prisma.servico.update({
      where: { id },
      data: resultado.data,
    })

    return NextResponse.json(servico)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ erro: 'Serviço não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ erro: 'Erro ao atualizar' }, { status: 500 })
  }
}

// DELETE - Excluir serviço
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    // Verificar se tem agendamentos
    const count = await prisma.agendamento.count({ where: { servicoId: id } })
    if (count > 0) {
      // Não excluir, apenas desativar
      await prisma.servico.update({ where: { id }, data: { ativo: false } })
      return NextResponse.json({ mensagem: 'Serviço desativado (possui agendamentos)' })
    }

    await prisma.servico.delete({ where: { id } })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete not found')) {
      return NextResponse.json({ erro: 'Serviço não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ erro: 'Erro ao excluir' }, { status: 500 })
  }
}