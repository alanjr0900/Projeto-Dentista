import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * 3.4 — "Informações do dia": texto livre gravado na chave `aviso_do_dia`
 * e exposto ao público pela rota de SOMENTE-LEITURA /api/aviso-do-dia.
 * Sessão admin validada no servidor (regra permanente — AGENTS.md).
 */
const avisoSchema = z.object({
  aviso: z.string().max(500, 'Máximo de 500 caracteres'),
})

async function exigirSessao() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') return null
  return session
}

// PUT - Salva (ou substitui) o texto do dia.
export async function PUT(request: NextRequest) {
  if (!(await exigirSessao())) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const resultado = avisoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json(
        { erro: resultado.error.issues[0]?.message || 'Dados inválidos' },
        { status: 400 }
      )
    }

    await prisma.configuracao.upsert({
      where: { chave: 'aviso_do_dia' },
      update: { valor: resultado.data.aviso },
      create: { chave: 'aviso_do_dia', valor: resultado.data.aviso, descricao: 'Informações do dia (aparece na página pública)' },
    })
    return NextResponse.json({ sucesso: true, aviso: resultado.data.aviso })
  } catch {
    return NextResponse.json({ erro: 'Erro ao salvar o aviso' }, { status: 500 })
  }
}

// DELETE - Limpa o texto (a página pública passa a mostrar "Nenhum aviso para hoje").
export async function DELETE() {
  if (!(await exigirSessao())) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    await prisma.configuracao.upsert({
      where: { chave: 'aviso_do_dia' },
      update: { valor: '' },
      create: { chave: 'aviso_do_dia', valor: '', descricao: 'Informações do dia (aparece na página pública)' },
    })
    return NextResponse.json({ sucesso: true, aviso: '' })
  } catch {
    return NextResponse.json({ erro: 'Erro ao limpar o aviso' }, { status: 500 })
  }
}
