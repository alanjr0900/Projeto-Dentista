import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const path = request.nextUrl.pathname;
  const adminPath = process.env.ADMIN_PATH || '/painel-dra-luciana';
  const publicTunnel = process.env.PUBLIC_TUNNEL_HOST;
  const adminTunnel = process.env.ADMIN_TUNNEL_HOST;

  // Se é localhost ou domínio do pinggy/trycloudflare, libera o acesso base
  if (!host || host.includes('localhost') || host.includes('pinggy') || host.includes('trycloudflare')) {
    // Se for pinggy/trycloudflare, podemos opcionalmente aplicar restrição de admin se necessário,
    // mas o usuário pediu para liberar domínios pinggy, mantendo o admin protegido.
    // Como o pinggy usa um único link para tudo, a separação por host físico não funciona (é o mesmo host).
    // Portanto, no pinggy, o admin fica acessível pelo caminho /painel-dra-luciana protegido por senha.
    return NextResponse.next();
  }

  if (!publicTunnel || !adminTunnel) {
    return NextResponse.next();
  }

  const pTunnel = publicTunnel.replace(/^https?:\/\//, '');
  const aTunnel = adminTunnel.replace(/^https?:\/\//, '');

  if (host === pTunnel) {
    if (path.startsWith(adminPath) || path.startsWith('/api/admin')) {
      return new NextResponse('Not Found', { status: 404 });
    }
  } else if (host === aTunnel) {
    if (!path.startsWith(adminPath) && !path.startsWith('/login') && !path.startsWith('/api/admin') && !path.startsWith('/_next') && !path.startsWith('/favicon.ico')) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
