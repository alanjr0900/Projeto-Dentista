import { DefaultSession } from 'next-auth'

// Ampliação de tipos do NextAuth para incluir o role do administrador
declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      role?: string
    }
  }

  interface User {
    role?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
  }
}
