import { auth } from '@/lib/auth'
import { ADMIN_LOGIN_PATH, ADMIN_PATH, isAdminPath } from '@/lib/constants'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Separação por host (dois túneis temporários do Cloudflare)
//
// PUBLIC_TUNNEL_HOST -> site do cliente (apresentação + agendamento)
// ADMIN_TUNNEL_HOST  -> somente painel, login e APIs do painel
//
// Se as duas variáveis estiverem vazias, nada muda: o comportamento é o mesmo
// de antes. Se pelo menos uma estiver preenchida, qualquer host externo que não
// seja um dos dois é tratado como desconhecido e recebe 404.
//
// localhost e IPs de rede local continuam liberando tudo para o trabalho local.
// ---------------------------------------------------------------------------

const PUBLIC_TUNNEL_HOST = normalizarHost(process.env.PUBLIC_TUNNEL_HOST)
const ADMIN_TUNNEL_HOST = normalizarHost(process.env.ADMIN_TUNNEL_HOST)
const HOST_SEPARATION_ATIVA = Boolean(PUBLIC_TUNNEL_HOST || ADMIN_TUNNEL_HOST)

/** Normaliza um host/URL para comparação: minúsculo, sem protocolo, path ou porta. */
function normalizarHost(valor: string | null | undefined): string {
  let host = (valor ?? '').trim().toLowerCase()
  if (!host) return ''

  if (host.includes('://')) {
    try {
      host = new URL(host).host
    } catch {
      host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    }
  }

  host = host.split('/')[0].split('?')[0].split('#')[0]

  // IPv6 entre colchetes: mantém os colchetes e descarta a porta.
  if (host.startsWith('[')) {
    const fim = host.indexOf(']')
    return fim === -1 ? host : host.slice(0, fim + 1)
  }

  return host.split(':')[0]
}

/** Normaliza o pathname para evitar bypass com %2F, //, .. ou barras invertidas. */
function normalizarPathname(pathname: string): string {
  let path = pathname

  try {
    path = decodeURIComponent(path)
  } catch {
    // Mantém o valor original se houver percent-encoding inválido.
  }

  path = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/')

  try {
    path = new URL(path, 'http://local').pathname
  } catch {
    // Mantém o valor já normalizado.
  }

  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path || '/'
}

/** localhost, 127.0.0.1, ::1 e faixas privadas de IPv4. */
function ehRedeLocal(host: string): boolean {
  const semColchetes = host.startsWith('[') ? host.slice(1, -1) : host

  if (semColchetes === 'localhost' || semColchetes.endsWith('.localhost')) return true
  if (semColchetes === '127.0.0.1' || semColchetes === '::1' || semColchetes === '0.0.0.0') {
    return true
  }

  const ipv4 = semColchetes.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }

  return false
}

function naoEncontrado(req: NextRequest, pathname: string): NextResponse {
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
  }

  // Usa a página 404 do próprio Next, mantendo o status 404.
  return NextResponse.rewrite(new URL('/_not-found', req.url), { status: 404 })
}

/**
 * Decide o acesso antes da autenticação. Retorna null quando a requisição pode
 * seguir para as regras normais de login do painel.
 */
function aplicarSeparacaoPorHost(req: NextRequest): NextResponse | null {
  if (!HOST_SEPARATION_ATIVA) return null

  const pathname = normalizarPathname(req.nextUrl.pathname)

  // O rewrite para /_not-found não deve passar de novo por esta lógica.
  if (pathname === '/_not-found') return NextResponse.next()

  const host = normalizarHost(
    req.headers.get('host') || req.headers.get('x-forwarded-host') || req.nextUrl.host
  )

  // Trabalho local continua exatamente como antes.
  if (ehRedeLocal(host)) return null

  const isApi = pathname === '/api' || pathname.startsWith('/api/')
  const isAdminPage = isAdminPath(pathname)
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/')
  const isAuthApi = pathname === '/api/auth' || pathname.startsWith('/api/auth/')

  // --- Link do cliente: o painel não existe de nenhuma forma ---
  if (host === PUBLIC_TUNNEL_HOST) {
    if (isAdminPage || isAdminApi || isAuthApi) {
      return naoEncontrado(req, pathname)
    }
    return null
  }

  // --- Link do painel: só painel, login e APIs usadas por ele ---
  if (host === ADMIN_TUNNEL_HOST) {
    if (isAdminPage || isAdminApi || isAuthApi) {
      return null
    }

    // APIs públicas não devem responder no host do painel.
    if (isApi) {
      return naoEncontrado(req, pathname)
    }

    // Qualquer página pública cai no painel (que, sem sessão, pede login).
    return NextResponse.redirect(new URL(ADMIN_PATH, req.url))
  }

  // Host externo não configurado (ex.: um terceiro túnel) não acessa nada.
  return naoEncontrado(req, pathname)
}

const authMiddleware = auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isOnAdminPages = isAdminPath(pathname)
  const isOnLogin = pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  const isOnAdminApi = pathname.startsWith('/api/admin')

  // APIs administrativas: sem sessão => 401 JSON (não redirecionar)
  if (isOnAdminApi && !isLoggedIn) {
    return NextResponse.json(
      { erro: 'Não autorizado. Faça login na área administrativa.' },
      { status: 401 }
    )
  }

  // Páginas administrativas: sem sessão => redireciona para o login do painel
  if (isOnAdminPages && !isOnLogin && !isLoggedIn) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, req.nextUrl))
  }

  return NextResponse.next()
})

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const bloqueio = aplicarSeparacaoPorHost(req)
  if (bloqueio) return bloqueio

  // O callback de autorização do NextAuth foi simplificado em src/lib/auth.ts:
  // as regras de sessão do painel ficam aqui, depois da separação por host.
  // O wrapper auth() do next-auth tipa o 2º parâmetro de outra forma; o
  // NextFetchEvent é compatível em runtime, por isso o ajuste de tipo.
  const chamadaAuth = authMiddleware as unknown as (
    req: NextRequest,
    evento: NextFetchEvent
  ) => NextResponse
  return chamadaAuth(req, event)
}

export const config = {
  // Roda em tudo que não seja asset estático (_next, imagens, fontes...).
  // Precisamos disso porque o caminho do painel é dinâmico (ADMIN_PATH),
  // e o matcher do Next precisa ser uma string estática.
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
}
