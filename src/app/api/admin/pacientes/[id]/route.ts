import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDataNascimento } from '@/lib/data-nascimento'

const updatePacienteSchema = z.object({
  anotacoes: z.string().max(2000).optional(),
  /** Data de nascimento em "YYYY-MM-DD" (input type=date) ou null para limpar. */
  dataNascimento: z.union([z.string(), z.null()]).optional(),
})

// PUT - Atualizar anotações do paciente
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
    
    const resultado = updatePacienteSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    }

    const dados: { anotacoes?: string | null; dataNascimento?: Date | null } = {}
    if (resultado.data.anotacoes !== undefined) {
      dados.anotacoes = resultado.data.anotacoes
    }
    if (resultado.data.dataNascimento !== undefined) {
      if (resultado.data.dataNascimento === null || resultado.data.dataNascimento === '') {
        dados.dataNascimento = null
      } else {
        const data = parseDataNascimento(resultado.data.dataNascimento)
        if (!data) {
          return NextResponse.json({ erro: 'Data de nascimento inválida' }, { status: 400 })
        }
        dados.dataNascimento = data
      }
    }

    const paciente = await prisma.paciente.update({
      where: { id },
      data: dados,
    })

    return NextResponse.json(paciente)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ erro: 'Paciente não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// GET - Exportar pacientes em CSV
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const exportar = searchParams.get('exportar')

  if (exportar === 'csv') {
    try {
      const pacientes = await prisma.paciente.findMany({
        include: {
          agendamentos: {
            include: { servico: true },
            orderBy: { dataHora: 'desc' },
          },
        },
        orderBy: { nome: 'asc' },
      })

      const csv = [
        ['Nome', 'Telefone', 'E-mail', 'Total Consultas', 'Última Consulta', 'Próxima Consulta', 'Anotações'].join(','),
        ...pacientes.map(p => {
          const ultima = p.agendamentos[0]
          const proxima = p.agendamentos.find(a => new Date(a.dataHora) > new Date() && !['CANCELADO', 'FALTA'].includes(a.status))
          return [
            `"${p.nome.replace(/"/g, '""')}"`,
            `"${p.telefone}"`,
            `"${p.email || ''}"`,
            p.agendamentos.length,
            ultima ? `"${new Date(ultima.dataHora).toLocaleDateString('pt-BR')}"` : '',
            proxima ? `"${new Date(proxima.dataHora).toLocaleDateString('pt-BR')}"` : '',
            `"${(p.anotacoes || '').replace(/"/g, '""')}"`,
          ].join(',')
        }),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pacientes.csv"',
        },
      })
    } catch {
      return NextResponse.json({ erro: 'Erro ao exportar' }, { status: 500 })
    }
  }

  return NextResponse.json({ erro: 'Parâmetro inválido' }, { status: 400 })
}