/**
 * Regras de negócio do acesso do paciente ("Minha consulta").
 *
 * Tudo aqui é validado no SERVIDOR. Nenhuma função devolve nome de outro
 * paciente, serviço de outra pessoa ou detalhe de horário ocupado.
 *
 * Módulo exclusivo do servidor.
 */
import { prisma } from './prisma'
import { getConfiguracoes } from './config'
import { calcularDisponibilidade } from './disponibilidade'
import { primeiroHorarioPermitido, PRAZO_REAGENDAMENTO_HORAS } from './prazos'
import { gerarCodigo, hashSenha, VALIDADE_MINUTOS } from './codigo-acesso'
import { normalizarCodigo } from './codigo'
import { segundoFatorConfere } from './paciente-identidade'
import { verificarBloqueioPaciente, registrarUsoEmail, registrarUsoIp, ipDaRequisicao } from './limite-envio'
import { parseDataNascimento } from './data-nascimento'

export const STATUS_ALTERAVEIS = ['PENDENTE', 'CONFIRMADO', 'REMARCADO']

export { segundoFatorConfere, dadosAcessoConferem } from './paciente-identidade'

export type AgendamentoDoPaciente = Awaited<ReturnType<typeof buscarAgendamentoPorCodigo>>

/** Busca pelo código normalizado (maiúsculo). */
export async function buscarAgendamentoPorCodigo(codigo: string) {
  const normalizado = normalizarCodigo(codigo)
  if (!normalizado) return null

  const incluir = { servico: true, paciente: true } as const
  const encontrado = await prisma.agendamento.findUnique({
    where: { codigo: normalizado },
    include: incluir,
  })
  if (encontrado) return encontrado

  // Compatibilidade durante a transição: registros antigos com cuid()
  // (sensível a maiúsculas/minúsculas) continuam acessíveis.
  if (normalizado !== codigo) {
    return prisma.agendamento.findUnique({ where: { codigo }, include: incluir })
  }
  return null
}

/** Diagnósticos que a dentista liberou explicitamente para o paciente. */
export async function diagnosticosLiberados(pacienteId: string) {
  return prisma.anotacaoPaciente.findMany({
    where: { pacienteId, liberado: true },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, texto: true, criadoEm: true },
    take: 100,
  })
}

/**
 * Log LGPD: registra QUANDO e QUAIS registros foram lidos — nunca o conteúdo.
 */
export async function registrarAcessoDiagnosticos(dados: {
  pacienteId: string
  agendamentoId: string | null
  registros: string[]
  ip?: string | null
}) {
  try {
    await prisma.logAcessoDiagnostico.create({
      data: {
        pacienteId: dados.pacienteId,
        agendamentoId: dados.agendamentoId,
        registros: dados.registros.join(','),
        quantidade: dados.registros.length,
        ip: dados.ip || null,
      },
    })
  } catch (erro) {
    // O log não pode impedir o paciente de ver o próprio prontuário.
    console.error('[LGPD] Falha ao registrar acesso a diagnósticos:', erro)
  }
}

export type DiaComHorariosLivres = {
  data: string // YYYY-MM-DD
  diaSemana: number
  slots: { horario: string; dataHoraISO: string }[]
}

/**
 * Horários livres para o paciente remarcar.
 *
 * Só devolve slots efetivamente LIVRES, respeitando:
 * - horário de funcionamento, bloqueios e conflitos (calcularDisponibilidade);
 * - antecedência mínima de PRAZO_REAGENDAMENTO_HORAS a partir de agora.
 * Nunca inclui nome de paciente nem informação de horário ocupado.
 */
export async function listarHorariosLivres(agendamento: { servicoId: string }): Promise<{
  dias: DiaComHorariosLivres[]
  duracaoMin: number
}> {
  const cfg = await getConfiguracoes()
  const agora = new Date()
  const limiteDias = Math.min(Math.max(cfg.limiteDiasFuturo, 1), 90)
  const fim = new Date(agora.getTime() + limiteDias * 24 * 60 * 60 * 1000)

  const disponibilidade = await calcularDisponibilidade(agora, fim, agendamento.servicoId, cfg)
  const minimo = primeiroHorarioPermitido(PRAZO_REAGENDAMENTO_HORAS, agora)

  const dias: DiaComHorariosLivres[] = disponibilidade.dias
    .map(dia => ({
      data: dia.data,
      diaSemana: dia.diaSemana,
      slots: dia.slots
        .filter(slot => slot.disponivel && new Date(slot.dataHoraISO) >= minimo)
        .map(slot => ({ horario: slot.horario, dataHoraISO: slot.dataHoraISO })),
    }))
    .filter(dia => dia.slots.length > 0)

  return { dias, duracaoMin: disponibilidade.servicoDuracao }
}

/** Instante do slot escolhido (horário de São Paulo, UTC-3 desde 2019). */
export function dataHoraDoSlot(data: string, horario: string): Date {
  return new Date(`${data}T${horario}:00-03:00`)
}

/**
 * Busca o paciente filtrado pelo e-mail (campo opcional).
 * Usado no login filtrado por e-mail com código temporário.
 */
export async function buscarPacientePorEmail(email: string) {
  const emailNormalizado = email.toLowerCase().trim()
  return prisma.paciente.findFirst({
    where: { email: emailNormalizado },
    include: { agendamentos: { include: { servico: true }, orderBy: { dataHora: 'desc' }, take: 50 } },
  })
}

/**
 * Gera e registra código temporário para o paciente (login filtrado).
 */
export async function gerarCodigoFiltrado(pacienteId: string, email: string) {
  const codigo = gerarCodigo()
  const hash = hashSenha(codigo)
  await prisma.codigoAcesso.create({
    data: {
      codigoHash: hash,
      pacienteId,
      expiraEm: new Date(Date.now() + VALIDADE_MINUTOS * 60 * 1000),
      usado: false,
      tentativas: 0,
      bloqueado: false,
      bloqueioAte: null,
    },
  })
  return { hash, codigo }
}
