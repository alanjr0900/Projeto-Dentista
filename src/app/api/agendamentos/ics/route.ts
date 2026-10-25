import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarArquivoICS, gerarNomeArquivoICS } from '@/lib/ics'

// POST - Gerar arquivo .ics para download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codigo, telefone } = body

    if (!codigo || !telefone) {
      return NextResponse.json({ erro: 'Código e telefone são obrigatórios' }, { status: 400 })
    }

    const agendamento = await prisma.agendamento.findUnique({
      where: { codigo },
      include: { servico: true },
    })

    if (!agendamento) {
      return NextResponse.json({ erro: 'Agendamento não encontrado' }, { status: 404 })
    }

    // Verificar posse: telefone informado deve conferir com o do agendamento
    const telefoneLimpo = String(telefone).replace(/\D/g, '')
    if (agendamento.pacienteTelefone.slice(-8) !== telefoneLimpo.slice(-8)) {
      return NextResponse.json({ erro: 'Código ou telefone incorretos' }, { status: 403 })
    }

    const icsContent = await gerarArquivoICS({
      codigo: agendamento.codigo,
      servicoNome: agendamento.servico.nome,
      dataHora: agendamento.dataHora,
      duracaoMin: agendamento.duracaoMin,
      endereco: '', // será preenchido pela função
      clinicaNome: '',
      dentistaNome: '',
      telefone: agendamento.pacienteTelefone,
    })

    const filename = gerarNomeArquivoICS(agendamento.codigo)

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar .ics:', error)
    return NextResponse.json({ erro: 'Erro ao gerar arquivo de calendário' }, { status: 500 })
  }
}