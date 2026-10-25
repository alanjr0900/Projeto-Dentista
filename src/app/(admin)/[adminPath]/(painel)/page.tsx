import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getConfiguracoes } from '@/lib/config'
import { ADMIN_LOGIN_PATH } from '@/lib/constants'
import { AdminAgenda } from '@/components/admin/AdminAgenda'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) {
    redirect(ADMIN_LOGIN_PATH)
  }

  const cfg = await getConfiguracoes()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fimDia = new Date(hoje)
  fimDia.setHours(23, 59, 59, 999)

  // Buscar agendamentos de hoje
  const agendamentosHoje = await prisma.agendamento.findMany({
    where: {
      dataHora: { gte: hoje, lte: fimDia },
      status: { notIn: ['CANCELADO'] },
    },
    include: { servico: true },
    orderBy: { dataHora: 'asc' },
  })

  // Buscar agendamentos da semana
  const fimSemana = new Date(hoje)
  fimSemana.setDate(fimSemana.getDate() + 7)

  const agendamentosSemana = await prisma.agendamento.findMany({
    where: {
      dataHora: { gte: hoje, lte: fimSemana },
      status: { notIn: ['CANCELADO'] },
    },
    include: { servico: true },
    orderBy: { dataHora: 'asc' },
  })

  // Estatísticas
  const stats = {
    hoje: agendamentosHoje.length,
    semana: agendamentosSemana.length,
    pendentes: agendamentosHoje.filter(a => a.status === 'PENDENTE').length,
    confirmados: agendamentosHoje.filter(a => a.status === 'CONFIRMADO').length,
  }

  return (
    <AdminAgenda
      agendamentosHoje={agendamentosHoje}
      agendamentosSemana={agendamentosSemana}
      stats={stats}
      configuracoes={cfg}
    />
  )
}
