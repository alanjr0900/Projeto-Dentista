import { redirect } from 'next/navigation'

// Rota antiga do agendamento: redireciona para a nova página em /agendar
export default function AgendamentoRedirect() {
  redirect('/agendar')
}
