import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarLinkConfirmacao } from '@/lib/whatsapp'

// POST - Gerar link do WhatsApp com mensagem pré-preenchida
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

    const link = await gerarLinkConfirmacao({
      codigo: agendamento.codigo,
      pacienteNome: agendamento.pacienteNome,
      servicoNome: agendamento.servico.nome,
      dataHora: agendamento.dataHora,
      endereco: '', // preenchido pela função
      clinicaNome: '',
      dentistaNome: '',
      telefoneClinica: '',
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Erro ao gerar link WhatsApp:', error)
    return NextResponse.json({ erro: 'Erro ao gerar link' }, { status: 500 })
  }
}