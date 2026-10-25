'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface HeaderProps {
  /** True quando o header está dentro do painel (esconde a navegação pública). */
  isAdminPage?: boolean
  /** Nome do profissional usado no texto alternativo e no aria-label do logo. */
  nomeDentista?: string
}

export function Header({ isAdminPage = false, nomeDentista = 'Dra. [Nome]' }: HeaderProps) {
  const pathname = usePathname()
  const isPublic = !isAdminPage

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
      <div className="container-pad">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
            aria-label={`Página inicial - ${nomeDentista}`}
          >
            <Image
              src="/logo/logo-horizontal.png"
              alt={`${nomeDentista} — Odontologia`}
              width={842}
              height={245}
              priority
              sizes="(max-width: 640px) 140px, (max-width: 1024px) 170px, 200px"
              className="h-10 w-auto sm:h-12 lg:h-14"
            />
          </Link>

          {/* Navegação publicada */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navegação principal">
            {isPublic && (
              <>
                <Link
                  href="/"
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    pathname === '/'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:text-primary-600 hover:bg-primary-50'
                  )}
                  aria-current={pathname === '/' ? 'page' : undefined}
                >
                  Início
                </Link>
                <Link
                  href="/#sobre"
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                >
                  Sobre
                </Link>
                <Link
                  href="/#servicos"
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                >
                  Serviços
                </Link>
                <Link
                  href="/#contato"
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                >
                  Contato
                </Link>
                <Link
                  href="/agendar"
                  className="btn btn-primary ml-3 px-6 py-2.5"
                  aria-current={pathname === '/agendar' ? 'page' : undefined}
                  data-testid="nav-agendar"
                >
                  Agendar consulta
                </Link>
              </>
            )}
          </nav>

          {/* Ações mobile: CTA de agendamento em destaque */}
          <div className="lg:hidden flex items-center gap-2">
            {isPublic && (
              <Link
                href="/agendar"
                className="btn btn-primary px-4 py-2 text-sm"
                data-testid="nav-agendar-mobile"
              >
                Agendar
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
