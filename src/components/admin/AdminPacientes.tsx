'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Agendamento, Paciente } from '@/types'

type PacienteComHistorico = Paciente & {
  agendamentos: (Agendamento & { servico: { nome: string } })[]
  _count: { agendamentos: number }
}

type AnotacaoProntuario = {
  id: string
  texto: string
  criadoEm: string | Date
}

interface AdminPacientesProps {
  pacientes: PacienteComHistorico[]
}

export function AdminPacientes({ pacientes: pacientesIniciais }: AdminPacientesProps) {
  const [pacientes, setPacientes] = useState(pacientesIniciais)
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  const digitosBusca = busca.replace(/\D/g, '')
  // Busca por nome/e-mail; telefone só entra para BUSCAS COM DÍGITOS —
  // `p.telefone.includes('')` seria sempre true e a busca por nome não filtraria.
  const pacientesFiltrados = pacientes.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (digitosBusca.length > 0 && p.telefone.includes(digitosBusca)) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  )

  const formatarTelefone = (tel: string) => {
    if (tel.length === 11) return `(${tel.slice(0,2)}) ${tel.slice(2,7)}-${tel.slice(7)}`
    if (tel.length === 10) return `(${tel.slice(0,2)}) ${tel.slice(2,6)}-${tel.slice(6)}`
    return tel
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-neutral-900">Pacientes</h2>
          <p className="text-neutral-600 mt-1">Histórico de consultas e anotações</p>
        </div>
      </div>

      {/* Busca */}
      <div className="card-padded">
        <div className="relative max-w-md">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input input-icone-esq"
            aria-label="Buscar pacientes"
          />
        </div>
      </div>

      {/* Lista de pacientes */}
      <div className="card overflow-hidden">
        {pacientesFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-neutral-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-1">Nenhum paciente encontrado</h3>
            <p className="text-neutral-500">Pacientes aparecem aqui após o primeiro agendamento.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {pacientesFiltrados.map(paciente => (
              <PacienteRow 
                key={paciente.id} 
                paciente={paciente} 
                expandido={expandido === paciente.id}
                onToggle={() => setExpandido(expandido === paciente.id ? null : paciente.id)}
                formatarTelefone={formatarTelefone}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProntuarioDatado({ pacienteId }: { pacienteId: string }) {
  const [notas, setNotas] = useState<AnotacaoProntuario[] | null>(null)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Carrega as anotações ao abrir o painel do paciente.
  useEffect(() => {
    let ativo = true
    setNotas(null)
    fetch(`/api/admin/pacientes/${pacienteId}/prontuario`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(data => { if (ativo) setNotas(Array.isArray(data) ? data : []) })
      .catch(() => { if (ativo) setNotas([]) })
    return () => { ativo = false }
  }, [pacienteId])

  const adicionarAnotacao = async () => {
    if (!texto.trim() || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/pacientes/${pacienteId}/prontuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim() }),
      })
      if (!res.ok) throw new Error()
      const nova = await res.json()
      setNotas(prev => [nova, ...(prev || [])])
      setTexto('')
    } catch {
      setErro('Erro ao salvar a anotação. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <h4 className="font-medium text-neutral-900 mb-2">Prontuário (anotações datadas)</h4>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            // Ctrl+Enter salva sem sair do teclado.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              adicionarAnotacao()
            }
          }}
          className="input min-h-[64px] resize-y"
          placeholder="Nova anotação (fica datada e preservada como histórico)..."
          maxLength={2000}
          aria-label="Nova anotação do prontuário"
        />
        <button
          type="button"
          onClick={adicionarAnotacao}
          disabled={salvando || !texto.trim()}
          className="btn btn-secondary self-start sm:self-auto shrink-0"
        >
          {salvando ? 'Salvando...' : 'Adicionar'}
        </button>
      </div>
      {erro && <p className="text-sm text-red-600 mb-2" role="alert">{erro}</p>}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notas === null ? (
          <p className="text-neutral-400 text-sm">Carregando anotações…</p>
        ) : notas.length === 0 ? (
          <p className="text-neutral-500 text-sm">Nenhuma anotação datada ainda.</p>
        ) : (
          notas.map(nota => (
            <div key={nota.id} className="p-3 rounded-lg bg-white border border-neutral-200">
              <time className="text-xs text-neutral-500">
                {format(new Date(nota.criadoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </time>
              <p className="text-sm text-neutral-700 whitespace-pre-line mt-1">{nota.texto}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PacienteRow({ 
  paciente, 
  expandido, 
  onToggle, 
  formatarTelefone 
}: { 
  paciente: PacienteComHistorico;
  expandido: boolean;
  onToggle: () => void;
  formatarTelefone: (tel: string) => string;
}) {
  const ultimaConsulta = paciente.agendamentos[0]
  const proximaConsulta = paciente.agendamentos.find(a => 
    new Date(a.dataHora) > new Date() && !['CANCELADO', 'FALTA'].includes(a.status)
  )

  return (
    <>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 hover:bg-neutral-50 transition-colors text-left flex items-center gap-4"
        aria-expanded={expandido}
      >
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-lg" aria-hidden="true">
          {paciente.nome.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-neutral-900 truncate">{paciente.nome}</span>
            <span className="text-sm text-neutral-500 font-mono">{formatarTelefone(paciente.telefone)}</span>
            {paciente.email && <span className="text-sm text-neutral-500 truncate max-w-[200px]">{paciente.email}</span>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
            <span>{paciente._count.agendamentos} consulta{paciente._count.agendamentos !== 1 ? 's' : ''}</span>
            {ultimaConsulta && (
              <span>Última: {format(new Date(ultimaConsulta.dataHora), 'dd/MM/yyyy', { locale: ptBR })}</span>
            )}
            {proximaConsulta && (
              <span className="text-primary-600 font-medium">Próxima: {format(new Date(proximaConsulta.dataHora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            )}
          </div>
        </div>
        <svg 
          className={cn('w-5 h-5 text-neutral-400 transition-transform', expandido && 'rotate-180')} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Detalhes expandidos */}
      {expandido && (
        <div className="bg-neutral-50 px-6 pb-6 animate-fade-in">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Informações */}
            <div className="md:col-span-2 space-y-4">
              {/* Cadastro (3.3): e-mail, consentimento LGPD e 1º agendamento */}
              <div className="card-padded bg-white border border-neutral-200 space-y-2 text-sm">
                <h4 className="font-medium text-neutral-900">Cadastro</h4>
                <p className="text-neutral-600">
                  <span className="font-medium text-neutral-800">Telefone:</span> {formatarTelefone(paciente.telefone)}
                  {paciente.email && <> · <span className="font-medium text-neutral-800">E-mail:</span> {paciente.email}</>}
                </p>
                <p className="text-neutral-600">
                  <span className="font-medium text-neutral-800">Consentimento:</span>{' '}
                  {paciente.consentimentoEm
                    ? format(new Date(paciente.consentimentoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : 'não registrado'}
                </p>
                <p className="text-neutral-600">
                  <span className="font-medium text-neutral-800">Primeiro agendamento pelo site:</span>{' '}
                  {paciente.primeiroAgendamentoEm
                    ? format(new Date(paciente.primeiroAgendamentoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : 'não registrado'}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-neutral-900 mb-2">Anotações internas</h4>
                <textarea
                  defaultValue={paciente.anotacoes || ''}
                  className="input min-h-[100px] resize-y"
                  placeholder="Anotações privadas da dentista (não visíveis ao paciente)..."
                  onBlur={async (e) => {
                    try {
                      await fetch(`/api/admin/pacientes/${paciente.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ anotacoes: e.target.value }),
                      })
                    } catch {}
                  }}
                />
              </div>

              {/* Histórico */}
              <div>
                <h4 className="font-medium text-neutral-900 mb-2">Histórico de consultas</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {paciente.agendamentos.length === 0 ? (
                    <p className="text-neutral-500 text-sm text-center py-4">Nenhuma consulta registrada</p>
                  ) : (
                    paciente.agendamentos.map(ag => (
                      <div key={ag.id} className="p-3 rounded-lg bg-white border border-neutral-200">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-medium">{ag.servico.nome}</span>
                            <span className="text-sm text-neutral-500 ml-2">{format(new Date(ag.dataHora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          </div>
                          <span className={cn('badge', {
                            'badge-warning': ag.status === 'PENDENTE',
                            'badge-primary': ag.status === 'CONFIRMADO',
                            'badge-danger': ag.status === 'CANCELADO',
                            'badge-success': ag.status === 'CONCLUIDO',
                            'badge-neutral': ag.status === 'FALTA',
                            'badge-accent': ag.status === 'REMARCADO',
                          })}>{ag.status}</span>
                        </div>
                        {ag.observacoes && (
                          <p className="text-sm text-neutral-600 mt-1">{ag.observacoes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Prontuário com anotações datadas (3.3) */}
              <ProntuarioDatado pacienteId={paciente.id} />
            </div>

            {/* Resumo */}
            <div className="space-y-4">
              <div className="card-padded text-center">
                <p className="text-3xl font-bold text-primary-600">{paciente._count.agendamentos}</p>
                <p className="text-sm text-neutral-500">Total de consultas</p>
              </div>
              <div className="card-padded">
                <h4 className="font-medium text-neutral-900 mb-3">Próximas consultas</h4>
                {proximaConsulta ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-primary-50 border border-primary-100">
                      <p className="font-medium">{proximaConsulta.servico.nome}</p>
                      <p className="text-sm text-neutral-600">{format(new Date(proximaConsulta.dataHora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-500 text-sm text-center py-4">Nenhuma agendada</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}