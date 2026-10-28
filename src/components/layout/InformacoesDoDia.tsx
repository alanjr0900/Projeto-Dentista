'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface InformacoesDoDiaModalProps {
  aberto: boolean
  /** Texto atual vindo do Header (null = ainda carregando). */
  aviso: string | null
  /** True quando a busca em /api/aviso-do-dia falhou. */
  erro: boolean
  onFechar: () => void
}

/**
 * 1.5 — Modal do "Informações do dia".
 * O texto é buscado/monitorado pelo Header (rota pública SOMENTE-LEITURA
 * /api/aviso-do-dia) e chega por props, então o modal sempre mostra a
 * versão mais recente gravada no painel. Renderiza como TEXTO PURO
 * (React escapa por padrão — nunca HTML do usuário). Fecha por botão X,
 * tecla Esc e clique fora do cartão.
 *
 * O modal é renderizado em um portal no <body>: dentro do <header> ele
 * herdaria o contexto de empilhamento (e o `backdrop-filter` do header,
 * que vira bloco contentor de elementos `fixed`), ficando preso no topo.
 */
export function InformacoesDoDiaModal({ aberto, aviso, erro, onFechar }: InformacoesDoDiaModalProps) {
  const refCartao = useRef<HTMLDivElement>(null)
  const refBotaoFechar = useRef<HTMLButtonElement>(null)
  const refFocoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!aberto) return

    // Esc fecha.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, onFechar])

  // Trava a rolagem da página enquanto o modal estiver aberto.
  useEffect(() => {
    if (!aberto) return
    const html = document.documentElement
    const overflowHtml = html.style.overflow
    const overflowBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = overflowHtml
      document.body.style.overflow = overflowBody
    }
  }, [aberto])

  // Foco vai para o botão de fechar ao abrir e volta ao elemento anterior ao fechar.
  useEffect(() => {
    if (!aberto) {
      refFocoAnterior.current?.focus?.()
      refFocoAnterior.current = null
      return
    }
    refFocoAnterior.current = document.activeElement as HTMLElement | null
    refBotaoFechar.current?.focus()
  }, [aberto])

  if (!aberto || typeof document === 'undefined') return null

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/60 backdrop-blur-[6px] p-4 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Informações do dia"
      onMouseDown={e => {
        // Clique fora do cartão (na máscara) fecha.
        if (!refCartao.current?.contains(e.target as Node)) onFechar()
      }}
    >
      <div
        ref={refCartao}
        className="card-padded relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col bg-white rounded-2xl shadow-soft sm:max-h-[calc(100dvh-3rem)]"
      >
        <button
          ref={refBotaoFechar}
          type="button"
          onClick={onFechar}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Fechar informações do dia"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="font-heading text-xl font-semibold text-neutral-900 pr-8">Informações do dia</h2>

        <div className="mt-4 min-h-0 overflow-y-auto text-neutral-700 leading-relaxed whitespace-pre-line">
          {erro ? (
            <p className="text-neutral-500">Não foi possível carregar as informações. Tente novamente.</p>
          ) : aviso === null ? (
            <p className="text-neutral-400">Carregando…</p>
          ) : aviso.trim() === '' ? (
            <p className="text-neutral-500">Nenhum aviso para hoje.</p>
          ) : (
            // Texto puro gravado no painel — renderizado como texto, sem HTML.
            aviso
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
