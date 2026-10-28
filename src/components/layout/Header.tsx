'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { InformacoesDoDiaModal } from '@/components/layout/InformacoesDoDia'

/**
 * Último aviso que o visitante já viu/dispensou.
 * Variável de MÓDULO (não de componente): sobrevive à navegação interna do
 * site, mas zera a cada recarga completa da página — então o aviso reabre
 * quando a página é recarregada ou quando a doutora troca o texto, e não
 * reabre enquanto o visitante só navega entre as páginas.
 */
let avisoVisto = ''

/** Intervalo de reconsulta da mensagem (mostra a versão mais recente do painel). */
const INTERVALO_ATUALIZACAO_MS = 30_000

interface HeaderProps {
  /** True quando o header está dentro do painel (esconde a navegação pública). */
  isAdminPage?: boolean
  /** Nome do profissional usado no texto alternativo e no aria-label do logo. */
  nomeDentista?: string
}

export function Header({ isAdminPage = false, nomeDentista = 'Dra. [Nome]' }: HeaderProps) {
  const pathname = usePathname()
  const isPublic = !isAdminPage
  // 1.5 — Estado do modal "Informações do dia" (compartilhado entre desktop e mobile).
  const [avisoAberto, setAvisoAberto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null) // null = ainda carregando
  const [erroAviso, setErroAviso] = useState(false)
  const abertoRef = useRef(false)
  const avisoRef = useRef<string | null>(null)
  const ativoRef = useRef(true)

  const abrirModal = useCallback(() => {
    abertoRef.current = true
    setAvisoAberto(true)
  }, [])

  /** Fecha e registra o texto exibido: não reabre até recarregar ou o texto mudar. */
  const fecharModal = useCallback(() => {
    abertoRef.current = false
    avisoVisto = avisoRef.current ?? ''
    setAvisoAberto(false)
  }, [])

  /** Busca a mensagem atual do painel e atualiza o estado (sempre a mais recente). */
  const buscarAviso = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/aviso-do-dia', { cache: 'no-store' })
      if (!res.ok) throw new Error('erro')
      const data = await res.json()
      if (!ativoRef.current) return null
      const texto = typeof data.aviso === 'string' ? data.aviso : ''
      avisoRef.current = texto
      setAviso(texto)
      setErroAviso(false)
      return texto
    } catch {
      if (ativoRef.current) setErroAviso(true)
      return null
    }
  }, [])

  /** Abre o aviso pelo botão do header, sempre com a versão mais recente. */
  const abrirAvisoPeloBotao = useCallback(async () => {
    const texto = await buscarAviso()
    if (!ativoRef.current) return
    if (texto !== null) avisoVisto = texto
    abrirModal()
  }, [buscarAviso, abrirModal])

  /**
   * Verifica a mensagem ao carregar a página e a cada intervalo: se existir
   * texto novo (diferente do último visto pelo visitante), abre o aviso
   * sozinho. Texto vazio não abre nada e limpa o registro.
   */
  const sincronizarAviso = useCallback(async () => {
    const texto = await buscarAviso()
    if (texto === null || !ativoRef.current) return
    if (texto.trim() === '') {
      avisoVisto = ''
      return
    }
    if (abertoRef.current || texto === avisoVisto) return
    avisoVisto = texto
    abrirModal()
  }, [buscarAviso, abrirModal])

  // Ao abrir o site: busca a mensagem atual e abre o aviso se houver texto.
  // Também reconsulta ao voltar para a aba e a cada 30s (versão mais recente).
  useEffect(() => {
    ativoRef.current = true
    if (!isPublic) return

    void sincronizarAviso()

    const idIntervalo = window.setInterval(() => {
      if (!document.hidden) void sincronizarAviso()
    }, INTERVALO_ATUALIZACAO_MS)

    const aoFicarVisivel = () => {
      if (!document.hidden) void sincronizarAviso()
    }
    document.addEventListener('visibilitychange', aoFicarVisivel)
    window.addEventListener('focus', aoFicarVisivel)

    return () => {
      ativoRef.current = false
      window.clearInterval(idIntervalo)
      document.removeEventListener('visibilitychange', aoFicarVisivel)
      window.removeEventListener('focus', aoFicarVisivel)
    }
  }, [isPublic, sincronizarAviso])

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
      <div className="container-pad">
        <div className="flex items-center justify-between gap-2 h-16 lg:h-20">
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
                {/* 1.5 — Botão "Informações do dia", antes de "Agendar consulta" */}
                <button
                  type="button"
                  onClick={() => void abrirAvisoPeloBotao()}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  Informações do dia
                </button>
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

          {/* Ações mobile: CTA de agendamento em destaque + aviso do dia em texto */}
          <div className="lg:hidden flex min-w-0 items-center gap-1.5 sm:gap-2">
            {isPublic && (
              <>
                <button
                  type="button"
                  onClick={() => void abrirAvisoPeloBotao()}
                  className="min-w-[76px] rounded-xl px-1.5 py-1.5 text-center text-[11px] font-medium leading-tight text-neutral-600 transition-all duration-200 hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-[380px]:min-w-0 min-[380px]:whitespace-nowrap min-[380px]:px-2.5 min-[380px]:text-xs sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Informações do dia
                </button>
                <Link
                  href="/agendar"
                  className="btn btn-primary btn-compact shrink-0"
                  data-testid="nav-agendar-mobile"
                >
                  Agendar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 — Modal do aviso do dia (abre sozinho com texto novo; fecha por botão, Esc e clique fora) */}
      {isPublic && (
        <InformacoesDoDiaModal
          aberto={avisoAberto}
          aviso={aviso}
          erro={erroAviso}
          onFechar={fecharModal}
        />
      )}
    </header>
  )
}
