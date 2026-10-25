/**
 * Limite de tentativas de login do painel.
 *
 * Regra padrão: 5 tentativas erradas seguidas bloqueiam o login por 15 minutos.
 * Pode ser ajustado no .env:
 *   LOGIN_MAX_TENTATIVAS=5
 *   LOGIN_BLOQUEIO_MINUTOS=15
 *
 * O contador fica em memória (por processo do servidor). É suficiente para
 * impedir força bruta em um site de consultório com um único administrador.
 * Se o site rodar em várias instâncias, cada instância tem seu próprio contador.
 */

interface EstadoLogin {
  falhas: number
  bloqueadoAte: number | null
}

function lerNumero(valor: string | undefined, padrao: number): number {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao
}

export const MAX_TENTATIVAS = lerNumero(process.env.LOGIN_MAX_TENTATIVAS, 5)
export const BLOQUEIO_MINUTOS = lerNumero(process.env.LOGIN_BLOQUEIO_MINUTOS, 15)

// Guardamos no globalThis para o contador sobreviver ao hot reload do dev.
const globalComContador = globalThis as unknown as {
  __dentistaLoginRateLimit?: Map<string, EstadoLogin>
}

const tentativas = globalComContador.__dentistaLoginRateLimit ?? new Map<string, EstadoLogin>()
globalComContador.__dentistaLoginRateLimit = tentativas

export interface SituacaoBloqueio {
  bloqueado: boolean
  minutosRestantes: number
  tentativasRestantes: number
}

function situacao(chave: string): SituacaoBloqueio {
  const agora = Date.now()
  const estado = tentativas.get(chave)

  if (!estado) {
    return { bloqueado: false, minutosRestantes: 0, tentativasRestantes: MAX_TENTATIVAS }
  }

  if (estado.bloqueadoAte !== null && estado.bloqueadoAte <= agora) {
    tentativas.delete(chave)
    return { bloqueado: false, minutosRestantes: 0, tentativasRestantes: MAX_TENTATIVAS }
  }

  if (estado.bloqueadoAte !== null) {
    return {
      bloqueado: true,
      minutosRestantes: Math.max(1, Math.ceil((estado.bloqueadoAte - agora) / 60000)),
      tentativasRestantes: 0,
    }
  }

  return {
    bloqueado: false,
    minutosRestantes: 0,
    tentativasRestantes: Math.max(0, MAX_TENTATIVAS - estado.falhas),
  }
}

export function verificarBloqueio(chave = 'admin'): SituacaoBloqueio {
  return situacao(chave)
}

export function registrarFalha(chave = 'admin'): SituacaoBloqueio {
  const estado = tentativas.get(chave) ?? { falhas: 0, bloqueadoAte: null }
  estado.falhas += 1

  if (estado.falhas >= MAX_TENTATIVAS) {
    estado.bloqueadoAte = Date.now() + BLOQUEIO_MINUTOS * 60 * 1000
  }

  tentativas.set(chave, estado)
  return situacao(chave)
}

export function limparTentativas(chave = 'admin'): void {
  tentativas.delete(chave)
}
