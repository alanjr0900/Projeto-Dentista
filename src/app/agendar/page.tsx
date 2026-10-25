import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { AbaAgendamento } from '@/components/agendamento/AbaAgendamento'
import { getConfiguracoes } from '@/lib/config'

export const metadata = {
  title: 'Agendar consulta - Consultório Dra. [Nome da Dentista]',
  description: 'Escolha o serviço, o dia e o horário da sua consulta odontológica online, em poucos cliques.',
}

export default async function AgendarPage() {
  const cfg = await getConfiguracoes()
  return (
    <>
      <Header nomeDentista={cfg.dentistaNome} />
      <main id="main-content" className="flex-1" role="main">
        <div className="container-pad py-8 lg:py-12">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold text-neutral-900 sm:text-4xl">
              Agendar consulta
            </h1>
            <p className="mt-3 text-neutral-600 max-w-xl mx-auto">
              Escolha o serviço, o dia e o horário — você receberá um código para consultar, cancelar ou remarcar quando quiser.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="text-center py-12 text-neutral-500" role="status">
                Carregando agendamento…
              </div>
            }
          >
            <AbaAgendamento />
          </Suspense>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}
