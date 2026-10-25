import { notFound } from 'next/navigation'
import { ADMIN_SEGMENT } from '@/lib/constants'

// O painel vive no route group dinâmico (admin)/[adminPath], mas só responde
// quando o segmento da URL é exatamente o ADMIN_PATH configurado no .env.
// Qualquer outro valor (inclusive "admin") cai em 404.
//
// Este layout é o MÍNIMO comum entre o login e o painel: apenas valida o
// segmento e repassa os filhos. Ele NÃO renderiza header, título, menu nem
// qualquer outro conteúdo interno — assim a tela de login (que não passa
// pelo branch do grupo (painel)) exibe SOMENTE o cartão de login.
//
// A proteção de autenticação fica em:
// 1. src/middleware.ts (no servidor, antes de entrar na página)
// 2. src/app/(admin)/[adminPath]/(painel)/layout.tsx (exige sessão e renderiza
//    todo o conteúdo interno somente DEPOIS dela)
// 3. Cada página individual (redirect para o login sem sessão)
export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { adminPath: string }
}) {
  if (!segmentoValido(params.adminPath)) {
    notFound()
  }

  return <>{children}</>
}

function segmentoValido(segmento: string): boolean {
  if (segmento === ADMIN_SEGMENT) return true
  try {
    return decodeURIComponent(segmento) === ADMIN_SEGMENT
  } catch {
    return false
  }
}
