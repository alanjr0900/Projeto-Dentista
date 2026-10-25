import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

// Tamanho máximo: 5 MB
const MAX_BYTES = 5 * 1024 * 1024

// Validação por assinatura de bytes (magic bytes) — mais segura que confiar no Content-Type
const ASSINATURAS = [
  {
    ext: 'jpg',
    magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'png',
    magic: (b: Buffer) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'webp',
    magic: (b: Buffer) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
]

// POST /api/admin/upload — upload da foto da dentista
// Requer sessão admin (também garantida pelo middleware + verificação aqui)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo')

    if (!arquivo || typeof arquivo === 'string') {
      return NextResponse.json({ erro: 'Envie um arquivo de imagem' }, { status: 400 })
    }

    // Limitar tamanho
    if (arquivo.size > MAX_BYTES) {
      return NextResponse.json(
        { erro: 'Arquivo muito grande. O limite é 5 MB.' },
        { status: 413 }
      )
    }

    // Ler bytes e identificar tipo real pela assinatura
    const bytes = Buffer.from(await arquivo.arrayBuffer())
    if (bytes.length === 0) {
      return NextResponse.json({ erro: 'Arquivo vazio' }, { status: 400 })
    }

    const tipo = ASSINATURAS.find(t => t.magic(bytes))
    if (!tipo) {
      return NextResponse.json(
        { erro: 'Tipo de arquivo não permitido. Envie JPG, PNG ou WebP.' },
        { status: 415 }
      )
    }

    // Pasta de destino e nome único
    const pastaUploads = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(pastaUploads, { recursive: true })
    const nomeArquivo = `foto-dentista-${Date.now()}.${tipo.ext}`
    const caminhoCompleto = path.join(pastaUploads, nomeArquivo)

    // Guardar caminho anterior para limpeza
    const configAnterior = await prisma.configuracao.findUnique({
      where: { chave: 'dentista_foto' },
    })
    const fotoAnterior = configAnterior?.valor || ''

    await fs.writeFile(caminhoCompleto, bytes)

    const caminhoPublico = `/uploads/${nomeArquivo}`

    // Gravar no banco o caminho da imagem salva
    await prisma.configuracao.upsert({
      where: { chave: 'dentista_foto' },
      update: { valor: caminhoPublico },
      create: { chave: 'dentista_foto', valor: caminhoPublico },
    })

    // Remover a foto anterior se também era um arquivo de upload local
    // (o valor pode estar como caminho "/uploads/…" ou URL completa no mesmo host)
    const nomeAnterior = fotoAnterior.split(/[\\/]/).pop() || ''
    if (nomeAnterior.startsWith('foto-dentista-')) {
      try {
        await fs.unlink(path.join(pastaUploads, nomeAnterior))
      } catch {
        // Arquivo anterior já não existe; ignorar
      }
    }

    return NextResponse.json(
      { caminho: caminhoPublico, mensagem: 'Foto enviada com sucesso' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ erro: 'Erro ao enviar arquivo' }, { status: 500 })
  }
}
