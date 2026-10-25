'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** Só aceita caminhos internos; evita open redirect via ?callbackUrl=. */
function caminhoSeguro(valor: string | null, padrao: string): string {
  if (!valor) return padrao
  if (!valor.startsWith('/') || valor.startsWith('//')) return padrao
  return valor
}

export default function LoginPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Ex.: /painel-dra-luciana/login -> /painel-dra-luciana
  const basePath = (pathname || '').replace(/\/login\/?$/, '') || '/'
  const callbackUrl = caminhoSeguro(searchParams.get('callbackUrl'), basePath)
  const error = searchParams.get('error')

  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(error ? 'Senha incorreta. Tente novamente.' : null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!senha.trim()) {
      setErro('Digite a senha')
      return
    }

    setCarregando(true)
    setErro(null)

    try {
      const resultado = await signIn('credentials', {
        senha,
        honeypot: '',
        redirect: false,
        callbackUrl,
      })

      if (resultado?.error) {
        setErro(
          'Senha incorreta. Por segurança, após várias tentativas erradas o acesso fica bloqueado por alguns minutos.'
        )
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setErro('Erro ao entrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main id="main-content" className="flex-1 flex items-center justify-center py-12 px-4" role="main">
      <div className="w-full max-w-md">
        <div className="card-padded text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 flex items-center justify-center" aria-hidden="true">
            <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">Área Restrita</h1>
          <p className="text-neutral-600">Digite a senha do consultório para acessar a agenda</p>

          {erro && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-left" role="alert">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-red-700 text-sm">{erro}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group text-left">
              <label htmlFor="senha" className="label">Senha de acesso</label>
              <div className="relative">
                <input
                  type="password"
                  id="senha"
                  name="senha"
                  autoComplete="current-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  required
                  disabled={carregando}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <button type="submit" className="btn btn-primary btn-full" disabled={carregando}>
              {carregando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" strokeLinecap="round" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar na área administrativa'
              )}
            </button>
          </form>

          <p className="text-xs text-neutral-500">
            Acesso restrito à dentista. Sessão expira em 8 horas.
          </p>
        </div>
      </div>
    </main>
  )
}
