/**
 * Login por código temporário (OTP) em "Minha consulta".
 *
 * Regras aplicadas no servidor:
 * - código numérico de 6 dígitos gerado com `crypto.randomInt` (não Math.random);
 * - só o hash HMAC-SHA256 é gravado no banco;
 * - validade de 10 minutos, uso único, novo código invalida o anterior;
 * - 5 tentativas erradas invalidam o código;
 * - 3 códigos invalidados seguidos bloqueiam novos pedidos por 30 minutos;
 * - 3 envios por e-mail/hora, 10 pedidos por IP/hora e 60s entre envios;
 * - nenhuma função deste arquivo registra o código ou o e-mail completo em log.
 *
 * Tudo é configurável por variáveis de ambiente (ver .env.example). O módulo é
 * exclusivo do servidor.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'
import { mensagemSegura } from './log-seguro'

function numeroEnv(nome: string, padrao: number): number {
  const numero = Number(process.env[nome])
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao
}

export const CODIGO_VALIDADE_MINUTOS = numeroEnv('OTP_VALIDADE_MINUTOS', 10)
export const MAX_TENTATIVAS_POR_CODIGO = numeroEnv('OTP_MAX_TENTATIVAS', 5)
export const MAX_BLOQUEIOS_CONSECUTIVOS = numeroEnv('OTP_MAX_BLOQUEIOS', 3)
export const BLOQUEIO_EMAIL_MINUTOS = numeroEnv('OTP_BLOQUEIO_MINUTOS', 30)
export const LIMITE_ENVIOS_EMAIL_HORA = numeroEnv('OTP_MAX_ENVIOS_EMAIL_HORA', 3)
export const LIMITE_PEDIDOS_IP_HORA = numeroEnv('OTP_MAX_PEDIDOS_IP_HORA', 10)
export const INTERVALO_REENVIO_SEGUNDOS = numeroEnv('OTP_INTERVALO_REENVIO_SEGUNDOS', 60)
export const TEMPO_RESPOSTA_NEUTRA_MS = numeroEnv('OTP_TEMPO_RESPOSTA_MS', 800)

/** Resposta idêntica exista ou não o e-mail no banco. */
export const MENSAGEM_NEUTRA_ENVIO =
  'Se este e-mail estiver cadastrado, enviamos um código de acesso.'

const JANELA_HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000

function segredoHash(): string {
  const segredo = process.env.OTP_HASH_SECRET || process.env.AUTH_SECRET
  if (!segredo) throw new Error('AUTH_SECRET (ou OTP_HASH_SECRET) não configurado')
  return segredo
}

/** Normaliza o e-mail (trim + minúsculas). Nunca use o e-mail cru como chave. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Hash do código. O código puro nunca é gravado nem logado. */
export function hashCodigo(codigo: string): string {
  return createHmac('sha256', segredoHash()).update(`otp:${codigo}`).digest('hex')
}

/** Chave opaca para o e-mail (limites e auditoria). */
export function hashEmail(email: string): string {
  return createHmac('sha256', segredoHash())
    .update(`email:${normalizarEmail(email)}`)
    .digest('hex')
}

/** Chave opaca para o IP (limites e auditoria). */
export function hashIp(ip: string): string {
  return createHmac('sha256', segredoHash()).update(`ip:${ip.trim()}`).digest('hex')
}

/** Exibe apenas o suficiente para o paciente reconhecer o e-mail no log. */
export function mascararEmail(email: string): string {
  const normalizado = normalizarEmail(email)
  const [usuario, dominio] = normalizado.split('@')
  if (!usuario || !dominio) return '***'
  return `${usuario.slice(0, 1)}***@${dominio}`
}

/** Código de 6 dígitos, incluindo 000000–099999 (faixa completa). */
export function gerarCodigoOTP(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

function hashesIguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}

type PacienteEmail = {
  id: string
  nome: string
  email: string | null
  atualizadoEm: Date
  agendamentos: { dataHora: Date }[]
}

function pontuacaoAtividade(paciente: PacienteEmail): number {
  const ultimaConsulta = paciente.agendamentos[0]?.dataHora.getTime() ?? 0
  return Math.max(ultimaConsulta, paciente.atualizadoEm.getTime())
}

/**
 * Resolve o paciente pelo e-mail de forma DETERMINÍSTICA.
 *
 * O banco pode ter mais de um cadastro com o mesmo e-mail (dados antigos).
 * Escolhemos sempre o cadastro com a atividade mais recente (consulta ou
 * atualização), para que o acesso não fique "alternando" entre registros.
 */
export async function buscarPacientePorEmail(email: string) {
  const alvo = normalizarEmail(email)
  if (!alvo) return null

  const candidatos = await prisma.paciente.findMany({
    where: { email: { not: null } },
    select: {
      id: true,
      nome: true,
      email: true,
      atualizadoEm: true,
      agendamentos: {
        select: { dataHora: true },
        orderBy: { dataHora: 'desc' },
        take: 1,
      },
    },
  })

  const encontrados = candidatos.filter(
    (paciente): paciente is PacienteEmail & { email: string } =>
      Boolean(paciente.email) && normalizarEmail(paciente.email as string) === alvo
  )

  if (encontrados.length === 0) return null
  encontrados.sort((a, b) => pontuacaoAtividade(b) - pontuacaoAtividade(a))
  return encontrados[0]
}

/** Bloqueio de 30 min por 3 códigos invalidados seguidos (se ativo). */
export async function verificarBloqueioEmail(
  pacienteId: string,
  agora: Date = new Date()
): Promise<Date | null> {
  const registro = await prisma.codigoAcesso.findUnique({
    where: { pacienteId },
    select: { bloqueado: true, bloqueioAte: true },
  })
  if (!registro?.bloqueado || !registro.bloqueioAte) return null
  return registro.bloqueioAte > agora ? registro.bloqueioAte : null
}

type RegistroLimite = {
  janelaInicio: Date
  quantidade: number
  ultimaHorario: Date
}

function avaliarRegistro(
  registro: RegistroLimite | null,
  limite: number,
  agora: Date,
  exigirIntervalo: boolean
): { permitido: boolean; reenviarEm: number } {
  if (!registro) return { permitido: true, reenviarEm: INTERVALO_REENVIO_SEGUNDOS }

  const janelaExpirou = agora.getTime() - registro.janelaInicio.getTime() >= JANELA_HORA_MS

  if (!janelaExpirou && registro.quantidade >= limite) {
    const reenviarEm = Math.max(
      1,
      Math.ceil((registro.janelaInicio.getTime() + JANELA_HORA_MS - agora.getTime()) / 1000)
    )
    return { permitido: false, reenviarEm }
  }

  if (!janelaExpirou && exigirIntervalo) {
    const decorridos = (agora.getTime() - registro.ultimaHorario.getTime()) / 1000
    if (decorridos < INTERVALO_REENVIO_SEGUNDOS) {
      return {
        permitido: false,
        reenviarEm: Math.max(1, Math.ceil(INTERVALO_REENVIO_SEGUNDOS - decorridos)),
      }
    }
  }

  return { permitido: true, reenviarEm: INTERVALO_REENVIO_SEGUNDOS }
}

/**
 * Reserva um envio (contadores por e-mail e por IP) de forma atômica.
 * Retorna `permitido: false` quando alguma quota/intervalo foi atingido.
 */
export async function reservarEnvio(
  email: string,
  ip: string,
  agora: Date = new Date()
): Promise<{ permitido: boolean; reenviarEm: number }> {
  const chaveEmail = hashEmail(email)
  const chaveIp = hashIp(ip || 'desconhecido')

  return prisma.$transaction(async tx => {
    const registroEmail = await tx.limiteEnvioEmail.findUnique({ where: { chave: chaveEmail } })
    const registroIp = await tx.limiteEnvioIp.findUnique({ where: { chave: chaveIp } })

    const avaliacaoEmail = avaliarRegistro(
      registroEmail
        ? {
            janelaInicio: registroEmail.janelaInicio,
            quantidade: registroEmail.quantidade,
            ultimaHorario: registroEmail.ultimoEnvioEm,
          }
        : null,
      LIMITE_ENVIOS_EMAIL_HORA,
      agora,
      true
    )
    const avaliacaoIp = avaliarRegistro(registroIp, LIMITE_PEDIDOS_IP_HORA, agora, false)

    if (!avaliacaoEmail.permitido || !avaliacaoIp.permitido) {
      return {
        permitido: false,
        reenviarEm: Math.max(avaliacaoEmail.reenviarEm, avaliacaoIp.reenviarEm),
      }
    }

    const janelaEmailExpirou =
      !registroEmail || agora.getTime() - registroEmail.janelaInicio.getTime() >= JANELA_HORA_MS
    await tx.limiteEnvioEmail.upsert({
      where: { chave: chaveEmail },
      create: {
        chave: chaveEmail,
        janelaInicio: agora,
        quantidade: 1,
        ultimoEnvioEm: agora,
      },
      update: {
        janelaInicio: janelaEmailExpirou ? agora : registroEmail.janelaInicio,
        quantidade: janelaEmailExpirou ? 1 : { increment: 1 },
        ultimoEnvioEm: agora,
      },
    })

    const janelaIpExpirou =
      !registroIp || agora.getTime() - registroIp.janelaInicio.getTime() >= JANELA_HORA_MS
    await tx.limiteEnvioIp.upsert({
      where: { chave: chaveIp },
      create: {
        chave: chaveIp,
        janelaInicio: agora,
        ultimaHorario: agora,
        quantidade: 1,
      },
      update: {
        janelaInicio: janelaIpExpirou ? agora : registroIp.janelaInicio,
        quantidade: janelaIpExpirou ? 1 : { increment: 1 },
        ultimaHorario: agora,
      },
    })

    return { permitido: true, reenviarEm: INTERVALO_REENVIO_SEGUNDOS }
  })
}

/** Grava o novo código, invalidando o anterior. */
export async function salvarCodigoOTP(
  pacienteId: string,
  codigo: string,
  agora: Date = new Date()
): Promise<void> {
  const expiraEm = new Date(agora.getTime() + CODIGO_VALIDADE_MINUTOS * 60 * 1000)

  await prisma.codigoAcesso.upsert({
    where: { pacienteId },
    create: {
      pacienteId,
      codigoHash: hashCodigo(codigo),
      expiraEm,
      usado: false,
      tentativas: 0,
      bloqueado: false,
      bloqueioAte: null,
      bloqueiosConsecutivos: 0,
    },
    update: {
      codigoHash: hashCodigo(codigo),
      expiraEm,
      usado: false,
      tentativas: 0,
      bloqueado: false,
      bloqueioAte: null,
      // Preserva `bloqueiosConsecutivos`: só um login bem-sucedido zera.
    },
  })
}

export type ResultadoValidacao =
  | { valido: true }
  | {
      valido: false
      motivo: 'invalido' | 'expirado' | 'usado' | 'tentativas' | 'bloqueado'
      restantes?: number
      bloqueadoAte?: Date
    }

/** Valida o código e aplica a política de tentativas/bloqueios. */
export async function validarCodigoOTP(
  pacienteId: string,
  codigoInformado: string,
  agora: Date = new Date()
): Promise<ResultadoValidacao> {
  const hashInformado = hashCodigo(codigoInformado)
  const registro = await prisma.codigoAcesso.findUnique({ where: { pacienteId } })

  if (!registro) return { valido: false, motivo: 'invalido' }

  if (registro.bloqueado && registro.bloqueioAte && registro.bloqueioAte > agora) {
    return { valido: false, motivo: 'bloqueado', bloqueadoAte: registro.bloqueioAte }
  }
  if (registro.usado) return { valido: false, motivo: 'usado' }
  if (registro.expiraEm.getTime() <= agora.getTime()) return { valido: false, motivo: 'expirado' }

  if (hashesIguais(registro.codigoHash, hashInformado)) {
    await prisma.codigoAcesso.update({
      where: { pacienteId },
      data: {
        usado: true,
        usadoEm: agora,
        tentativas: 0,
        bloqueado: false,
        bloqueioAte: null,
        bloqueiosConsecutivos: 0,
      },
    })
    return { valido: true }
  }

  const tentativas = registro.tentativas + 1

  if (tentativas < MAX_TENTATIVAS_POR_CODIGO) {
    await prisma.codigoAcesso.update({
      where: { pacienteId },
      data: { tentativas },
    })
    return {
      valido: false,
      motivo: 'invalido',
      restantes: Math.max(0, MAX_TENTATIVAS_POR_CODIGO - tentativas),
    }
  }

  // Estourou as tentativas: invalida o código e conta mais um bloqueio.
  const bloqueios = registro.bloqueiosConsecutivos + 1
  const deveBloquear = bloqueios >= MAX_BLOQUEIOS_CONSECUTIVOS
  const bloqueadoAte = deveBloquear
    ? new Date(agora.getTime() + BLOQUEIO_EMAIL_MINUTOS * 60 * 1000)
    : null

  await prisma.codigoAcesso.update({
    where: { pacienteId },
    data: {
      tentativas,
      usado: true,
      usadoEm: agora,
      bloqueado: deveBloquear,
      bloqueioAte: bloqueadoAte,
      // Ao aplicar o bloqueio, começa um novo ciclo depois que ele expirar.
      bloqueiosConsecutivos: deveBloquear ? 0 : bloqueios,
    },
  })

  return {
    valido: false,
    motivo: deveBloquear ? 'bloqueado' : 'tentativas',
    restantes: 0,
    bloqueadoAte: bloqueadoAte ?? undefined,
  }
}

/** Auditoria sem dados sensíveis: só hashes, resultado e motivo. */
export async function registrarTentativaAcesso(dados: {
  email: string
  ip?: string | null
  sucesso: boolean
  motivo?: string | null
}): Promise<void> {
  try {
    await prisma.tentativaAcesso.create({
      data: {
        emailHash: hashEmail(dados.email),
        ipHash: dados.ip ? hashIp(dados.ip) : null,
        sucesso: dados.sucesso,
        motivo: dados.motivo || null,
      },
    })
  } catch (erro) {
    // Auditoria nunca pode impedir o login.
    console.error('[OTP] Falha ao registrar tentativa:', mensagemSegura(erro))
  }
}

/** Garante tempo mínimo de resposta (não revela se o e-mail existe). */
export async function aguardarRespostaNeutra(inicioMs: number): Promise<void> {
  const alvo = TEMPO_RESPOSTA_NEUTRA_MS + randomInt(0, 150)
  const decorrido = Date.now() - inicioMs
  if (decorrido < alvo) {
    await new Promise(resolve => setTimeout(resolve, alvo - decorrido))
  }
}

/** Apaga códigos expirados, contadores antigos e auditoria vencida. */
export async function limparRegistrosOTP(agora: Date = new Date()): Promise<void> {
  const limiteCodigos = new Date(agora.getTime() - DIA_MS)
  const limiteContadores = new Date(agora.getTime() - 7 * DIA_MS)
  const limiteAuditoria = new Date(agora.getTime() - 30 * DIA_MS)

  await prisma.codigoAcesso.deleteMany({
    where: {
      OR: [
        { expiraEm: { lt: limiteCodigos } },
        { usado: true, usadoEm: { lt: limiteCodigos } },
      ],
    },
  })

  await prisma.limiteEnvioEmail.deleteMany({
    where: { janelaInicio: { lt: limiteContadores } },
  })
  await prisma.limiteEnvioIp.deleteMany({
    where: { janelaInicio: { lt: limiteContadores } },
  })
  await prisma.limiteEnvioPaciente.deleteMany({
    where: { ultimaHorario: { lt: limiteContadores } },
  })
  await prisma.tentativaAcesso.deleteMany({
    where: { criadoEm: { lt: limiteAuditoria } },
  })
}

type GlobalLimpeza = typeof globalThis & { __ultimaLimpezaOTP?: number }

/**
 * Limpeza "preguiçosa": roda no máximo uma vez por hora, sem depender de
 * agendador externo. O endpoint /api/paciente/otp/limpeza continua disponível
 * para cron em produção.
 */
export async function talvezLimparRegistrosOTP(): Promise<void> {
  const global = globalThis as GlobalLimpeza
  const agora = Date.now()
  if (global.__ultimaLimpezaOTP && agora - global.__ultimaLimpezaOTP < JANELA_HORA_MS) return
  global.__ultimaLimpezaOTP = agora
  try {
    await limparRegistrosOTP()
  } catch (erro) {
    console.error('[OTP] Falha na limpeza automática:', mensagemSegura(erro))
  }
}

/**
 * Comparação de hashes usada nos testes. Mantida exportada para evitar
 * reimplementar `timingSafeEqual` em outros módulos.
 */
export function hashesConferem(a: string, b: string): boolean {
  return hashesIguais(a, b)
}

/** Utilitário para testes: hash SHA-256 simples (não usar para OTP). */
export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}
