'use client'

import { useState, useEffect, useCallback } from 'react'
import ServiceIcon from '@/components/shared/ServiceIcon'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PassoAgendamento, EstadoAgendamento, Servico } from '@/types'
import { formatarDataBR, formatarHoraBR, formatarTelefone } from '@/lib/utils'
import { DATA_NASCIMENTO_MAX } from '@/lib/data-nascimento'

// Tipos para os componentes
interface ServicoCardProps {
  servico: Servico
  selecionado: boolean
  onClick: () => void
}

interface CalendarioProps {
  dataSelecionada: string | undefined
  onDataSelect: (data: string) => void
  diasDisponiveis: string[]
  servicoDuracao: number
  limiteDiasFuturo: number
}

interface HorariosProps {
  horarioSelecionado: string | undefined
  onHorarioSelect: (horario: string) => void
  slots: { horario: string; disponivel: boolean }[]
}

interface DadosPacienteProps {
  dados: EstadoAgendamento['dadosPaciente']
  onChange: (campo: string, valor: string | boolean) => void
  erro?: string
  servicoNome: string
  dataHora: string
}

interface ConfirmacaoProps {
  agendamento: EstadoAgendamento['agendamentoConfirmado']
  onAdicionarCalendario: () => void
  onWhatsApp: () => void
  onEnviarCodigo: () => void
  onNovoAgendamento: () => void
}

// Serviço card
function ServicoCard({ servico, selecionado, onClick }: ServicoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full p-5 rounded-2xl border-2 transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        selecionado
          ? 'border-primary-500 bg-primary-50 shadow-soft'
          : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50'
      )}
      aria-pressed={selecionado}
    >
      <div className="flex items-start gap-4">
        <ServiceIcon selected={selecionado} />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg font-semibold text-neutral-900">{servico.nome}</h3>
          <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{servico.descricao}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1 text-sm text-neutral-500">
              {servico.duracaoMin} min
            </span>
          </div>
        </div>
        {selecionado && (
          <svg className="w-6 h-6 text-primary-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  )
}

// Calendário simplificado
function Calendario({ dataSelecionada, onDataSelect, diasDisponiveis, servicoDuracao, limiteDiasFuturo }: CalendarioProps) {
  const [mesAtual, setMesAtual] = useState(() => new Date())
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const diasDoMes = () => {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const diaSemanaInicio = primeiroDia.getDay()
    const diasNoMes = ultimoDia.getDate()
    
    const dias: (Date | null)[] = []
    for (let i = 0; i < diaSemanaInicio; i++) dias.push(null)
    for (let i = 1; i <= diasNoMes; i++) dias.push(new Date(ano, mes, i))
    return dias
  }

  const dataLimite = new Date(hoje)
  dataLimite.setDate(dataLimite.getDate() + limiteDiasFuturo)

  const diasDisponiveisSet = new Set(diasDisponiveis)

  const formatarMes = (data: Date) => 
    data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="card-padded" role="region" aria-label="Calendário de disponibilidade">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => setMesAtual(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })}
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Mês anterior"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="font-heading text-xl font-semibold text-neutral-900 capitalize">{formatarMes(mesAtual)}</h3>
        <button
          type="button"
          onClick={() => setMesAtual(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })}
          disabled={mesAtual.getMonth() === dataLimite.getMonth() && mesAtual.getFullYear() === dataLimite.getFullYear()}
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Próximo mês"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2" role="row">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, i) => (
          <div key={dia} className="text-center text-xs font-medium text-neutral-500 py-2" role="columnheader">
            {dia}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1" role="grid">
        {diasDoMes().map((dia, index) => {
          if (!dia) return <div key={`empty-${index}`} aria-hidden="true" />
          
          const dataISO = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
          const ehHoje = dia.getTime() === hoje.getTime()
          const ehPassado = dia < hoje
          const ehFuturo = dia > dataLimite
          const ehDomingo = dia.getDay() === 0
          const disponivel = diasDisponiveisSet.has(dataISO)
          const selecionado = dataSelecionada === dataISO
          const desabilitado = ehPassado || ehFuturo || ehDomingo || !disponivel

          return (
            <button
              key={dataISO}
              type="button"
              role="gridcell"
              aria-selected={selecionado}
              aria-disabled={desabilitado}
              aria-label={desabilitado ? `${formatarDataBR(dia)} - indisponível` : `${formatarDataBR(dia)} - ${disponivel ? 'disponível' : 'indisponível'}`}
              onClick={() => !desabilitado && onDataSelect(dataISO)}
              disabled={desabilitado}
              className={cn(
                'aspect-square rounded-xl font-medium text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 relative',
                selecionado
                  ? 'bg-primary-600 text-white shadow-soft'
                  : disponivel
                    ? 'text-neutral-700 hover:bg-primary-50'
                    : 'text-neutral-300 bg-neutral-50 cursor-not-allowed'
              )}
            >
              <span className="relative z-10">{dia.getDate()}</span>
              {ehHoje && !selecionado && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-500" aria-hidden="true" />
              )}
              {disponivel && !selecionado && !desabilitado && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-neutral-200">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="w-5 h-5 rounded-lg bg-primary-50 border border-primary-200" aria-hidden="true"></span>
          <span>Selecionado</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="w-5 h-5 rounded-lg bg-green-500" aria-hidden="true"></span>
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="w-5 h-5 rounded-lg bg-neutral-100 border border-neutral-200" aria-hidden="true"></span>
          <span>Indisponível</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="w-5 h-5 rounded-full bg-accent-500" aria-hidden="true"></span>
          <span>Hoje</span>
        </div>
      </div>
    </div>
  )
}

// Horários
function Horarios({ horarioSelecionado, onHorarioSelect, slots }: HorariosProps) {
  const slotsDisponiveis = slots.filter(s => s.disponivel)
  
  if (slotsDisponiveis.length === 0) {
    return (
      <div className="card-padded text-center py-12">
        <svg className="w-12 h-12 mx-auto text-neutral-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-2">Nenhum horário disponível</h3>
        <p className="text-neutral-600">Todos os horários para esta data estão ocupados. Tente outra data.</p>
      </div>
    )
  }

  return (
    <div className="card-padded" role="region" aria-label="Horários disponíveis">
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot.horario}
            type="button"
            onClick={() => slot.disponivel && onHorarioSelect(slot.horario)}
            disabled={!slot.disponivel}
            className={cn(
              'px-4 py-3 rounded-xl font-medium text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              horarioSelecionado === slot.horario
                ? 'bg-primary-600 text-white shadow-soft'
                : slot.disponivel
                  ? 'bg-white border border-neutral-200 text-neutral-700 hover:bg-primary-50 hover:border-primary-300'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
            )}
            aria-pressed={horarioSelecionado === slot.horario}
            aria-disabled={!slot.disponivel}
          >
            {slot.horario}
          </button>
        ))}
      </div>
      {slotsDisponiveis.length > 0 && (
        <p className="mt-4 text-sm text-neutral-500 text-center">
          {slotsDisponiveis.length} horário{slotsDisponiveis.length > 1 ? 's' : ''} disponível{slotsDisponiveis.length > 1 ? 'eis' : ''}
        </p>
      )}
    </div>
  )
}

// Dados do paciente
function DadosPaciente({ dados, onChange, erro, servicoNome, dataHora }: DadosPacienteProps) {
  const [telefoneFormatado, setTelefoneFormatado] = useState('')

  useEffect(() => {
    if (dados?.telefone) {
      setTelefoneFormatado(formatarTelefone(dados.telefone))
    }
  }, [dados?.telefone])

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '')
    let formatado = ''
    if (valor.length <= 2) formatado = `(${valor}`
    else if (valor.length <= 7) formatado = `(${valor.slice(0,2)}) ${valor.slice(2)}`
    else if (valor.length <= 11) formatado = `(${valor.slice(0,2)}) ${valor.slice(2,7)}-${valor.slice(7)}`
    else formatado = `(${valor.slice(0,2)}) ${valor.slice(2,7)}-${valor.slice(7,11)}`
    
    setTelefoneFormatado(formatado)
    onChange('telefone', valor)
  }

  return (
    <div className="card-padded space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-neutral-900 mb-1">Seus dados</h2>
        <p className="text-neutral-600">Preencha para confirmar seu agendamento</p>
      </div>

      {erro && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3" role="alert">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-700 text-sm">{erro}</p>
        </div>
      )}

      {/* Resumo do agendamento */}
      <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
        <div className="flex items-center gap-3">
          <ServiceIcon className="w-10 h-10" />
          <div>
            <p className="font-medium text-neutral-900">{servicoNome}</p>
            <p className="text-sm text-neutral-600">{dataHora}</p>
          </div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={e => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="nome" className="label">Nome completo *</label>
          <input
            type="text"
            id="nome"
            name="nome"
            autoComplete="name"
            value={dados?.nome || ''}
            onChange={e => onChange('nome', e.target.value)}
            className="input"
            placeholder="Como você gostaria de ser chamado(a)"
            required
            aria-required="true"
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label htmlFor="telefone" className="label">WhatsApp/Telefone *</label>
          <div className="relative">
            <input
              type="tel"
              id="telefone"
              name="telefone"
              autoComplete="tel"
              value={telefoneFormatado}
              onChange={handleTelefoneChange}
              className="input input-icone-esq"
              placeholder="(11) 96407-4862"
              required
              aria-required="true"
              maxLength={15}
              inputMode="tel"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 19.79 19.79 0 0 1 8.63 3.07A19.5 19.5 0 0 1 20 12a19.79 19.79 0 0 1 3.07 8.67 2 2 0 0 1-1.72 2z" />
              </svg>
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Usaremos apenas para confirmar e lembrar sua consulta</p>
        </div>

        <div className="form-group">
          <label htmlFor="dataNascimento" className="label">Data de nascimento *</label>
          <input
            type="date"
            id="dataNascimento"
            name="dataNascimento"
            autoComplete="bday"
            value={dados?.dataNascimento || ''}
            onChange={e => onChange('dataNascimento', e.target.value)}
            className="input"
            max={DATA_NASCIMENTO_MAX}
            required
            aria-required="true"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Obrigatória para confirmar sua identidade em &quot;Minha consulta&quot;, junto com o código.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="email" className="label">E-mail (opcional)</label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={dados?.email || ''}
            onChange={e => onChange('email', e.target.value)}
            className="input"
            placeholder="seu@email.com"
            maxLength={120}
          />
          <p className="text-xs text-neutral-500 mt-1">Enviaremos a confirmação e lembrete por e-mail também</p>
        </div>

        <div className="form-group">
          <label htmlFor="observacoes" className="label">Observações (opcional)</label>
          <textarea
            id="observacoes"
            name="observacoes"
            value={dados?.observacoes || ''}
            onChange={e => onChange('observacoes', e.target.value)}
            className="input min-h-[100px] resize-y"
            placeholder="Alergias, medos, preferências, motivo da consulta..."
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="consentimentoLGPD"
              checked={dados?.consentimentoLGPD || false}
              onChange={e => onChange('consentimentoLGPD', e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
              required
              aria-required="true"
            />
            <div className="text-sm text-neutral-700 leading-relaxed">
              <span className="font-medium">Concordo com o uso dos meus dados *</span>
              <p className="mt-1">
                Autorizo o armazenamento e uso dos meus dados pessoais para fins de agendamento, 
                confirmação e contato relacionados ao atendimento odontológico, conforme nossa 
                <a href="/lgpd" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">
                  Política de Privacidade e LGPD
                </a>
                . Seus dados não são compartilhados com terceiros.
              </p>
            </div>
          </label>
        </div>

        {/* Honeypot */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </form>
    </div>
  )
}

// Confirmação
function Confirmacao({ agendamento, onAdicionarCalendario, onWhatsApp, onEnviarCodigo, onNovoAgendamento }: ConfirmacaoProps) {
  if (!agendamento) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Card de sucesso */}
      <div className="card-padded text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center" aria-hidden="true">
          <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900 mb-2">Agendamento confirmado!</h2>
        <p className="text-neutral-600 text-base-lg">Seu horário está reservado. Enviamos a confirmação para seu WhatsApp e e-mail.</p>
      </div>

      {/* Detalhes */}
      <div className="card-padded space-y-4">
        <h3 className="font-heading text-lg font-semibold text-neutral-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Detalhes da consulta
        </h3>
        <dl className="space-y-3 divide-y divide-neutral-100">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 py-2">
            <dt className="text-neutral-500">Serviço</dt>
            <dd className="font-medium text-neutral-900">{agendamento.servicoNome}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 py-2">
            <dt className="text-neutral-500">Data e horário</dt>
            <dd className="font-medium text-neutral-900">{agendamento.dataHora}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 py-2">
            <dt className="text-neutral-500">Local</dt>
            <dd className="font-medium text-neutral-900">{agendamento.endereco}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 py-2">
            <dt className="text-neutral-500">Código do agendamento</dt>
            <dd className="font-mono text-lg font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg">{agendamento.codigo}</dd>
          </div>
        </dl>
      </div>

      {/* Ações */}
      <div className="card-padded space-y-4">
        <h3 className="font-heading text-lg font-semibold text-neutral-900">O que fazer agora?</h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <button
            onClick={onAdicionarCalendario}
            className="btn btn-outline btn-full sm:btn-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Adicionar ao calendário (.ics)
          </button>
          <button
            onClick={onWhatsApp}
            className="btn btn-accent btn-full sm:btn-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z"/>
            </svg>
            Confirmar no WhatsApp
          </button>
          <button
            onClick={onEnviarCodigo}
            className="btn btn-outline btn-full sm:btn-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z"/>
            </svg>
            Enviar meu código pelo WhatsApp
          </button>
        </div>
        <button
          onClick={onNovoAgendamento}
          className="btn btn-ghost btn-full sm:btn-lg"
        >
          Fazer outro agendamento
        </button>
      </div>

      {/* Informações importantes */}
      <div className="card-padded bg-neutral-50 border-neutral-200">
        <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Lembretes importantes
        </h3>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Guarde seu código: <strong>{agendamento.codigo}</strong> - necessário para cancelar ou remarcar
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Chegue 10 minutos antes do horário agendado
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Traga documento com foto e, se tiver, exames anteriores
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Para cancelar ou remarcar, avise com <strong>48 horas de antecedência</strong>
          </li>
        </ul>
      </div>
    </div>
  )
}

// Componente principal da aba de agendamento
export function AbaAgendamento() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<EstadoAgendamento>({
    passoAtual: 'servico',
    servicoId: undefined,
    data: undefined,
    horario: undefined,
    dadosPaciente: undefined,
    agendamentoConfirmado: undefined,
    erro: undefined,
  })
  const [carregando, setCarregando] = useState(false)
  const [diasDisponiveis, setDiasDisponiveis] = useState<string[]>([])
  const [slotsDoDia, setSlotsDoDia] = useState<{ horario: string; disponivel: boolean }[]>([])
  const [servicoDuracao, setServicoDuracao] = useState(60)
  const [limiteDiasFuturo, setLimiteDiasFuturo] = useState(60)
  // Serviços carregados do banco (ids reais gerados pelo Prisma)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [carregandoServicos, setCarregandoServicos] = useState(true)
  const [erroServicos, setErroServicos] = useState<string | null>(null)

  const carregarServicos = useCallback(async () => {
    setCarregandoServicos(true)
    setErroServicos(null)
    try {
      const res = await fetch('/api/servicos')
      if (!res.ok) throw new Error('Falha ao carregar serviços')
      const data = await res.json()
      setServicos(data.servicos || [])
    } catch (error) {
      console.error('Erro ao carregar serviços:', error)
      setErroServicos('Não foi possível carregar os serviços. Verifique sua conexão e tente novamente.')
    } finally {
      setCarregandoServicos(false)
    }
  }, [])

  // Carregar serviços do banco ao montar
  useEffect(() => {
    carregarServicos()
  }, [carregarServicos])

  // Carregar dias disponíveis ao selecionar serviço
  useEffect(() => {
    if (estado.servicoId) {
      carregarDiasDisponiveis(estado.servicoId)
    }
  }, [estado.servicoId])

  // Carregar slots ao selecionar data
  useEffect(() => {
    if (estado.data && estado.servicoId) {
      carregarSlotsDoDia(estado.data, estado.servicoId)
    }
  }, [estado.data, estado.servicoId])

  const carregarDiasDisponiveis = async (servicoId: string) => {
    try {
      const res = await fetch(`/api/agendamentos/disponibilidade?servicoId=${servicoId}&dias=${limiteDiasFuturo}`)
      if (res.ok) {
        const data = await res.json()
        setDiasDisponiveis(data.diasComDisponibilidade || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dias:', error)
    }
  }

  const carregarSlotsDoDia = async (data: string, servicoId: string) => {
    try {
      const res = await fetch(`/api/agendamentos/disponibilidade?servicoId=${servicoId}&dataInicio=${data}&dataFim=${data}`)
      if (res.ok) {
        const data = await res.json()
        if (data.dias?.[0]?.slots) {
          setSlotsDoDia(data.dias[0].slots.map((s: any) => ({ horario: s.horario, disponivel: s.disponivel })))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar horários:', error)
    }
  }

  const proximoPasso = useCallback(() => {
    const passos: PassoAgendamento[] = ['servico', 'data', 'horario', 'dados', 'confirmacao']
    const indiceAtual = passos.indexOf(estado.passoAtual)
    if (indiceAtual < passos.length - 1) {
      setEstado(prev => ({ ...prev, passoAtual: passos[indiceAtual + 1], erro: undefined }))
    }
  }, [estado.passoAtual])

  const passoAnterior = useCallback(() => {
    const passos: PassoAgendamento[] = ['servico', 'data', 'horario', 'dados', 'confirmacao']
    const indiceAtual = passos.indexOf(estado.passoAtual)
    if (indiceAtual > 0) {
      setEstado(prev => ({ ...prev, passoAtual: passos[indiceAtual - 1], erro: undefined }))
    }
  }, [estado.passoAtual])

  const handleServicoSelect = (servicoId: string) => {
    const servico = servicos.find(s => s.id === servicoId)
    if (servico) {
      setServicoDuracao(servico.duracaoMin)
      setEstado(prev => ({ 
        ...prev, 
        servicoId, 
        data: undefined, 
        horario: undefined,
        passoAtual: 'data' 
      }))
    }
  }

  const handleDataSelect = (data: string) => {
    setEstado(prev => ({ ...prev, data, horario: undefined, passoAtual: 'horario' }))
  }

  const handleHorarioSelect = (horario: string) => {
    setEstado(prev => ({ ...prev, horario, passoAtual: 'dados' }))
  }

  const handleDadosChange = (campo: string, valor: string | boolean) => {
    setEstado(prev => ({
      ...prev,
      // Garante TODAS as chaves desde o primeiro campo digitado: um spread
      // sobre undefined criaria { sóUmCampo } e qualquer leitura de outro
      // campo no render (ex.: telefone.replace no 2.1) derrubaria a página.
      dadosPaciente: {
        nome: '',
        telefone: '',
        consentimentoLGPD: false,
        ...prev.dadosPaciente,
        [campo]: valor,
      } as EstadoAgendamento['dadosPaciente'],
      erro: undefined,
    }))
  }

  const handleConfirmar = async () => {
    if (!estado.servicoId || !estado.data || !estado.horario || !estado.dadosPaciente) return

    const servico = servicos.find(s => s.id === estado.servicoId)
    if (!servico) return

    // Validações
    if (!estado.dadosPaciente.nome.trim()) {
      setEstado(prev => ({ ...prev, erro: 'Informe seu nome completo' }))
      return
    }
    if (!estado.dadosPaciente.telefone || estado.dadosPaciente.telefone.replace(/\D/g, '').length < 10) {
      setEstado(prev => ({ ...prev, erro: 'Informe um telefone válido' }))
      return
    }
    if (!estado.dadosPaciente.dataNascimento) {
      setEstado(prev => ({ ...prev, erro: 'Informe sua data de nascimento' }))
      return
    }
    if (!estado.dadosPaciente.consentimentoLGPD) {
      setEstado(prev => ({ ...prev, erro: 'É necessário aceitar o consentimento de uso dos dados' }))
      return
    }

    setCarregando(true)
    setEstado(prev => ({ ...prev, erro: undefined }))

    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicoId: estado.servicoId,
          data: estado.data,
          horario: estado.horario,
          nome: estado.dadosPaciente.nome,
          telefone: formatarTelefone(estado.dadosPaciente.telefone),
          dataNascimento: estado.dadosPaciente.dataNascimento,
          email: estado.dadosPaciente.email,
          observacoes: estado.dadosPaciente.observacoes,
          consentimentoLGPD: estado.dadosPaciente.consentimentoLGPD,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Reunir detalhes do Zod para mensagem útil ao usuário
        const detalhes = data.detalhes
          ? Object.values(data.detalhes).flat().filter(Boolean).join('; ')
          : ''
        throw new Error(detalhes ? `${data.erro}: ${detalhes}` : (data.erro || 'Erro ao confirmar agendamento'))
      }

      setEstado(prev => ({
        ...prev,
        passoAtual: 'sucesso',
        agendamentoConfirmado: {
          codigo: data.codigo,
          servicoNome: servico.nome,
          dataHora: `${formatarDataBR(data.dataHora)} às ${formatarHoraBR(data.dataHora)}`,
          endereco: data.endereco,
        },
      }))
    } catch (error) {
      setEstado(prev => ({ 
        ...prev, 
        erro: error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.' 
      }))
    } finally {
      setCarregando(false)
    }
  }

  const handleAdicionarCalendario = async () => {
    if (!estado.agendamentoConfirmado) return
    try {
      const res = await fetch('/api/agendamentos/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: estado.agendamentoConfirmado.codigo,
          telefone: estado.dadosPaciente?.telefone,
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `agendamento-${estado.agendamentoConfirmado.codigo}.ics`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Erro ao gerar .ics:', error)
    }
  }

  const handleWhatsApp = async () => {
    if (!estado.agendamentoConfirmado) return
    try {
      const res = await fetch('/api/agendamentos/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: estado.agendamentoConfirmado.codigo,
          telefone: estado.dadosPaciente?.telefone,
        }),
      })
      if (res.ok) {
        const { link } = await res.json()
        window.open(link, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Erro ao gerar link WhatsApp:', error)
    }
  }

  const handleEnviarCodigoWhatsApp = async () => {
    if (!estado.agendamentoConfirmado) return
    try {
      const res = await fetch('/api/agendamentos/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: estado.agendamentoConfirmado.codigo,
          telefone: estado.dadosPaciente?.telefone,
          tipo: 'acesso',
        }),
      })
      if (res.ok) {
        const { link } = await res.json()
        window.open(link, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Erro ao gerar link WhatsApp do código:', error)
    }
  }

  const handleNovoAgendamento = () => {
    setEstado({
      passoAtual: 'servico',
      servicoId: undefined,
      data: undefined,
      horario: undefined,
      dadosPaciente: undefined,
      agendamentoConfirmado: undefined,
      erro: undefined,
    })
    setSlotsDoDia([])
  }

  // Progress indicator
  const passos: PassoAgendamento[] = ['servico', 'data', 'horario', 'dados', 'confirmacao']
  const passoAtualIndex = passos.indexOf(estado.passoAtual)

  // 2.1 — "Confirmar agendamento" só ativa com nome, data de nascimento e
  // telefone válidos E o checkbox de consentimento marcado. O servidor também
  // recusa sem consentimento.
  // (|| '' por segurança: um objeto parcial nunca derruba o render.)
  const dadosPacienteValidos =
    !!estado.dadosPaciente &&
    (estado.dadosPaciente.nome || '').trim().length >= 3 &&
    (estado.dadosPaciente.telefone || '').replace(/\D/g, '').length >= 10 &&
    !!((estado.dadosPaciente.dataNascimento || '').trim().length > 0) &&
    estado.dadosPaciente.consentimentoLGPD === true

  return (
    <div className="max-w-3xl mx-auto">
      {/* Indicador de progresso */}
      <div className="mb-8" role="progressbar" aria-valuenow={passoAtualIndex + 1} aria-valuemin={1} aria-valuemax={5} aria-label="Progresso do agendamento">
        <div className="flex items-center justify-between">
          {passos.map((passo, index) => (
            <div key={passo} className="flex items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                index < passoAtualIndex
                  ? 'bg-primary-600 text-white'
                  : index === passoAtualIndex
                    ? 'bg-primary-600 text-white ring-4 ring-primary-200'
                    : 'bg-neutral-100 text-neutral-400'
              )} aria-hidden="true">
                {index < passoAtualIndex ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < passos.length - 1 && (
                <div className={cn(
                  'hidden lg:block w-16 h-0.5 mx-2 transition-all duration-300',
                  index < passoAtualIndex ? 'bg-primary-600' : 'bg-neutral-200'
                )} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 text-xs text-neutral-500">
          {['Serviço', 'Data', 'Horário', 'Seus dados', 'Confirmar'].map((label, index) => (
            <span key={label} className={cn(
              'w-10 lg:w-16 text-center transition-colors',
              index <= passoAtualIndex ? 'text-primary-600 font-medium' : ''
            )}>{label}</span>
          ))}
        </div>
      </div>

      {/* Conteúdo do passoAtual */}
      <div className="animate-fade-in" role="tabpanel" aria-label={estado.passoAtual === 'sucesso' ? 'Agendamento confirmado' : `Passo ${passoAtualIndex + 1}: ${passos[passoAtualIndex]}`}>
        {estado.passoAtual === 'servico' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="font-heading text-2xl font-semibold text-neutral-900">Qual serviço você deseja?</h2>
              <p className="text-neutral-600 mt-1">Escolha o tipo de atendimento que melhor atende sua necessidade</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Serviços disponíveis">
              {carregandoServicos && (
                <>
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="card-padded animate-pulse" aria-hidden="true">
                      <div className="h-5 w-2/3 bg-neutral-200 rounded mb-3" />
                      <div className="h-4 w-full bg-neutral-100 rounded mb-2" />
                      <div className="h-4 w-1/3 bg-neutral-100 rounded" />
                    </div>
                  ))}
                  <p className="sr-only" role="status">Carregando serviços…</p>
                </>
              )}
              {!carregandoServicos && erroServicos && (
                <div className="sm:col-span-2 card-padded text-center" role="alert">
                  <p className="text-red-600 font-medium mb-3">{erroServicos}</p>
                  <button type="button" onClick={carregarServicos} className="btn btn-primary">
                    Tentar novamente
                  </button>
                </div>
              )}
              {!carregandoServicos && !erroServicos && servicos.length === 0 && (
                <div className="sm:col-span-2 card-padded text-center" role="status">
                  <p className="text-neutral-500">Nenhum serviço disponível no momento.</p>
                </div>
              )}
              {!carregandoServicos && !erroServicos && servicos.map(servico => (
                <ServicoCard
                  key={servico.id}
                  servico={servico}
                  selecionado={estado.servicoId === servico.id}
                  onClick={() => handleServicoSelect(servico.id)}
                />
              ))}
            </div>
          </div>
        )}

        {estado.passoAtual === 'data' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="font-heading text-2xl font-semibold text-neutral-900">Escolha a data</h2>
              <p className="text-neutral-600 mt-1">Dias com horários disponíveis aparecem destacados</p>
            </div>
            <Calendario
              dataSelecionada={estado.data}
              onDataSelect={handleDataSelect}
              diasDisponiveis={diasDisponiveis}
              servicoDuracao={servicoDuracao}
              limiteDiasFuturo={limiteDiasFuturo}
            />
            <div className="flex justify-between">
              <button onClick={passoAnterior} className="btn btn-secondary" disabled={carregando}>Voltar</button>
              <button 
                onClick={proximoPasso} 
                className="btn btn-primary" 
                disabled={!estado.data || carregando}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {estado.passoAtual === 'horario' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="font-heading text-2xl font-semibold text-neutral-900">Escolha o horário</h2>
              <p className="text-neutral-600 mt-1">
                {estado.data ? `Disponíveis para ${formatarDataBR(estado.data)}` : 'Selecione uma data primeiro'}
              </p>
            </div>
            <Horarios
              horarioSelecionado={estado.horario}
              onHorarioSelect={handleHorarioSelect}
              slots={slotsDoDia}
            />
            <div className="flex justify-between">
              <button onClick={passoAnterior} className="btn btn-secondary" disabled={carregando}>Voltar</button>
              <button 
                onClick={proximoPasso} 
                className="btn btn-primary" 
                disabled={!estado.horario || carregando}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {estado.passoAtual === 'dados' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="font-heading text-2xl font-semibold text-neutral-900">Seus dados</h2>
              <p className="text-neutral-600 mt-1">Preencha para confirmar seu agendamento</p>
            </div>
            <DadosPaciente
              dados={estado.dadosPaciente}
              onChange={handleDadosChange}
              erro={estado.erro}
              servicoNome={servicos.find(s => s.id === estado.servicoId)?.nome || ''}
              dataHora={estado.data && estado.horario ? `${formatarDataBR(estado.data)} às ${estado.horario}` : ''}
            />
            <div className="flex justify-between">
              <button onClick={passoAnterior} className="btn btn-secondary" disabled={carregando}>Voltar</button>
              <button 
                onClick={handleConfirmar} 
                className={cn(
                  'btn btn-primary',
                  !dadosPacienteValidos && 'opacity-40 cursor-not-allowed'
                )}
                disabled={carregando || !dadosPacienteValidos}
                title={dadosPacienteValidos
                  ? undefined
                  : 'Preencha nome, telefone e marque o consentimento para ativar'}
              >
                {carregando ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" strokeLinecap="round" />
                    </svg>
                    Confirmando...
                  </span>
                ) : (
                  'Confirmar agendamento'
                )}
              </button>
            </div>
          </div>
        )}

        {estado.passoAtual === 'sucesso' && (
          <Confirmacao
            agendamento={estado.agendamentoConfirmado}
            onAdicionarCalendario={handleAdicionarCalendario}
            onWhatsApp={handleWhatsApp}
            onEnviarCodigo={handleEnviarCodigoWhatsApp}
            onNovoAgendamento={handleNovoAgendamento}
          />
        )}
      </div>
    </div>
  )
}