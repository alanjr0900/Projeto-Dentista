import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { MenuPainel } from '@/components/admin/MenuPainel'
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
          {/* 3.5 — Título à esquerda + menu à direita (componente client p/ página ativa) */}
          <MenuPainel caminhoAgenda={ADMIN_PATH} caminhoLogin={ADMIN_LOGIN_PATH} />
          {children}
        </div>
      </main>
    </>
  )
}
