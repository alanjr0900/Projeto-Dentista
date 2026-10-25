import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/foto/enquadramento — grava ponto de foco e zoom da foto
// Somente admin autenticado (middleware + verificação explícita).
const enquadramentoSchema = z.object({
  focoX: z.number().min(0).max(100),
  focoY: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const resultado = enquadramentoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Enquadramento inválido', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { focoX, focoY, zoom } = resultado.data

    // Grava os três valores juntos (transação: ou tudo, ou nada)
    await prisma.$transaction([
      prisma.configuracao.upsert({
        where: { chave: 'dentista_foto_foco_x' },
        update: { valor: String(focoX) },
        create: { chave: 'dentista_foto_foco_x', valor: String(focoX) },
      }),
      prisma.configuracao.upsert({
        where: { chave: 'dentista_foto_foco_y' },
        update: { valor: String(focoY) },
        create: { chave: 'dentista_foto_foco_y', valor: String(focoY) },
      }),
      prisma.configuracao.upsert({
        where: { chave: 'dentista_foto_zoom' },
        update: { valor: String(zoom) },
        create: { chave: 'dentista_foto_zoom', valor: String(zoom) },
      }),
    ])

    return NextResponse.json({ sucesso: true, focoX, focoY, zoom })
  } catch (error) {
    console.error('Erro ao salvar enquadramento da foto:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
