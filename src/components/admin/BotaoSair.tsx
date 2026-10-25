'use client'

import { signOut } from 'next-auth/react'

/**
 * Botão "Sair" do painel: encerra a sessão (cookie HttpOnly é apagado pelo
 * servidor do NextAuth) e volta para a tela de login, que mostra somente
 * o cartão de login.
 */
export function BotaoSair({ caminhoLogin }: { caminhoLogin: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: caminhoLogin, redirect: true })}
      className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-red-700 transition-colors"
    >
      Sair
    </button>
  )
}
