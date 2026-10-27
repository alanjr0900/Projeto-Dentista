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
        take: 50,
      },
      _count: { select: { agendamentos: true } },
    },
  })

  // 3.3 — Ordem cronológica a partir do primeiro agendamento pelo site.
  // Pacientes que ainda não têm primeiro agendamento ficam no fim.
  pacientes.sort((a, b) => {
    const ta = a.primeiroAgendamentoEm ? new Date(a.primeiroAgendamentoEm).getTime() : Infinity
    const tb = b.primeiroAgendamentoEm ? new Date(b.primeiroAgendamentoEm).getTime() : Infinity
    if (ta !== tb) return ta - tb
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return <AdminPacientes pacientes={pacientes} />
}
