'use client'

import { useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Agendamento, ConfiguracoesClinica } from '@/types'

interface AdminAgendaProps {
  agendamentosHoje: (Agendamento & { servico: { nome: string } })[]
  agendamentosSemana: (Agendamento & { servico: { nome: string } })[]
  stats: { hoje: number; semana: number; pendentes: number; confirmados: number }
  configuracoes: ConfiguracoesClinica
}

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDENTE: { label: 'Pendente', className: 'badge-warning' },
  CONFIRMADO: { label: 'Confirmado', className: 'badge-primary' },
  CANCELADO: { label: 'Cancelado', className: 'badge-danger' },
  CONCLUIDO: { label: 'Concluído', className: 'badge-success' },
  FALTA: { label: 'Faltou', className: 'badge-neutral' },
  REMARCADO: { label: 'Remarcado', className: 'badge-accent' },
}

export function AdminAgenda({ agendamentosHoje, agendamentosSemana, stats, configuracoes }: AdminAgendaProps) {
  const [abaAtiva, setAbaAtiva] = useState<'hoje' | 'semana' | 'lista'>('hoje')
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Agrupar agendamentos da semana por dia
  const agendamentosPorDia = agendamentosSemana.reduce((acc, ag) => {
    const data = format(new Date(ag.dataHora), 'yyyy-MM-dd')
    if (!acc[data]) acc[data] = []
    acc[data].push(ag)
    return acc
  }, {} as Record<string, typeof agendamentosSemana>)

  const semanaAtual = eachDayOfInterval({
    start: startOfWeek(dataSelecionada, { weekStartsOn: 1 }),
    end: endOfWeek(dataSelecionada, { weekStartsOn: 1 }),
  })

  return (
    <div className="space-y-8">
      {/* Cards de estatísticas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Hoje" valor={stats.hoje} icone="📅" cor="primary" />
        <StatCard titulo="Esta semana" valor={stats.semana} icone="📆" cor="accent" />
        <StatCard titulo="Pendentes" valor={stats.pendentes} icone="⏳" cor="warning" />
        <StatCard titulo="Confirmados" valor={stats.confirmados} icone="✅" cor="success" />
      </div>

      {/* Abas de visualização */}
      <div className="card">
        <div className="border-b border-neutral-200">
          <nav className="flex overflow-x-auto" role="tablist" aria-label="Visualizações da agenda">
            <button
              role="tab"
              aria-selected={abaAtiva === 'hoje'}
              onClick={() => setAbaAtiva('hoje')}
              className={cn(
                'tab-btn whitespace-nowrap',
                abaAtiva === 'hoje' && 'tab-btn-active'
              )}
            >
              Hoje
            </button>
            <button
              role="tab"
              aria-selected={abaAtiva === 'semana'}
              onClick={() => setAbaAtiva('semana')}
              className={cn(
                'tab-btn whitespace-nowrap',
                abaAtiva === 'semana' && 'tab-btn-active'
              )}
            >
              Semana
            </button>
            <button
              role="tab"
              aria-selected={abaAtiva === 'lista'}
              onClick={() => setAbaAtiva('lista')}
              className={cn(
                'tab-btn whitespace-nowrap',
                abaAtiva === 'lista' && 'tab-btn-active'
              )}
            >
              Lista completa
            </button>
          </nav>
        </div>

        <div className="p-6" role="tabpanel">
          {abaAtiva === 'hoje' && (
            <VisaoHoje agendamentos={agendamentosHoje} />
          )}

          {abaAtiva === 'semana' && (
            <VisaoSemana 
              semana={semanaAtual} 
              agendamentosPorDia={agendamentosPorDia}
              dataSelecionada={dataSelecionada}
              onDataSelect={setDataSelecionada}
              onNavegarSemana={(dir) => setDataSelecionada(d => addDays(d, dir * 7))}
            />
          )}

          {abaAtiva === 'lista' && (
            <VisaoLista 
              agendamentos={agendamentosSemana} 
              filtroStatus={filtroStatus}
              onFiltroChange={setFiltroStatus}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ titulo, valor, icone, cor }: { titulo: string; valor: number; icone: string; cor: 'primary' | 'accent' | 'warning' | 'success' }) {
  const cores = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    accent: 'bg-accent-50 text-accent-700 border-accent-100',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    success: 'bg-green-50 text-green-700 border-green-100',
  }

  return (
    <div className={cn('card-padded', cores[cor], 'border')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{titulo}</p>
          <p className="text-3xl font-bold mt-1">{valor}</p>
        </div>
        <span className="text-4xl" aria-hidden="true">{icone}</span>
      </div>
    </div>
  )
}

function VisaoHoje({ agendamentos }: { agendamentos: AdminAgendaProps['agendamentosHoje'] }) {
  if (agendamentos.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-neutral-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-1">Nenhum agendamento hoje</h3>
        <p className="text-neutral-500">Aproveite o dia tranquilo! ☕</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {agendamentos.map((ag) => (
        <AgendamentoCard key={ag.id} agendamento={ag} compacto />
      ))}
    </div>
  )
}

function VisaoSemana({ 
  semana, 
  agendamentosPorDia, 
  dataSelecionada,
  onDataSelect,
  onNavegarSemana 
}: { 
  semana: Date[]
  agendamentosPorDia: Record<string, AdminAgendaProps['agendamentosHoje']>
  dataSelecionada: Date
  onDataSelect: (d: Date) => void
  onNavegarSemana: (dir: number) => void
}) {
  return (
    <div className="space-y-4">
      {/* Navegação da semana */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onNavegarSemana(-1)} className="p-2 rounded-xl hover:bg-neutral-100" aria-label="Semana anterior">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="font-heading text-lg font-semibold text-neutral-900">
          Semana de {format(semana[0], 'dd/MM', { locale: ptBR })} a {format(semana[6], 'dd/MM', { locale: ptBR })}
        </h3>
        <button onClick={() => onNavegarSemana(1)} className="p-2 rounded-xl hover:bg-neutral-100" aria-label="Próxima semana">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Grid da semana */}
      <div className="grid grid-cols-7 gap-2" role="grid">
        {semana.map((dia) => {
          const dataISO = format(dia, 'yyyy-MM-dd')
          const ags = agendamentosPorDia[dataISO] || []
          const ehHoje = isSameDay(dia, new Date())
          const ehSelecionado = isSameDay(dia, dataSelecionada)

          return (
            <div
              key={dataISO}
              role="gridcell"
              onClick={() => onDataSelect(dia)}
              className={cn(
                'card p-3 min-h-[120px] transition-all cursor-pointer',
                ehSelecionado && 'ring-2 ring-primary-500 bg-primary-50',
                ehHoje && !ehSelecionado && 'ring-1 ring-accent-500'
              )}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onDataSelect(dia)}
            >
              <div className={cn(
                'text-center mb-2 text-sm font-medium',
                ehHoje ? 'text-primary-600' : 'text-neutral-600'
              )}>
                {format(dia, 'EEE', { locale: ptBR })}
                <div className={cn('text-2xl font-bold mt-1', ehHoje ? 'text-primary-600' : 'text-neutral-900')}>
                  {format(dia, 'dd')}
                </div>
              </div>
              <div className="space-y-1.5 max-h-[80px] overflow-y-auto">
                {ags.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-2">Livre</p>
                ) : (
                  ags.map((ag) => (
                    <div
                      key={ag.id}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs truncate',
                        statusLabels[ag.status]?.className || 'badge-neutral'
                      )}
                      title={`${format(new Date(ag.dataHora), 'HH:mm')} - ${ag.servico.nome}`}
                    >
                      <div className="font-medium">{format(new Date(ag.dataHora), 'HH:mm')}</div>
                      <div className="truncate">{ag.servico.nome}</div>
                    </div>
                  ))
                )}
              </div>
              {ags.length > 3 && (
                <p className="text-xs text-neutral-500 text-center mt-1">+{ags.length - 3} mais</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VisaoLista({ 
  agendamentos, 
  filtroStatus, 
  onFiltroChange 
}: { 
  agendamentos: AdminAgendaProps['agendamentosSemana']
  filtroStatus: string
  onFiltroChange: (s: string) => void
}) {
  const statusOptions = ['todos', 'PENDENTE', 'CONFIRMADO', 'CANCELADO', 'CONCLUIDO', 'FALTA', 'REMARCADO']

  const agendamentosFiltrados = filtroStatus === 'todos' 
    ? agendamentos 
    : agendamentos.filter(a => a.status === filtroStatus)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => onFiltroChange(status)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              filtroStatus === status
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
            aria-pressed={filtroStatus === status}
          >
            {status === 'todos' ? 'Todos' : statusLabels[status]?.label || status}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="table" role="table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Paciente</th>
              <th>Serviço</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {agendamentosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-neutral-500">
                  Nenhum agendamento encontrado
                </td>
              </tr>
            ) : (
              agendamentosFiltrados.map((ag) => (
                <tr key={ag.id}>
                  <td className="font-mono whitespace-nowrap">
                    {format(new Date(ag.dataHora), 'dd/MM', { locale: ptBR })} às {format(new Date(ag.dataHora), 'HH:mm')}
                  </td>
                  <td>
                    <div className="font-medium">{ag.pacienteNome}</div>
                    <div className="text-sm text-neutral-500">{ag.pacienteTelefone}</div>
                  </td>
                  <td>{ag.servico.nome}</td>
                  <td>
                    <span className={cn('badge', statusLabels[ag.status]?.className || 'badge-neutral')}>
                      {statusLabels[ag.status]?.label || ag.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AcoesAgendamento agendamento={ag} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AgendamentoCard({ agendamento, compacto }: { agendamento: Agendamento & { servico: { nome: string } }; compacto?: boolean }) {
  return (
    <div className={cn('card p-4 flex items-center gap-4', compacto && 'py-3')}>
      <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0" aria-hidden="true">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-lg font-semibold text-primary-600">{format(new Date(agendamento.dataHora), 'HH:mm')}</span>
          <span className={cn('badge', statusLabels[agendamento.status]?.className || 'badge-neutral')}>
            {statusLabels[agendamento.status]?.label || agendamento.status}
          </span>
          <span className="text-sm text-neutral-500">{agendamento.servico.nome}</span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900 truncate">{agendamento.pacienteNome}</span>
          <span>{agendamento.pacienteTelefone}</span>
          {agendamento.observacoes && (
            <span className="truncate max-w-[200px]">{agendamento.observacoes}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <AcoesAgendamento agendamento={agendamento} compacto />
      </div>
    </div>
  )
}

function AcoesAgendamento({ agendamento, compacto }: { agendamento: Agendamento & { servico: { nome: string } }; compacto?: boolean }) {
  const podeConfirmar = agendamento.status === 'PENDENTE'
  const podeConcluir = ['PENDENTE', 'CONFIRMADO', 'REMARCADO'].includes(agendamento.status)
  const podeCancelar = ['PENDENTE', 'CONFIRMADO', 'REMARCADO'].includes(agendamento.status)
  const podeMarcarFalta = ['PENDENTE', 'CONFIRMADO'].includes(agendamento.status)

  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Ações para ${agendamento.pacienteNome}`}>
      {podeConfirmar && (
        <button className={cn('p-2 rounded-xl hover:bg-green-50 text-green-600 transition-colors', compacto ? 'p-1.5' : '')} title="Confirmar">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}
      {podeConcluir && (
        <button className={cn('p-2 rounded-xl hover:bg-primary-50 text-primary-600 transition-colors', compacto ? 'p-1.5' : '')} title="Marcar como concluída">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </button>
      )}
      {podeCancelar && (
        <button className={cn('p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors', compacto ? 'p-1.5' : '')} title="Cancelar">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {podeMarcarFalta && (
        <button className={cn('p-2 rounded-xl hover:bg-neutral-100 text-neutral-600 transition-colors', compacto ? 'p-1.5' : '')} title="Marcar falta">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>
      )}
      <button className={cn('p-2 rounded-xl hover:bg-neutral-100 text-neutral-600 transition-colors', compacto ? 'p-1.5' : '')} title="Remarcar">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
    </div>
  )
}