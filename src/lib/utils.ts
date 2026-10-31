import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarTelefone(telefone: string): string {
  // Remove tudo que não é dígito
  const numeros = telefone.replace(/\D/g, '')
  
  // Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  }
  return telefone
}

export function desformatarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

export function formatarWhatsApp(telefone: string): string {
  // Entrada: (XX) XXXXX-XXXX -> Saída: 55DDDNNNNNNNNN
  const numeros = telefone.replace(/\D/g, '')
  if (numeros.length === 11) return `55${numeros}`
  if (numeros.length === 10) return `55${numeros}`
  if (numeros.length === 13 && numeros.startsWith('55')) return numeros
  return numeros
}

// Datas "YYYY-MM-DD" (sem hora) são parseadas como UTC meia-noite e,
// no fuso America/Sao_Paulo (UTC-3), retrocedem um dia.
// Adicionamos T12:00:00 para manter o mesmo dia visível (e seguro p/ DST).
function dataLocalSafe(data: Date | string): Date {
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return new Date(`${data}T12:00:00`)
  }
  return typeof data === 'string' ? new Date(data) : data
}

export function formatarDataBR(data: Date | string): string {
  const d = dataLocalSafe(data)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export function formatarHoraBR(data: Date | string): string {
  const d = dataLocalSafe(data)
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function formatarDataHoraBR(data: Date | string): string {
  const d = dataLocalSafe(data)
  return `${formatarDataBR(d)} às ${formatarHoraBR(d)}`
}

// Geração de código do agendamento fica em `src/lib/codigo.ts` (crypto).
// Não reintroduza Math.random aqui: o código é credencial de acesso.

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length).trim() + '…'
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Rate limiting simples em memória (para desenvolvimento)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function verificarRateLimit(ip: string, limite: number, janelaMs: number): { permitido: boolean; restante: number; resetEm: number } {
  const agora = Date.now()
  const registro = rateLimitMap.get(ip)

  if (!registro || agora > registro.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: agora + janelaMs })
    return { permitido: true, restante: limite - 1, resetEm: janelaMs }
  }

  if (registro.count >= limite) {
    return { 
      permitido: false, 
      restante: 0, 
      resetEm: registro.resetAt - agora 
    }
  }

  registro.count++
  return { permitido: true, restante: limite - registro.count, resetEm: registro.resetAt - agora }
}

// Limpar rate limit antigo periodicamente
if (typeof window === 'undefined') {
  setInterval(() => {
    const agora = Date.now()
    rateLimitMap.forEach((registro, ip) => {
      if (agora > registro.resetAt) {
        rateLimitMap.delete(ip)
      }
    })
  }, 5 * 60 * 1000) // A cada 5 minutos
}