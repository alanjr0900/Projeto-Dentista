import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelarRemarcarSchema } from '@/lib/validations'
import { getConfiguracoes } from '@/lib/config'
import { formatarDataHoraBR } from '@/lib/utils'

// GET - Buscar agendamento por código (para cancelar/remarcar)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')

    if (!telefone) {
      return NextResponse.json({ erro: 'Telefone é obrigatório' }, { status: 400 })
    }

    const agendamento = await prisma.agendamento.findUnique({
      where: { codigo },
      include: { servico: true },
    })

    if (!agendamento) {
      return NextResponse.json({ erro: 'Agendamento não encontrado' }, { status: 404 })
    }

    // Verificar se o telefone confere (últimos 8 dígitos para privacidade)
    const telefoneLimpo = telefone.replace(/\D/g, '')
    const agendamentoTel = agendamento.pacienteTelefone
    if (agendamentoTel.slice(-8) !== telefoneLimpo.slice(-8)) {
      return NextResponse.json({ erro: 'Código ou telefone incorretos' }, { status: 403 })
    }

    return NextResponse.json({
      codigo: agendamento.codigo,
      servico: agendamento.servico.nome,
      dataHora: agendamento.dataHora.toISOString(),
      dataHoraFormatada: formatarDataHoraBR(agendamento.dataHora),
      status: agendamento.status,
      pacienteNome: agendamento.pacienteNome,
      observacoes: agendamento.observacoes,
    })
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}