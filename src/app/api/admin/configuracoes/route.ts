import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { configuracaoSchema } from '@/lib/validations'
import fs from 'fs/promises'
import path from 'path'

// POST - Atualizar múltiplas configurações
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Valor anterior da foto, para limpar o arquivo local se for substituído por URL
    const fotoAnterior = (await prisma.configuracao.findUnique({
      where: { chave: 'dentista_foto' },
    }))?.valor || ''
    
    // Validar
    const resultado = configuracaoSchema.safeParse(body)
    if (!resultado.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: resultado.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const dados = resultado.data

    // Mapear campos para chaves do banco
    const mapeamento: Record<string, string> = {
      clinicaNome: 'clinica_nome',
      clinicaEndereco: 'clinica_endereco',
      clinicaTelefone: 'clinica_telefone',
      clinicaWhatsApp: 'clinica_whatsapp',
      clinicaEmail: 'clinica_email',
      dentistaNome: 'dentista_nome',
      dentistaCRO: 'dentista_cro',
      dentistaFormacao: 'dentista_formacao',
      dentistaExperiencia: 'dentista_experiencia',
      dentistaFoto: 'dentista_foto',
      duracaoPadraoMinutos: 'duracao_padrao_minutos',
      antecedenciaMinimaHoras: 'antecedencia_minima_horas',
      limiteDiasFuturo: 'limite_dias_futuro',
      intervaloAgendamentoMinutos: 'intervalo_agendamento_minutos',
      limiteAgendamentosIpHora: 'limite_agendamentos_ip_hora',
    }

    // Atualizar configurações simples
    for (const [campo, chave] of Object.entries(mapeamento)) {
      const valor = dados[campo as keyof typeof dados]
      if (valor !== undefined && valor !== '') {
        await prisma.configuracao.upsert({
          where: { chave },
          update: { valor: String(valor) },
          create: { chave, valor: String(valor) },
        })
      }
    }

    // Atualizar horários
    if (dados.horarios) {
      const diasMap: Record<string, string> = {
        '0': 'dom', '1': 'seg', '2': 'ter', '3': 'qua', '4': 'qui', '5': 'sex', '6': 'sab',
      }
      
      for (const [diaNum, periodos] of Object.entries(dados.horarios)) {
        const diaKey = diasMap[diaNum]
        if (diaKey) {
          const valor = periodos.map((p: { inicio: string; fim: string }) => `${p.inicio}-${p.fim}`).join(',')
          await prisma.configuracao.upsert({
            where: { chave: `horario_funcionamento_${diaKey}` },
            update: { valor },
            create: { chave: `horario_funcionamento_${diaKey}`, valor },
          })
        }
      }
    }

    // A foto aceita UMA opção por vez: se ela era um arquivo local e agora virou
    // URL (ou foi limpa), remover o arquivo órfão do disco
    const novoValorFoto = String(dados.dentistaFoto ?? '')
    const mesmoArquivo = novoValorFoto === fotoAnterior ||
      (fotoAnterior.split(/[\\/]/).pop() || '') === (novoValorFoto.split(/[\\/]/).pop() || '')
    const nomeAnterior = fotoAnterior.split(/[\\/]/).pop() || ''
    if (nomeAnterior.startsWith('foto-dentista-') && !mesmoArquivo) {
      try {
        await fs.unlink(path.join(process.cwd(), 'public', 'uploads', nomeAnterior))
      } catch {
        // arquivo já não existe; ignorar
      }
    }

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Erro ao salvar configurações:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}