import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/aviso-do-dia — rota pública SOMENTE DE LEITURA.
 * Devolve apenas o texto livre "Informações do dia" gravado no painel.
 * Nada de HTML é interpretado: o cliente renderiza o texto como conteúdo
 * de texto puro (React escapa por padrão).
 */
export async function GET() {
  try {
    const registro = await prisma.configuracao.findUnique({
      where: { chave: 'aviso_do_dia' },
      select: { valor: true },
    })
    return NextResponse.json(
      { aviso: typeof registro?.valor === 'string' ? registro.valor : '' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    // Sem banco, a página pública mostra "Nenhum aviso para hoje".
    return NextResponse.json({ aviso: '' }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
