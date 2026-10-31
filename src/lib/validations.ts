import { z } from 'zod'

// Regex para telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
const telefoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/

// Regex para WhatsApp (apenas números): 55DDDNNNNNNNNN
const whatsappRegex = /^55\d{10,11}$/

// Esquema para escolha de serviço
export const servicoSchema = z.object({
  servicoId: z.string().cuid('Serviço inválido'),
})

// Esquema para escolha de data/horário
export const horarioSchema = z.object({
  servicoId: z.string().cuid('Serviço inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido (use HH:MM)'),
})

// Esquema para dados do paciente
export const pacienteSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(120),
  telefone: z.string().regex(telefoneRegex, 'Telefone inválido. Use o formato (XX) XXXXX-XXXX'),
  email: z.string().email('E-mail inválido').max(120).optional().or(z.literal('')),
  observacoes: z.string().max(500).optional(),
  consentimentoLGPD: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar o consentimento de uso dos dados' }),
  }),
  // Honeypot - deve vir vazio
  website: z.string().max(0, 'Campo inválido').optional(),
})

// Esquema completo de agendamento
export const agendamentoCompletoSchema = z.object({
  servicoId: z.string().cuid('Serviço inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(120),
  telefone: z.string().regex(telefoneRegex, 'Telefone inválido. Use o formato (XX) XXXXX-XXXX'),
  email: z.string().email('E-mail inválido').max(120).optional().or(z.literal('')),
  // Obrigatória: confirma identidade em "Minha consulta" (e-mail ou código).
  dataNascimento: z
    .string()
    .min(1, 'Data de nascimento é obrigatória')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida'),
  observacoes: z.string().max(500).optional(),
  consentimentoLGPD: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar o consentimento de uso dos dados' }),
  }),
  website: z.string().max(0, 'Campo inválido').optional(),
})

// Esquema para cancelamento/remarcação
export const cancelarRemarcarSchema = z.object({
  // Códigos gerados em src/lib/codigo.ts têm 8 chars; registros antigos
  // podem ter cuid() do banco. Aceita os dois formatos.
  codigo: z.string().min(6).max(40).regex(/^[A-Za-z0-9]+$/, 'Código de agendamento inválido'),
  telefone: z.string().regex(telefoneRegex, 'Telefone inválido. Use o formato (XX) XXXXX-XXXX'),
  // Para remarcar
  novaData: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nova data inválida').optional(),
  novoHorario: z.string().regex(/^\d{2}:\d{2}$/, 'Novo horário inválido').optional(),
  novoServicoId: z.string().cuid('Novo serviço inválido').optional(),
}).refine(
  data => {
    // Se estiver remarcando, precisa dos novos dados
    if (data.novaData || data.novoHorario || data.novoServicoId) {
      return data.novaData && data.novoHorario && data.novoServicoId
    }
    return true
  },
  {
    message: 'Para remarcar, informe nova data, horário e serviço',
    path: ['novaData'],
  }
)

// Esquema para serviços (admin)
export const servicoAdminSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(80),
  descricao: z.string().max(300).optional(),
  duracaoMin: z.coerce.number().int().min(15, 'Duração mínima 15 minutos').max(240, 'Duração máxima 4 horas'),
  ativo: z.boolean().default(true),
  ordem: z.coerce.number().int().min(0).default(0),
})

// Esquema para configurações (admin)
export const configuracaoSchema = z.object({
  clinicaNome: z.string().min(2).max(100),
  clinicaEndereco: z.string().max(300).optional(),
  clinicaTelefone: z.string().max(20).optional(),
  clinicaWhatsApp: z.string().regex(whatsappRegex, 'WhatsApp deve ser apenas números: 55DDDNNNNNNNNN').optional().or(z.literal('')),
  clinicaEmail: z.string().email().max(120).optional().or(z.literal('')),
  dentistaNome: z.string().min(2).max(100),
  dentistaCRO: z.string().max(30).optional(),
  dentistaFormacao: z.string().max(600, 'Textos longo demais (máx. 600)').optional().or(z.literal('')),
  dentistaExperiencia: z.string().max(1200, 'Texto longo demais (máx. 1200)').optional().or(z.literal('')),
  dentistaFoto: z.union([
    // URL externa: precisa ser http(s) apontando para imagem (.jpg/.jpeg/.png/.webp)
    z.string().url('Informe uma URL válida (https://...)').max(500).regex(
      /^https?:\/\/[^\s]+\.(jpe?g|png|webp)(\?\S*)?$/i,
      'A URL deve apontar para uma imagem (extensão .jpg, .jpeg, .png ou .webp)'
    ),
    // Caminho de upload local gravado pela rota /api/admin/upload
    z.string().regex(/^\/uploads\/[\w.-]+\.(jpe?g|png|webp)$/i, 'Caminho de upload inválido'),
  ]).optional().or(z.literal('')),
  duracaoPadraoMinutos: z.coerce.number().int().min(15).max(240),
  antecedenciaMinimaHoras: z.coerce.number().int().min(1).max(168),
  limiteDiasFuturo: z.coerce.number().int().min(1).max(365),
  intervaloAgendamentoMinutos: z.coerce.number().int().min(5).max(60),
  limiteAgendamentosIpHora: z.coerce.number().int().min(1).max(100),
  horarios: z.record(z.array(z.object({
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fim: z.string().regex(/^\d{2}:\d{2}$/),
  }))),
})

// Esquema para bloqueio de agenda (admin)
export const bloqueioSchema = z.object({
  inicio: z.string().datetime('Data/hora de início inválida'),
  fim: z.string().datetime('Data/hora de fim inválida'),
  motivo: z.string().max(200).optional(),
  recorrente: z.boolean().default(false),
  diaSemana: z.coerce.number().int().min(0).max(6).optional(),
}).refine(data => new Date(data.fim) > new Date(data.inicio), {
  message: 'Data de fim deve ser posterior à data de início',
  path: ['fim'],
}).refine(data => {
  if (data.recorrente && data.diaSemana === undefined) return false
  if (!data.recorrente && data.diaSemana !== undefined) return false
  return true
}, {
  message: 'Para bloqueio recorrente, informe o dia da semana',
  path: ['diaSemana'],
})

// Esquema para login admin
export const loginSchema = z.object({
  senha: z.string().min(1, 'Senha é obrigatória'),
  honeypot: z.string().max(0, 'Campo inválido').optional(),
})

// Tipos inferidos
export type ServicoInput = z.infer<typeof servicoSchema>
export type HorarioInput = z.infer<typeof horarioSchema>
export type PacienteInput = z.infer<typeof pacienteSchema>
export type AgendamentoCompletoInput = z.infer<typeof agendamentoCompletoSchema>
export type CancelarRemarcarInput = z.infer<typeof cancelarRemarcarSchema>
export type ServicoAdminInput = z.infer<typeof servicoAdminSchema>
export type ConfiguracaoInput = z.infer<typeof configuracaoSchema>
export type BloqueioInput = z.infer<typeof bloqueioSchema>
export type LoginInput = z.infer<typeof loginSchema>