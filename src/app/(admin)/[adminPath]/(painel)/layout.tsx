import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { BotaoSair } from '@/components/admin/BotaoSair'
import { getConfiguracoes } from '@/lib/config'
import { ADMIN_PATH, ADMIN_LOGIN_PATH } from '@/lib/constants'
import { auth } from '@/lib/auth'

// Layout das páginas INTERNAS do painel (Agenda, Serviços, Pacientes,
// Configurações). A tela de login NÃO passa por aqui — por isso pode
// exibir somente o cartão de login, sem nada da área interna.
//
// REGRA PERMANENTE (também em AGENTS.md e docs/arquitetura.md):
// - Todo o conteúdo interno (header, título, menu, subtítulo) é renderizado
//   SOMENTE após sessão válida verificada AQUI NO SERVIDOR. Não é uma ocultação
//   com CSS: sem sessão este layout redireciona e o conteúdo interno nem
//   entra no HTML entregue ao navegador.
// - As páginas individualmente também revalidam a sessão antes de consultar
//   dados (cuidado extra, pois layout e página podem renderizar em paralelo).
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cfg, session] = await Promise.all([getConfiguracoes(), auth()])

  // Sem sessão: redireciona para o login. Nada do painel é renderizado.
  if (!session?.user) {
    redirect(ADMIN_LOGIN_PATH)
  }

  return (
    <>
      <Header isAdminPage nomeDentista={cfg.dentistaNome} />
      <main id="main-content" className="flex-1 bg-neutral-50" role="main">
        <div className="container-pad py-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl lg:text-3xl font-semibold text-neutral-900">
                Área da Dentista
              </h1>
              <p className="text-neutral-600 mt-1">Gerencie sua agenda, serviços e pacientes</p>
            </div>
            <nav className="flex flex-wrap items-center gap-2" aria-label="Navegação administrativa">
              <a href={ADMIN_PATH} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent-100 text-accent-800">Agenda</a>
              <a href={`${ADMIN_PATH}/servicos`} className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100">Serviços</a>
              <a href={`${ADMIN_PATH}/pacientes`} className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100">Pacientes</a>
              <a href={`${ADMIN_PATH}/configuracoes`} className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100">Configurações</a>
              <BotaoSair caminhoLogin={ADMIN_LOGIN_PATH} />
            </nav>
          </div>
          {children}
        </div>
      </main>
    </>
  )
}
