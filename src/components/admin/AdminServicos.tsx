'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Servico } from '@/types'

interface AdminServicosProps {
  servicos: (Servico & { _count?: { agendamentos: number } })[]
}

export function AdminServicos({ servicos: servicosIniciais }: AdminServicosProps) {
  const [servicos, setServicos] = useState(servicosIniciais)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    duracaoMin: 60,
    ativo: true,
    ordem: 0,
  })
  const [carregando, setCarregando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    const id = editandoId
    setCarregando(id || 'novo')

    try {
      const url = id ? `/api/admin/servicos/${id}` : '/api/admin/servicos'
      const method = id ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.erro || 'Erro ao salvar')
      }

      const servicoSalvo = await res.json()
      
      if (id) {
        setServicos(prev => prev.map(s => s.id === id ? servicoSalvo : s))
      } else {
        setServicos(prev => [...prev, servicoSalvo])
      }

      cancelarEdicao()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setCarregando(null)
    }
  }

  const iniciarEdicao = (servico: typeof servicos[0]) => {
    setEditandoId(servico.id)
    setFormData({
      nome: servico.nome,
      descricao: servico.descricao || '',
      duracaoMin: servico.duracaoMin,
      ativo: servico.ativo,
      ordem: servico.ordem,
    })
    setMostrarFormulario(true)
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setFormData({ nome: '', descricao: '', duracaoMin: 60, ativo: true, ordem: 0 })
    setMostrarFormulario(false)
    setErro(null)
  }

  const novoServico = () => {
    setFormData({ nome: '', descricao: '', duracaoMin: 60, ativo: true, ordem: servicos.length + 1 })
    setEditandoId(null)
    setMostrarFormulario(true)
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço? Agendamentos existentes não serão afetados.')) return
    
    setCarregando(id)
    try {
      const res = await fetch(`/api/admin/servicos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      setServicos(prev => prev.filter(s => s.id !== id))
    } catch (error) {
      setErro('Erro ao excluir serviço')
    } finally {
      setCarregando(null)
    }
  }

  const handleToggleAtivo = async (servico: typeof servicos[0]) => {
    setCarregando(servico.id)
    try {
      const res = await fetch(`/api/admin/servicos/${servico.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...servico, ativo: !servico.ativo }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      setServicos(prev => prev.map(s => s.id === servico.id ? { ...s, ativo: !s.ativo } : s))
    } catch {
      setErro('Erro ao atualizar')
    } finally {
      setCarregando(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-neutral-900">Serviços oferecidos</h2>
          <p className="text-neutral-600 mt-1">Gerencie os tipos de atendimento disponíveis para agendamento</p>
        </div>
        <button onClick={novoServico} className="btn btn-primary">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo serviço
        </button>
      </div>

      {erro && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3" role="alert">
          <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-700">{erro}</p>
        </div>
      )}

      {/* Formulário */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="card-padded space-y-4 animate-fade-in">
          <h3 className="font-heading text-lg font-semibold text-neutral-900">
            {editandoId ? 'Editar serviço' : 'Novo serviço'}
          </h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label htmlFor="nome" className="label">Nome *</label>
              <input
                type="text"
                id="nome"
                value={formData.nome}
                onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                className="input"
                required
                maxLength={80}
                disabled={!!carregando}
              />
            </div>
            <div className="form-group">
              <label htmlFor="duracaoMin" className="label">Duração (minutos) *</label>
              <input
                type="number"
                id="duracaoMin"
                value={formData.duracaoMin}
                onChange={e => setFormData(prev => ({ ...prev, duracaoMin: parseInt(e.target.value) || 60 }))}
                className="input"
                min={15}
                max={240}
                required
                disabled={!!carregando}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ordem" className="label">Ordem de exibição</label>
              <input
                type="number"
                id="ordem"
                value={formData.ordem}
                onChange={e => setFormData(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                className="input"
                min={0}
                disabled={!!carregando}
              />
            </div>
            <div className="form-group">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={e => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="w-5 h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  disabled={!!carregando}
                />
                <span className="text-sm text-neutral-700">Ativo para agendamento</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="descricao" className="label">Descrição</label>
            <textarea
              id="descricao"
              value={formData.descricao}
              onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              className="input min-h-[80px] resize-y"
              maxLength={300}
              rows={3}
              disabled={!!carregando}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button type="button" onClick={cancelarEdicao} className="btn btn-secondary" disabled={!!carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!!carregando}>
              {carregando ? 'Salvando...' : (editandoId ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      )}

      {/* Lista de serviços */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table" role="table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Nome</th>
                <th>Descrição</th>
                <th className="text-center">Duração</th>
                <th className="text-center">Ordem</th>
                <th className="text-center">Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-500">
                    Nenhum serviço cadastrado. Clique em "Novo serviço" para começar.
                  </td>
                </tr>
              ) : (
                servicos.map((servico) => (
                  <tr key={servico.id}>
                    <td>
                      <button
                        onClick={() => iniciarEdicao(servico)}
                        className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors"
                        aria-label={`Editar ${servico.nome}`}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </td>
                    <td className="font-medium">{servico.nome}</td>
                    <td className="text-neutral-600 max-w-xs truncate">{servico.descricao || '—'}</td>
                    <td className="text-center font-mono">{servico.duracaoMin} min</td>
                    <td className="text-center">{servico.ordem}</td>
                    <td className="text-center">
                      <button
                        onClick={() => handleToggleAtivo(servico)}
                        className={cn(
                          'badge px-3 py-1',
                          servico.ativo ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                        )}
                        disabled={carregando === servico.id}
                      >
                        {servico.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => iniciarEdicao(servico)}
                          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600"
                          aria-label={`Editar ${servico.nome}`}
                          disabled={carregando === servico.id}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleExcluir(servico.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600"
                          aria-label={`Excluir ${servico.nome}`}
                          disabled={carregando === servico.id}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}