import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_LOGIN_PATH } from '@/lib/constants'
import { AdminPacientes } from '@/components/admin/AdminPacientes'

export default async function PacientesPage() {
  const session = await auth()
  if (!session?.user) {
    redirect(ADMIN_LOGIN_PATH)
  }

  const pacientes = await prisma.paciente.findMany({
    include: {
      agendamentos: {
        include: { servico: true },
        orderBy: { dataHora: 'desc' },
        take: 5,
      },
      _count: { select: { agendamentos: true } },
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  return <AdminPacientes pacientes={pacientes} />
}
