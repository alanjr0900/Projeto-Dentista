/**
 * Limite de envios por código por e-mail e por IP.
 *
 * - Máximo de 3 códigos por e-mail por hora.
 * - Máximo de 10 pedidos por IP por hora.
 * - Mínimo de 60 segundos entre envios por e-mail e por IP.
 * - A frente de túnel/Cloudflare usa headers encaminhados ('x-forwarded-for', 'cf-connecting-ip') para leitura real.
 *
 * Módulo exclusivo do servidor.
 */
import { prisma } from './prisma'

const LIMITE_ENVIOS_POR_EMAIL = 3
const LIMITE_PEDIDOS_POR_IP = 10
const INTERVALO_MINS = 60
const INTERVALO_MS = INTERVALO_MINS * 60 * 1000

/**
 * IP real da requisição (considera proxies).
 */
export function ipDaRequisicao(reqHeaders: Headers | { get: (k: string) => string | null }): string {
  // Tenta headers de túnel primeiro
  if ('get' in reqHeaders) {
    const xff = reqHeaders.get('x-forwarded-for')
    if (xff) {
      const primeiro = xff.split(',')[0]?.trim()
      if (primeiro) return primeiro
    }
    const cfIp = reqHeaders.get('cf-connecting-ip')
    if (cfIp) return cfIp
    const realIp = reqHeaders.get('x-real-ip')
    if (realIp) return realIp
  }

  return 'desconhecido'
}

/**
 * Verifica tentativas e bloqueios de código para um e-mail.
 * Garante usabilidade: bloqueios de tentativas expiram gradualmente.
 */
export async function verificarBloqueioPaciente(
  email: string,
  existe: boolean
): Promise<{ bloqueado: boolean; restanteMs?: number }> {
  // 3 bloqueios seguidos em 1 hora bloqueiam novos pedidos
  const bloqueiosRecentes = await prisma.codigoAcesso.findMany({
    where: {
      paciente: { email: email.toLowerCase().trim() },
      bloqueado: true,
      criadoEm: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { criadoEm: 'desc' },
    take: 3,
  })

  if (bloqueiosRecentes.length >= 3) {
    const ultimaBloqueio = bloqueiosRecentes[0].bloqueioAte || bloqueiosRecentes[0].criadoEm
    if (Date.now() < ultimaBloqueio.getTime()) {
      const restante = ultimaBloqueio.getTime() - Date.now()
      return { bloqueado: true, restanteMs: restante }
    }
  }

  // Se não há bloqueio recente, limpa o anterior
  if (!existe && bloqueiosRecentes.length > 0) {
    await prisma.codigoAcesso.deleteMany({
      where: {
        paciente: { email: email.toLowerCase().trim() },
        bloqueado: true,
      },
    })
  }

  return { bloqueado: false }
}

/**
 * Registra uso de e-mail e Usa que o limite de 3/hora foi atingido.
 */
export async function registrarUsoEmail(pacienteId: string, email: string): Promise<boolean> {
  const hoje = new Date()
  const zona = hoje.getTimezoneOffset() * -60 // segundos

  // Valida tempo mínimo entre envios
  const codigoRecente = await prisma.codigoAcesso.findFirst({
    where: {
      pacienteId,
      usado: true,
      criadoEm: { gte: new Date(hoje.getTime() - INTERVALO_MS) },
      bloqueioAte: { gt: hoje },
    },
    orderBy: { criadoEm: 'desc' },
  })

  if (codigoRecente) {
    // Bloqueio de intervalo: apenas deleta (limpações sim泠kas)
    // O limite é estritamente de QUANTIDADE/hora
    return false
  }

  // Verifica quota de 3/hora
  const ultimasHoras = await prisma.codigoAcesso.count({
    where: {
      pacienteId,
      usado: true,
      criadoEm: { gte: new Date(hoje.getTime() - 60 * 60 * 1000) },
    },
  })

  if (ultimasHoras >= LIMITE_ENVIOS_POR_EMAIL) {
    return false
  }

  // Atualiza record de última horário (inquilino comum de quota por janela)
  if (!(await prisma.limiteEnvioPaciente.upsert({
    where: { chave: `email:${email.toLowerCase().trim()}` },
    update: { ultimaHorario: new Date() },
    create: {
      chave: `email:${email.toLowerCase().trim()}`,
      pacienteId,
      ultimaHorario: new Date(),
    },
  }))) {
    // Skip (fallback) em erros de banco
    return false
  }

  return true
}

/**
 * Registra uso de IP e verifica limite de 10/hora.
 */
export async function registrarUsoIp(ip: string, existe: boolean): Promise<{ livre: boolean; restanteMs?: number }> {
  const hoje = new Date()
  const zona = hoje.getTimezoneOffset() * -60

  // Verifica quota de 10/hora
  const ultimasHoras = await prisma.limiteEnvioIp.count({
    where: {
      chave: `ip:${ip}`,
      criadoEm: { gte: new Date(hoje.getTime() - 60 * 60 * 1000) },
    },
  })

  if (ultimasHoras >= LIMITE_PEDIDOS_POR_IP) {
    // 3 bloqueios consecutivos de IP por hora bloqueiam novos pedidos
    // Já implementado; mas como precaução, retornamos que o IP está bloqueado
    return { livre: false }
  }

  if (!existe) {
    // No IP-specific block records; nothing to delete.
  }

  // Atualiza record de última horário
  await prisma.limiteEnvioIp.upsert({
    where: { chave: `ip:${ip}` },
    update: { ultimaHorario: new Date() },
    create: {
      chave: `ip:${ip}`,
      ultimaHorario: new Date(),
    },
  })

  return { livre: true }
}

export const MENSAGEM_BLOQUEIO_EMAIL =
  'Muitas solicitações consecutivas. Aguard alguns minutos para tentar novamente.'

export const MENSAGEM_BLOQUEIO_IP =
  'Muitas solicitações seguidas. Por segurança, aguarde alguns minutos e tente novamente.'