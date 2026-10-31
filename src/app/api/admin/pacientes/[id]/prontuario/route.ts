import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const criarAnotacaoSchema = z.object({
  texto: z.string().trim().min(1, 'Anotação não pode ficar vazia').max(2000),
  /** Padrão: NÃO liberado para o paciente (LGPD). */
  liberado: z.boolean().optional().default(false),
})

const atualizarLiberacaoSchema = z.object({
  anotacaoId: z.string().cuid(),
  liberado: z.boolean(),
})

const pacienteIdSchema = z.string().cuid()

/**
 * 3.3 — Prontuário datado de UM paciente. Exige sessão admin validada no
 * servidor (regra permanente — AGENTS.md). Texto gravado como texto puro.
 */
async function exigirSessao() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') return null
  return session
}

// GET - Lista as anotações datadas do paciente (mais recentes primeiro).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await exigirSessao())) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    pacienteIdSchema.parse(id)

    const anotacoes = await prisma.anotacaoPaciente.findMany({
      where: { pacienteId: id },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    })
    return NextResponse.json(anotacoes)
  } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
  }
}

// POST - Nova anotação datada (cada nota é uma linha do prontuário).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await exigirSessao())) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    pacienteIdSchema.parse(id)

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
    if (!paciente) {
      return NextResponse.json({ erro: 'Paciente não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const resultado = criarAnotacaoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    }

    const anotacao = await prisma.anotacaoPaciente.create({
      data: { pacienteId: id, texto: resultado.data.texto, liberado: resultado.data.liberado },
    })
    return NextResponse.json(anotacao, { status: 201 })
  } catch {
    return NextResponse.json({ erro: 'Erro ao salvar anotação' }, { status: 500 })
  }
}

// PATCH - Libera/oculta uma anotação para o paciente (controle da dentista).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await exigirSessao())) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    pacienteIdSchema.parse(id)

    const body = await request.json()
    const resultado = atualizarLiberacaoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    }

    const anotacao = await prisma.anotacaoPaciente.findFirst({
      where: { id: resultado.data.anotacaoId, pacienteId: id },
      select: { id: true },
    })
    if (!anotacao) {
      return NextResponse.json({ erro: 'Anotação não encontrada' }, { status: 404 })
    }

    const atualizada = await prisma.anotacaoPaciente.update({
      where: { id: anotacao.id },
      data: { liberado: resultado.data.liberado },
    })
    return NextResponse.json(atualizada)
  } catch {
    return NextResponse.json({ erro: 'Erro ao atualizar anotação' }, { status: 500 })
  }
}
