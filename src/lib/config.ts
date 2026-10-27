import { prisma } from './prisma'
import { cache } from 'react'
import { ENDERECO, TELEFONE_EXIBICAO, WHATSAPP_NUMERO } from './contato'

// Tipos para configurações
export type HorarioFuncionamento = {
  inicio: string // HH:MM
  fim: string    // HH:MM
}

export type DiaSemanaConfig = {
  [dia: number]: HorarioFuncionamento[] // 0=domingo, 1=segunda, ...
}

export type ConfiguracoesClinica = {
  clinicaNome: string
  clinicaEndereco: string
  clinicaTelefone: string
  clinicaWhatsApp: string
  clinicaEmail: string
  dentistaNome: string
  dentistaCRO: string
  dentistaFoto: string
  /** Enquadramento da foto: ponto de foco (0–100%) e zoom (1–3) */
  dentistaFotoFocoX: number
  dentistaFotoFocoY: number
  dentistaFotoZoom: number
  dentistaFormacao: string
  dentistaExperiencia: string
  horarioFuncionamento: DiaSemanaConfig
  duracaoPadraoMinutos: number
  antecedenciaMinimaHoras: number
  limiteDiasFuturo: number
  intervaloAgendamentoMinutos: number
  limiteAgendamentosIpHora: number
}

// Cache das configurações para evitar múltiplas queries.
// `cache` do React só existe no runtime do App Router (React Server); em
// ambiente de teste (vitest/jsdom) ele não é função — usa fallback identidade.

/**
 * Envolve a função em cache do React quando disponível; caso contrário,
 * devolve a própria função (sem cache), mantendo a mesma assinatura.
 */
const cacheDisponivel = (typeof cache === 'function' ? cache : <T extends (arg?: never) => unknown>(fn: T): T => fn) as
  typeof cache

export const getConfiguracoes = cacheDisponivel(async (): Promise<ConfiguracoesClinica> => {
  const configs = await prisma.configuracao.findMany()
  const mapa = Object.fromEntries(configs.map(c => [c.chave, c.valor]))

  const parseHorarios = (valor: string): HorarioFuncionamento[] => {
    if (!valor.trim()) return []
    return valor.split(',').map(h => {
      const [inicio, fim] = h.trim().split('-')
      return { inicio: inicio.trim(), fim: fim.trim() }
    })
  }

  const horarioFuncionamento: DiaSemanaConfig = {}
  for (let i = 0; i <= 6; i++) {
    const chave = `horario_funcionamento_${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][i]}`
    horarioFuncionamento[i] = parseHorarios(mapa[chave] || '')
  }

  return {
    clinicaNome: mapa.clinica_nome || 'Consultório Odontológico',
    /**
     * TELEFONE/WHATSAPP/ENDEREÇO vêm de src/lib/contato.ts (fonte única,
     * regra permanente). Os valores gravados no painel para estes campos
     * são ignorados — assim não existe telefone desatualizado espalhado.
     */
    clinicaEndereco: ENDERECO,
    clinicaTelefone: TELEFONE_EXIBICAO,
    clinicaWhatsApp: WHATSAPP_NUMERO,
    clinicaEmail: mapa.clinica_email || '',
    dentistaNome: mapa.dentista_nome || 'Dra. Dentista',
    dentistaCRO: mapa.dentista_cro || 'CRO/UF XXXXX',
    dentistaFoto: mapa.dentista_foto || '',
    dentistaFotoFocoX: parseFloat(mapa.dentista_foto_foco_x || '50'),
    dentistaFotoFocoY: parseFloat(mapa.dentista_foto_foco_y || '35'),
    dentistaFotoZoom: parseFloat(mapa.dentista_foto_zoom || '1'),
    dentistaFormacao: mapa.dentista_formacao || '',
    dentistaExperiencia: mapa.dentista_experiencia || '',
    horarioFuncionamento,
    duracaoPadraoMinutos: parseInt(mapa.duracao_padrao_minutos || '60', 10),
    antecedenciaMinimaHoras: parseInt(mapa.antecedencia_minima_horas || '24', 10),
    limiteDiasFuturo: parseInt(mapa.limite_dias_futuro || '60', 10),
    intervaloAgendamentoMinutos: parseInt(mapa.intervalo_agendamento_minutos || '15', 10),
    limiteAgendamentosIpHora: parseInt(mapa.limite_agendamentos_ip_hora || '10', 10),
  }
})

// Função para invalidar cache (útil após updates no admin)
export async function invalidarCacheConfiguracoes() {
  // No Next.js 14, o cache() é por request, mas podemos forçar revalidação
  // se necessário usando revalidatePath ou tags
}

// Configurações padrão para fallback (build time / SSR sem banco)
export const CONFIG_PADRAO: ConfiguracoesClinica = {
  clinicaNome: 'Consultório Dra. [Nome da Dentista]',
  // Fonte única de contato (src/lib/contato.ts) — sem placeholders.
  clinicaEndereco: ENDERECO,
  clinicaTelefone: TELEFONE_EXIBICAO,
  clinicaWhatsApp: WHATSAPP_NUMERO,
  clinicaEmail: 'contato@exemplo.com',
  dentistaNome: 'Dra. [Nome da Dentista]',
  dentistaCRO: 'CRO/UF XXXXX',
  dentistaFoto: '',
  dentistaFotoFocoX: 50,
  dentistaFotoFocoY: 35,
  dentistaFotoZoom: 1,
  dentistaFormacao: 'Graduada em Odontologia pela [Universidade] em [Ano] e com especialização em [Especialidade].',
  dentistaExperiencia: 'Com 15 anos de dedicação à odontologia, atende tanto em consultório próprio quanto na rede pública.',
  horarioFuncionamento: {
    0: [], // Domingo
    1: [{ inicio: '08:00', fim: '12:00' }, { inicio: '13:30', fim: '18:00' }], // Segunda
    2: [{ inicio: '08:00', fim: '12:00' }, { inicio: '13:30', fim: '18:00' }], // Terça
    3: [{ inicio: '08:00', fim: '12:00' }, { inicio: '13:30', fim: '18:00' }], // Quarta
    4: [{ inicio: '08:00', fim: '12:00' }, { inicio: '13:30', fim: '18:00' }], // Quinta
    5: [{ inicio: '08:00', fim: '12:00' }, { inicio: '13:30', fim: '17:00' }], // Sexta
    6: [{ inicio: '08:00', fim: '12:00' }], // Sábado
  },
  duracaoPadraoMinutos: 60,
  antecedenciaMinimaHoras: 24,
  limiteDiasFuturo: 60,
  intervaloAgendamentoMinutos: 15,
  limiteAgendamentosIpHora: 10,
}