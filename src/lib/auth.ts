import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { ADMIN_LOGIN_PATH } from '@/lib/constants'
import { limparTentativas, registrarFalha, verificarBloqueio } from '@/lib/rate-limit'

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
const AUTH_SECRET = process.env.AUTH_SECRET

if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET não configurado')
}

// Se não há hash salvo, criamos no primeiro login
async function getOrCreatePasswordHash(plainPassword: string): Promise<string> {
  if (ADMIN_PASSWORD_HASH) {
    return ADMIN_PASSWORD_HASH
  }
  // Primeiro login - hashear a senha do .env
  const hash = await bcrypt.hash(plainPassword, 12)
  // Em produção, isso deveria ser salvo no banco ou .env
  // Por simplicidade, retornamos o hash (não persistido entre restarts)
  return hash
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: AUTH_SECRET,
  // Necessário atrás do Cloudflare Tunnel para o Auth.js confiar no Host
  // encaminhado. A separação/validação de hosts fica no middleware.
  trustHost: true,
  session: {
    // Só existem 'jwt' | 'database' no Auth.js v5.
    // Com provider Credentials não há adapter de banco, então 'jwt'
    // (o token JWT vai no cookie de sessão — funciona no middleware Edge).
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },
  cookies: {
    sessionToken: {
      name: 'dentista-session',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
      },
    },
  },
  pages: {
    signIn: ADMIN_LOGIN_PATH,
    error: ADMIN_LOGIN_PATH,
  },
  providers: [
    Credentials({
      name: 'Senha do Consultório',
      credentials: {
        senha: { label: 'Senha', type: 'password' },
        honeypot: { label: '', type: 'text' },
      },
      authorize: async (credentials) => {
        // Honeypot
        if (credentials?.honeypot) {
          return null
        }

        const { senha } = await z.object({
          senha: z.string().min(1),
          honeypot: z.string().max(0).optional(),
        }).parseAsync(credentials)

        const passwordFromEnv = process.env.ADMIN_PASSWORD
        if (!passwordFromEnv) {
          console.error('ADMIN_PASSWORD não configurado')
          return null
        }

        const { bloqueado } = verificarBloqueio()
        if (bloqueado) {
          console.warn('Login bloqueado temporariamente por excesso de tentativas.')
          return null
        }

        const hash = await getOrCreatePasswordHash(passwordFromEnv)
        const valido = await bcrypt.compare(senha, hash)

        if (!valido) {
          registrarFalha()
          return null
        }

        limparTentativas()

        return {
          id: 'admin',
          name: 'Administrador',
          role: 'admin',
        }
      },
    }),
  ],
  callbacks: {
    // Persistir role no JWT no momento do login (authorize) ...
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as Record<string, unknown>).role
      }
      return token
    },
    // ... e expor role na sessão consultada por auth()/middleware/rotas
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.role = token.role as string
      }
      return session
    },
    authorized: async () => {
      // As regras de sessão do painel ficam no middleware, depois da
      // separação por host (site público x painel). Deixar o NextAuth
      // redirecionar antes disso revelaria o login no link do cliente.
      return true
    },
  },
})

// Helper para usar em Server Components
export async function getServerSession() {
  return await auth()
}

// Helper para verificar se é admin em Server Actions / Route Handlers
export async function verificarAdmin(): Promise<boolean> {
  const session = await auth()
  return session?.user?.role === 'admin'
}