import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { MinhaConsulta } from '@/components/consulta/MinhaConsulta'
import { getConfiguracoes } from '@/lib/config'
import { linkWhatsApp } from '@/lib/contato'

export const metadata = {
  title: 'Minha consulta — acesso por código no e-mail',
  description:
    'Receba um código de acesso no seu e-mail para ver diagnósticos liberados, remarcar ou cancelar sua consulta com segurança.',
  robots: { index: false, follow: false },
}

export default async function MinhaConsultaPage() {
  const cfg = await getConfiguracoes()
  const whatsappLink = linkWhatsApp('Olá! Preciso de ajuda com a minha consulta.')

  return (
    <>
      <Header nomeDentista={cfg.dentistaNome} />
      <main id="main-content" className="flex-1" role="main">
        <div className="container-pad py-8 lg:py-12">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold text-neutral-900 sm:text-4xl">
              Minha consulta
            </h1>
            <p className="mt-3 text-neutral-600 max-w-xl mx-auto">
              Informe seu e-mail para receber um código de acesso. Depois de entrar, você vê os
              diagnósticos que a dentista liberou e pode remarcar ou cancelar com segurança.
            </p>
          </div>
          <MinhaConsulta whatsappLink={whatsappLink} />
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}
