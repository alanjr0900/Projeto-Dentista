import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_LOGIN_PATH } from '@/lib/constants'
import { AdminServicos } from '@/components/admin/AdminServicos'

export default async function ServicosPage() {
  const session = await auth()
  if (!session?.user) {
    redirect(ADMIN_LOGIN_PATH)
  }

  const servicos = await prisma.servico.findMany({
    orderBy: { ordem: 'asc' },
  })

  return <AdminServicos servicos={servicos} />
}
