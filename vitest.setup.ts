import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

// Mock date-fns-tz
vi.mock('date-fns-tz', async () => ({
  ...await vi.importActual('date-fns-tz'),
  formatInTimeZone: vi.fn((date, tz, fmt) => {
    const d = new Date(date)
    return d.toLocaleDateString('pt-BR', { timeZone: tz })
  }),
}))