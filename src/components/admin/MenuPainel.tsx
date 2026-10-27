'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BotaoSair } from '@/components/admin/BotaoSair'

interface MenuPainelProps {
  /** URL base do painel (ADMIN_PATH do .env, passado pelo layout do servidor). */
  caminhoAgenda: string
  caminhoLogin: string
}

/**
 * 3.5 — Cabeçalho administrativo: título à esquerda; Agenda, Serviços,
 * Pacientes e Configurações lado a lado à direita, cada um como botão
 * arredondado no estilo do site, com a página ativa destacada e o "Sair"
 * mais discreto. No celular os botões quebram linha.
 */
export function MenuPainel({ caminhoAgenda, caminhoLogin }: MenuPainelProps) {
  const pathname = usePathname() || ''

  const itens = [
    { rotulo: 'Agenda', href: caminhoAgenda },
    { rotulo: 'Serviços', href: `${caminhoAgenda}/servicos` },
    { rotulo: 'Pacientes', href: `${caminhoAgenda}/pacientes` },
    { rotulo: 'Configurações', href: `${caminhoAgenda}/configuracoes` },
  ]

  return (
    <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      {/* Título à esquerda */}
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-semibold text-neutral-900">
          Área da Dentista
        </h1>
        <p className="text-neutral-600 mt-1">Gerencie sua agenda, serviços e pacientes</p>
      </div>

      {/* Menu à direita — botões arredondados; ativa destacada; Sair discreto */}
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Navegação administrativa"
      >
        {itens.map(item => {
          const ativo =
            item.href === caminhoAgenda
              ? pathname === caminhoAgenda
              : pathname.startsWith(item.href)
          return (
            <a
              key={item.rotulo}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                ativo
                  ? 'bg-accent-100 text-accent-800'
                  : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {item.rotulo}
            </a>
          )
        })}
        <BotaoSair caminhoLogin={caminhoLogin} />
      </nav>
    </div>
  )
}
