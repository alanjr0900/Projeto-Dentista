'use client'

import { useEffect, useRef, useState } from 'react'

interface InformacoesDoDiaModalProps {
  aberto: boolean
  onFechar: () => void
}

/**
 * 1.5 — Modal do "Informações do dia".
 * Busca o texto na rota pública SOMENTE-LEITURA /api/aviso-do-dia e
 * renderiza como TEXTO PURO (React escapa por padrão — nunca HTML do
 * usuário). Fecha por botão X, tecla Esc e clique fora do cartão.
 */
export function InformacoesDoDiaModal({ aberto, onFechar }: InformacoesDoDiaModalProps) {
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const refCartao = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    // Busca o aviso só quando o modal abre (texto fica sempre atualizado).
    let ativo = true
    setAviso(null)
    setErro(false)
    fetch('/api/aviso-do-dia', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('erro'))))
      .then(data => {
        if (ativo) setAviso(typeof data.aviso === 'string' ? data.aviso : '')
      })
      .catch(() => {
        if (ativo) setErro(true)
      })

    // Esc fecha.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      ativo = false
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Informações do dia"
      onClick={e => {
        // Clique fora do cartão fecha.
        if (!refCartao.current?.contains(e.target as Node)) onFechar()
      }}
    >
      <div ref={refCartao} className="card-padded w-full max-w-md relative bg-white rounded-2xl shadow-soft">
        <button
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

        <div className="mt-4 text-neutral-700 leading-relaxed whitespace-pre-line">
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
}
