'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { HorarioFuncionamento } from '@/lib/config'
import { FotoDentista } from '@/components/FotoDentista'
import { EditorFoto } from './EditorFoto'

interface AdminConfiguracoesProps {
  configuracoes: Record<string, string>
}

const DIAS_SEMANA = [
  { key: 'dom', label: 'Domingo', num: 0 },
  { key: 'seg', label: 'Segunda', num: 1 },
  { key: 'ter', label: 'Terça', num: 2 },
  { key: 'qua', label: 'Quarta', num: 3 },
  { key: 'qui', label: 'Quinta', num: 4 },
  { key: 'sex', label: 'Sexta', num: 5 },
  { key: 'sab', label: 'Sábado', num: 6 },
]

export function AdminConfiguracoes({ configuracoes: configsIniciais }: AdminConfiguracoesProps) {
  const [configs, setConfigs] = useState(configsIniciais)
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'horarios' | 'agendamento'>('geral')

  // Estado para horários
  const [horarios, setHorarios] = useState<Record<number, HorarioFuncionamento[]>>(() => {
    const h: Record<number, HorarioFuncionamento[]> = {}
    DIAS_SEMANA.forEach(dia => {
      const chave = `horario_funcionamento_${dia.key}`
      const valor = configs[chave] || ''
      if (valor.trim()) {
        h[dia.num] = valor.split(',').map(p => {
          const [inicio, fim] = p.trim().split('-')
          return { inicio: inicio.trim(), fim: fim.trim() }
        })
      } else {
        h[dia.num] = []
      }
    })
    return h
  })

  const handleChange = (chave: string, valor: string) => {
    setConfigs(prev => ({ ...prev, [chave]: valor }))
  }

  const adicionarPeriodo = (dia: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: [...(prev[dia] || []), { inicio: '08:00', fim: '12:00' }],
    }))
  }

  const removerPeriodo = (dia: number, index: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: prev[dia].filter((_, i) => i !== index),
    }))
  }

  const atualizarPeriodo = (dia: number, index: number, campo: 'inicio' | 'fim', valor: string) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: prev[dia].map((p, i) => i === index ? { ...p, [campo]: valor } : p),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro(null)
    setSucesso(false)

    try {
      // Estado interno usa as chaves do banco (snake_case); o schema/cadastro
      // espera camelCase + horários aninhados. Converter antes de enviar.
      const paraCamel: Record<string, string> = {
        clinica_nome: 'clinicaNome',
        clinica_endereco: 'clinicaEndereco',
        clinica_telefone: 'clinicaTelefone',
        clinica_whatsapp: 'clinicaWhatsApp',
        clinica_email: 'clinicaEmail',
        dentista_nome: 'dentistaNome',
        dentista_cro: 'dentistaCRO',
        dentista_formacao: 'dentistaFormacao',
        dentista_experiencia: 'dentistaExperiencia',
        dentista_foto: 'dentistaFoto',
        duracao_padrao_minutos: 'duracaoPadraoMinutos',
        antecedencia_minima_horas: 'antecedenciaMinimaHoras',
        limite_dias_futuro: 'limiteDiasFuturo',
        intervalo_agendamento_minutos: 'intervaloAgendamentoMinutos',
        limite_agendamentos_ip_hora: 'limiteAgendamentosIpHora',
      }

      const base: Record<string, string> = {}
      Object.entries(configs).forEach(([k, v]) => {
        const alvo = paraCamel[k]
        if (alvo) base[alvo] = v ?? ''
      })

      // Horários: dicionário numérico -> lista de períodos (formato do schema)
      const horariosObj: Record<string, { inicio: string; fim: string }[]> = {}
      DIAS_SEMANA.forEach(dia => {
        horariosObj[String(dia.num)] = horarios[dia.num] || []
      })

      const dados = { ...base, horarios: horariosObj }

      const res = await fetch('/api/admin/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detalhes = data.detalhes
          ? Object.entries(data.detalhes)
              .map(([campo, msgs]) => `${campo}: ${(msgs as string[]).join(', ')}`)
              .join(' · ')
          : ''
        const msg = data.erro || 'Erro ao salvar configurações'
        throw new Error(detalhes ? `${msg} — ${detalhes}` : msg)
      }

      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Erro ao salvar configurações')
    } finally {
      setCarregando(false)
    }
  }

  const tabs = [
    { id: 'geral', label: 'Geral', icone: '⚙️' },
    { id: 'horarios', label: 'Horários', icone: '🕐' },
    { id: 'agendamento', label: 'Agendamento', icone: '📅' },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-neutral-900">Configurações</h2>
          <p className="text-neutral-600 mt-1">Ajuste as informações do consultório e regras de agendamento</p>
        </div>
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

      {sucesso && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3" role="status">
          <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-green-700">Configurações salvas com sucesso!</p>
        </div>
      )}

      {/* Abas */}
      <div className="card">
        <div className="border-b border-neutral-200">
          <nav className="flex overflow-x-auto" role="tablist">
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={abaAtiva === tab.id}
                onClick={() => setAbaAtiva(tab.id as typeof abaAtiva)}
                className={cn(
                  'tab-btn whitespace-nowrap',
                  abaAtiva === tab.id && 'tab-btn-active'
                )}
              >
                <span aria-hidden="true">{tab.icone}</span> {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Aba Geral */}
          {abaAtiva === 'geral' && (
            <div className="space-y-6">
              <h3 className="font-heading text-lg font-semibold text-neutral-900">Identificação</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoInput label="Nome da clínica" chave="clinica_nome" valor={configs.clinica_nome} onChange={handleChange} required />
                <CampoInput label="Nome da dentista" chave="dentista_nome" valor={configs.dentista_nome} onChange={handleChange} required />
                <CampoInput label="CRO" chave="dentista_cro" valor={configs.dentista_cro} onChange={handleChange} placeholder="CRO/UF XXXXX" />
              </div>

              {/* Sobre a dentista (aparece nas páginas públicas) */}
              <CampoArea
                label="Formação (aparece na seção Sobre)"
                chave="dentista_formacao"
                valor={configs.dentista_formacao || ''}
                onChange={handleChange}
                maxLength={600}
                placeholder="Graduada em Odontologia pela [Universidade] em [Ano]..."
                rows={3}
              />
              <CampoArea
                label="Experiência (aparece na seção Sobre)"
                chave="dentista_experiencia"
                valor={configs.dentista_experiencia || ''}
                onChange={handleChange}
                maxLength={1200}
                placeholder="Com X anos de dedicação à odontologia, atende..."
                rows={4}
              />

              {/* Foto: escolha exclusiva entre arquivo e URL + editor de enquadramento */}
              <CampoFoto
                chave="dentista_foto"
                valor={configs.dentista_foto}
                focoX={configs.dentista_foto_foco_x}
                focoY={configs.dentista_foto_foco_y}
                zoom={configs.dentista_foto_zoom}
                onChange={handleChange}
              />

              <h3 className="font-heading text-lg font-semibold text-neutral-900 pt-4 border-t border-neutral-200">Contato e Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoInput label="Endereço completo" chave="clinica_endereco" valor={configs.clinica_endereco} onChange={handleChange} />
                <CampoInput label="Telefone fixo" chave="clinica_telefone" valor={configs.clinica_telefone} onChange={handleChange} placeholder="(XX) XXXX-XXXX" />
                <CampoInput label="WhatsApp (somente números)" chave="clinica_whatsapp" valor={configs.clinica_whatsapp} onChange={handleChange} placeholder="55DDDNNNNNNNNN" />
                <CampoInput label="E-mail" chave="clinica_email" valor={configs.clinica_email} onChange={handleChange} type="email" placeholder="contato@exemplo.com" />
              </div>
            </div>
          )}

          {/* Aba Horários */}
          {abaAtiva === 'horarios' && (
            <div className="space-y-6">
              <h3 className="font-heading text-lg font-semibold text-neutral-900">Horários de funcionamento por dia</h3>
              <p className="text-neutral-600 text-sm">Adicione múltiplos períodos por dia (ex: manhã e tarde). Deixe vazio para fechar.</p>
              
              <div className="space-y-4">
                {DIAS_SEMANA.map(dia => (
                  <fieldset key={dia.key} className="border border-neutral-200 rounded-xl p-4">
                    <legend className="font-medium text-neutral-900 mb-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={horarios[dia.num].length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setHorarios(prev => ({ ...prev, [dia.num]: [{ inicio: '08:00', fim: '12:00' }] }))
                          } else {
                            setHorarios(prev => ({ ...prev, [dia.num]: [] }))
                          }
                        }}
                        className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      {dia.label}
                    </legend>
                    
                    {horarios[dia.num].length > 0 && (
                      <div className="space-y-2 ml-6">
                        {horarios[dia.num].map((periodo, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <label className="text-sm text-neutral-600 w-16">Início</label>
                            <input
                              type="time"
                              value={periodo.inicio}
                              onChange={e => atualizarPeriodo(dia.num, index, 'inicio', e.target.value)}
                              className="input w-32"
                            />
                            <label className="text-sm text-neutral-600 w-16">Fim</label>
                            <input
                              type="time"
                              value={periodo.fim}
                              onChange={e => atualizarPeriodo(dia.num, index, 'fim', e.target.value)}
                              className="input w-32"
                            />
                            {horarios[dia.num].length > 1 && (
                              <button
                                type="button"
                                onClick={() => removerPeriodo(dia.num, index)}
                                className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                aria-label={`Remover período ${index + 1}`}
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => adicionarPeriodo(dia.num)}
                          className="btn btn-secondary btn-sm mt-2"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Adicionar período
                        </button>
                      </div>
                    )}
                  </fieldset>
                ))}
              </div>
            </div>
          )}

          {/* Aba Agendamento */}
          {abaAtiva === 'agendamento' && (
            <div className="space-y-6">
              <h3 className="font-heading text-lg font-semibold text-neutral-900">Regras de agendamento</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CampoNumber 
                  label="Duração padrão (min)" 
                  chave="duracao_padrao_minutos" 
                  valor={parseInt(configs.duracao_padrao_minutos || '60')} 
                  onChange={handleChange} 
                  min={15} 
                  max={240} 
                />
                <CampoNumber 
                  label="Antecedência mínima (horas)" 
                  chave="antecedencia_minima_horas" 
                  valor={parseInt(configs.antecedencia_minima_horas || '24')} 
                  onChange={handleChange} 
                  min={1} 
                  max={168} 
                />
                <CampoNumber 
                  label="Limite dias no futuro" 
                  chave="limite_dias_futuro" 
                  valor={parseInt(configs.limite_dias_futuro || '60')} 
                  onChange={handleChange} 
                  min={1} 
                  max={365} 
                />
                <CampoNumber 
                  label="Intervalo entre horários (min)" 
                  chave="intervalo_agendamento_minutos" 
                  valor={parseInt(configs.intervalo_agendamento_minutos || '15')} 
                  onChange={handleChange} 
                  min={5} 
                  max={60} 
                />
                <CampoNumber 
                  label="Limite agendamentos/IP/hora" 
                  chave="limite_agendamentos_ip_hora" 
                  valor={parseInt(configs.limite_agendamentos_ip_hora || '10')} 
                  onChange={handleChange} 
                  min={1} 
                  max={100} 
                />
              </div>
            </div>
          )}

          {/* Botão salvar */}
          <div className="flex justify-end pt-4 border-t border-neutral-200">
            <button type="submit" className="btn btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar todas as configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Área de texto simples (um campo do banco, uma <textarea>)
function CampoArea({ label, chave, valor, onChange, placeholder, maxLength, rows = 3 }: {
  label: string;
  chave: string;
  valor: string;
  onChange: (k: string, v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className="form-group">
      <label htmlFor={chave} className="label">{label}</label>
      <textarea
        id={chave}
        value={valor || ''}
        onChange={e => onChange(chave, e.target.value)}
        className="input"
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
      />
    </div>
  )
}

// Campo da foto da dentista com EXCLUSÃO MÚTUA: o admin escolhe ENVIAR DO
// COMPUTADOR (JPG/PNG/WebP, máx. 5 MB) OU COLAR UMA URL de imagem.
// Depois de escolher, o editor de enquadramento abre para posicionar o rosto,
// dar zoom e escolher o ponto de foco (salvo como foco + zoom no banco).
function CampoFoto({ chave, valor, focoX, focoY, zoom, onChange }: {
  chave: string;
  valor: string;
  focoX?: string;
  focoY?: string;
  zoom?: string;
  onChange: (k: string, v: string) => void;
}) {
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)
  const [editorAberto, setEditorAberto] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_MB = 5
  const veioDoUpload = valor?.startsWith('/uploads/')

  // Modo inicial conforme o valor já salvo
  const [modo, setModo] = useState<'arquivo' | 'url'>(veioDoUpload ? 'arquivo' : valor ? 'url' : 'arquivo')

  // Trocar de opção desativa e limpa a outra
  const trocarModo = (novo: 'arquivo' | 'url') => {
    if (novo === modo) return
    setModo(novo)
    setMensagem(null)
    setEditorAberto(null)
    if (inputRef.current) inputRef.current.value = '' // limpa arquivo escolhido mas não enviado
    onChange(chave, '') // limpa o valor do modo anterior (não ficam os dois)
  }

  const enviarArquivo = async (arquivo: File) => {
    setMensagem(null)

    // Validação no cliente (rápida) — o servidor valida também, com mais rigor
    // (magic bytes, tamanho e sessão de admin)
    const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp']
    if (!tiposAceitos.includes(arquivo.type)) {
      setMensagem({ tipo: 'erro', texto: 'Formato não permitido. Envie JPG, PNG ou WebP.' })
      return
    }
    if (arquivo.size > MAX_MB * 1024 * 1024) {
      setMensagem({ tipo: 'erro', texto: `Arquivo muito grande. O limite é ${MAX_MB} MB.` })
      return
    }

    setEnviando(true)
    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao enviar o arquivo.' })
        return
      }

      // Grava o caminho salvo no estado do formulário (e no banco já foi direto na rota)
      onChange(chave, data.caminho)
      setMensagem({ tipo: 'ok', texto: 'Foto enviada! Ajuste o enquadramento na janela que abriu.' })
      if (inputRef.current) inputRef.current.value = ''
      // Abre o editor automaticamente com a foto recém-enviada
      setEditorAberto(data.caminho)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Falha de conexão ao enviar o arquivo.' })
    } finally {
      setEnviando(false)
    }
  }

  // Abre o editor para a URL digitada (validação rápida; o carregamento real
  // acontece dentro do editor, que avisa se a imagem não abrir)
  const abrirEditorDaUrl = () => {
    const url = (valor || '').trim()
    try {
      const absoluta = new URL(url)
      if (!/^https?:$/.test(absoluta.protocol)) throw new Error('protocolo')
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Informe uma URL de imagem válida (https://...).' })
      return
    }
    if (!/\.(jpe?g|png|webp)(\?.*)?$/i.test(url)) {
      setMensagem({ tipo: 'erro', texto: 'A URL deve apontar para uma imagem .jpg, .jpeg, .png ou .webp.' })
      return
    }
    setMensagem(null)
    setEditorAberto(url)
  }

  const salvarEnquadramento = (foco: { focoX: number; focoY: number; zoom: number }) => {
    onChange('dentista_foto_foco_x', String(foco.focoX))
    onChange('dentista_foto_foco_y', String(foco.focoY))
    onChange('dentista_foto_zoom', String(foco.zoom))
    setEditorAberto(null)
    setMensagem({
      tipo: 'ok',
      texto: 'Enquadramento salvo! A página pública já usa este ajuste.',
    })
  }

  return (
    <fieldset className="border border-neutral-200 rounded-xl p-4 space-y-3">
      <legend className="px-1 font-medium text-neutral-900">Foto da dentista</legend>
      <p className="text-xs text-neutral-500">Escolha UMA das opções: enviar um arquivo do computador ou colar uma URL de imagem. Depois ajuste o enquadramento para o rosto ficar sempre bem posicionado.</p>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Pré-visualização já com o enquadramento salvo */}
        <div className="shrink-0 w-32">
          {valor ? (
            <>
              <FotoDentista
                src={valor}
                alt="Pré-visualização da foto da dentista"
                focoX={focoX}
                focoY={focoY}
                zoom={zoom}
                className="rounded-xl border-4 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setEditorAberto(valor)}
                disabled={enviando}
                className="btn btn-secondary btn-sm mt-2 w-full"
              >
                Ajustar enquadramento
              </button>
            </>
          ) : (
            <div
              className="w-32 aspect-[4/5] rounded-xl flex items-center justify-center bg-primary-50 text-primary-300 border-4 border-white shadow-sm"
              aria-hidden="true"
            >
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          {/* Escolha exclusiva do formato da foto */}
          <div role="radiogroup" aria-label="Origem da foto" className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-900 cursor-pointer">
              <input
                type="radio"
                name="modo-foto"
                checked={modo === 'arquivo'}
                onChange={() => trocarModo('arquivo')}
                disabled={enviando}
                className="accent-primary-600"
              />
              Enviar do computador
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-900 cursor-pointer">
              <input
                type="radio"
                name="modo-foto"
                checked={modo === 'url'}
                onChange={() => trocarModo('url')}
                disabled={enviando}
                className="accent-primary-600"
              />
              Colar URL de imagem
            </label>
          </div>

          {modo === 'arquivo' ? (
            <div className="space-y-2">
              <label htmlFor="upload-foto" className="sr-only">Arquivo de imagem</label>
              <input
                ref={inputRef}
                type="file"
                id="upload-foto"
                name="upload-foto"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                disabled={enviando}
                className="input file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer file:text-sm"
                onChange={e => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) enviarArquivo(arquivo)
                }}
              />
              <p className="text-xs text-neutral-500">
                JPG, PNG ou WebP · máx. {MAX_MB} MB. Ao enviar, o editor de enquadramento abre automaticamente.
              </p>
              {valor?.startsWith('/uploads/') && (
                <p className="text-xs text-neutral-500">Foto atual: arquivo enviado ({valor}).</p>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor={chave} className="label">URL da imagem</label>
              <input
                type="url"
                id={chave}
                value={valor || ''}
                onChange={e => onChange(chave, e.target.value)}
                className="input"
                placeholder="https://exemplo.com/foto.jpg"
                disabled={enviando}
              />
              <button
                type="button"
                onClick={abrirEditorDaUrl}
                disabled={!valor || enviando}
                className="btn btn-secondary btn-sm mt-2"
              >
                Abrir editor de enquadramento
              </button>
              {valor && !valor.startsWith('/uploads/') && (
                <p className="text-xs text-neutral-500 mt-1">A URL é aplicada ao salvar as configurações.</p>
              )}
            </div>
          )}

          {enviando && <p className="text-sm text-primary-700" role="status">Enviando…</p>}
          {mensagem && (
            <p
              className={cn('text-sm', mensagem.tipo === 'erro' ? 'text-red-600' : 'text-green-600')}
              role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            >
              {mensagem.texto}
            </p>
          )}
        </div>
      </div>

      {editorAberto && (
        <EditorFoto
          url={editorAberto}
          focoInicialX={focoX}
          focoInicialY={focoY}
          zoomInicial={zoom}
          onCancelar={() => setEditorAberto(null)}
          onSalvo={salvarEnquadramento}
        />
      )}
    </fieldset>
  )
}

function CampoInput({ label, chave, valor, onChange, required, type = 'text', placeholder }: { 
  label: string; 
  chave: string; 
  valor: string; 
  onChange: (k: string, v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="form-group">
      <label htmlFor={chave} className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <input
        type={type}
        id={chave}
        value={valor || ''}
        onChange={e => onChange(chave, e.target.value)}
        className="input"
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

function CampoNumber({ label, chave, valor, onChange, min, max }: { 
  label: string; 
  chave: string; 
  valor: number; 
  onChange: (k: string, v: string) => void;
  min: number; 
  max: number;
}) {
  return (
    <div className="form-group">
      <label htmlFor={chave} className="label">{label}</label>
      <input
        type="number"
        id={chave}
        value={valor}
        onChange={e => onChange(chave, e.target.value)}
        className="input"
        min={min}
        max={max}
      />
    </div>
  )
}