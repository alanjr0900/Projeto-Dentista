import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar serviços ativos (público)
export async function GET() {
  try {
    const servicos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
      select: {
        id: true,
        nome: true,
        descricao: true,
        duracaoMin: true,
      },
    })

    return NextResponse.json({ servicos })
  } catch (error) {
    console.error('Erro ao listar serviços:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}