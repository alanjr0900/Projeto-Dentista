/**
 * Limite de tentativas do acesso do paciente ("Minha consulta").
 *
 * Conta falhas por IP e por código de agendamento. Ao atingir o limite, a
 * chave fica bloqueada por alguns minutos (com espera crescente a cada bloqueio
 * seguido). A resposta ao paciente é SEMPRE genérica — nunca revela se o código
 * existe ou qual dado estava errado.
 *
 * Contador em memória (por processo do servidor), como o do login do painel.
 * Ajustável no .env:
 *   PACIENTE_MAX_TENTATIVAS=5
 *   PACIENTE_MAX_TENTATIVAS_IP=12
 *   PACIENTE_BLOQUEIO_MINUTOS=15
 */
import type { NextRequest } from 'next/server'

interface EstadoTentativas {
  falhas: number
  bloqueadoAte: number | null
  /** Quantos bloqueios seguidos já foram aplicados (servem para a espera crescer). */
  bloqueiosConsecutivos: number
}

function lerNumero(valor: string | undefined, padrao: number): number {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao
}

export const MAX_TENTATIVAS_POR_CODIGO = lerNumero(process.env.PACIENTE_MAX_TENTATIVAS, 5)
export const MAX_TENTATIVAS_POR_IP = lerNumero(process.env.PACIENTE_MAX_TENTATIVAS_IP, 12)
export const BLOQUEIO_PACIENTE_MINUTOS = lerNumero(process.env.PACIENTE_BLOQUEIO_MINUTOS, 15)

const globalComContador = globalThis as unknown as {
  __dentistaPacienteRateLimit?: Map<string, EstadoTentativas>
}

const tentativas: Map<string, EstadoTentativas> =
  globalComContador.__dentistaPacienteRateLimit ??
  (globalComContador.__dentistaPacienteRateLimit = new Map())

const JANELA_MS = BLOQUEIO_PACIENTE_MINUTOS * 60 * 1000

/** Estado inicial de uma chave (sem bloqueio, sem falhas, sem bloqueios). */
function criarEstadoTentativas(): EstadoTentativas {
  return { falhas: 0, bloqueadoAte: null, bloqueiosConsecutivos: 0 }
}

/**
 * IP de origem (considera túnel/Cloudflare/proxy).
 *
 * O cabeçalho confiável é configurável por `IP_HEADER` (ex.: `cf-connecting-ip`).
 * Quando não definido, usa a ordem padrão: x-forwarded-for → cf-connecting-ip
 * → x-real-ip. Sempre pega apenas o primeiro IP da lista.
 */
export function ipDaRequisicao(request: NextRequest): string {
  const headerConfigurado = (process.env.IP_HEADER || '').trim().toLowerCase()
  if (headerConfigurado) {
    const valor = request.headers.get(headerConfigurado)
    if (valor) {
      const primeiro = valor.split(',')[0]?.trim()
      if (primeiro) return primeiro
    }
  }

  const encaminhado = request.headers.get('x-forwarded-for')
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }

  const cf = request.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'desconhecido'
}

function podar(chave: string) {
  const estado = tentativas.get(chave)
  if (estado?.bloqueadoAte && estado.bloqueadoAte <= Date.now()) {
    tentativas.delete(chave)
    return
  }
  // Mantém o mapa pequeno: limpa bloqueios vencidos antigos de vez em quando.
  if (tentativas.size > 5000) {
    const agora = Date.now()
    for (const [k, v] of tentativas) {
      if (!v.bloqueadoAte || v.bloqueadoAte <= agora) tentativas.delete(k)
    }
  }
}

/** Chaves usadas para contar falhas desta tentativa. */
export function chavesTentativa(ip: string, codigoNormalizado: string): string[] {
  const chaves = [`ip:${ip}`]
  if (codigoNormalizado) chaves.push(`codigo:${codigoNormalizado}`)
  return chaves
}

/**
 * True quando alguma das chaves está temporariamente bloqueada.
 * `restanteMs` é quanto falta do bloqueio mais longo.
 */
export function verificarBloqueioPaciente(chaves: string[]): { bloqueado: boolean; restanteMs: number } {
  let restanteMs = 0
  for (const chave of chaves) {
    podar(chave)
    const estado = tentativas.get(chave)
    if (estado?.bloqueadoAte && estado.bloqueadoAte > Date.now()) {
      restanteMs = Math.max(restanteMs, estado.bloqueadoAte - Date.now())
    }
  }
  return { bloqueado: restanteMs > 0, restanteMs }
}

/** Registra uma falha em todas as chaves e bloqueia as que estouraram. */
export function registrarFalhaPaciente(chaves: string[]) {
  const agora = Date.now()
  for (const chave of chaves) {
    podar(chave)
    const limite = chave.startsWith('ip:') ? MAX_TENTATIVAS_POR_IP : MAX_TENTATIVAS_POR_CODIGO
    const estado =
      tentativas.get(chave) ?? {
        falhas: 0,
        bloqueadoAte: null,
        bloqueiosConsecutivos: 0,
      }
    estado.falhas += 1
    if (estado.falhas >= limite) {
      // Bloqueio com espera CRESCENTE: cada bloqueio seguido dura mais (15min,
      // 30min, 45min...) — a gravidade escala com a reincidência.
      estado.bloqueiosConsecutivos += 1
      const minutosBloqueio = BLOQUEIO_PACIENTE_MINUTOS * Math.min(3, estado.bloqueiosConsecutivos)
      estado.bloqueadoAte = agora + minutosBloqueio * 60 * 1000
      estado.falhas = 0
    }
    tentativas.set(chave, estado)
  }
}

/** Zera o contador após um acesso bem-sucedido. */
export function limparTentativasPaciente(chaves: string[]) {
  for (const chave of chaves) tentativas.delete(chave)
}

/** Mensagem única de erro — nunca diz qual campo falhou. */
export const MENSAGEM_ACESSO_INVALIDO =
  'Não foi possível acessar com esses dados. Confira o código e o dado informado e tente novamente.'

/** Mensagem de bloqueio temporário. */
export const MENSAGEM_BLOQUEIO_TEMPORARIO =
  'Muitas tentativas. Por segurança, aguarde alguns minutos e tente novamente.'
