import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_LOGIN_PATH } from '@/lib/constants'
import { AdminConfiguracoes } from '@/components/admin/AdminConfiguracoes'

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user) {
    redirect(ADMIN_LOGIN_PATH)
  }

  const configuracoes = await prisma.configuracao.findMany()
  const mapa = Object.fromEntries(configuracoes.map(c => [c.chave, c.valor]))

  return <AdminConfiguracoes configuracoes={mapa} />
}
