'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn, formatarDataBR, formatarHoraBR } from '@/lib/utils'

type Prazos = {
  podeRemarcar: boolean
  motivoRemarcacao?: string
  podeCancelar: boolean
  motivoCancelamento?: string
  prazoHoras: number
  prazoCancelamentoHoras: number
}

type Agendamento = {
  id: string
  codigo: string
  dataHora: string
  duracaoMin: number
  status: string
  servico: { nome: string }
  prazos: Prazos
}

type Paciente = {
  id: string
  nome: string
  email: string
  telefone: string
  agendamentos: Agendamento[]
}

type Diagnostico = {
  id: string
  texto: string
  criadoEm: string
}

type DiaHorarios = {
  data: string
  diaSemana: number
  slots: { horario: string; dataHoraISO: string }[]
}

type Mensagem = { tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente de confirmação',
  CONFIRMADO: 'Confirmada',
  REMARCADO: 'Remarcada',
  CANCELADO: 'Cancelada',
  CONCLUIDO: 'Realizada',
  FALTA: 'Falta',
}

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: 'badge-warning',
  CONFIRMADO: 'badge-primary',
  REMARCADO: 'badge-accent',
}

const INTERVALO_REENVIO = 60
const MENSAGEM_NEUTRA =
  'Se este e-mail estiver cadastrado, enviamos um código de acesso.'

export function MinhaConsulta({ whatsappLink }: { whatsappLink: string }) {
  const [carregandoInicial, setCarregandoInicial] = useState(true)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [sessaoMinutos, setSessaoMinutos] = useState(30)

  // Login por código
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [passo, setPasso] = useState<'email' | 'codigo'>('email')
  const [enviando, setEnviando] = useState(false)
  const [validando, setValidando] = useState(false)
  const [erroLogin, setErroLogin] = useState<string | null>(null)
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null)
  const [segundosReenvio, setSegundosReenvio] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Painel do paciente
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<Mensagem>(null)

  // Diagnósticos
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[] | null>(null)
  const [carregandoDiagnosticos, setCarregandoDiagnosticos] = useState(false)

  // Remarcação
  const [remarcando, setRemarcando] = useState(false)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [dias, setDias] = useState<DiaHorarios[]>([])
  const [erroRemarcar, setErroRemarcar] = useState<string | null>(null)
  const [slotEscolhido, setSlotEscolhido] = useState<{ data: string; horario: string } | null>(null)
  const [salvandoRemarcacao, setSalvandoRemarcacao] = useState(false)

  // Cancelamento
  const [cancelando, setCancelando] = useState(false)

  const agendamentoAtivo =
    paciente?.agendamentos.find(item => item.id === agendamentoId) ??
    paciente?.agendamentos[0] ??
    null

  const tratarSessaoExpirada = useCallback(() => {
    setPaciente(null)
    setPasso('email')
    setCodigo('')
    setAvisoLogin(null)
    setMensagem(null)
    setDiagnosticos(null)
    setRemarcando(false)
    setErroLogin('Sua sessão expirou. Entre novamente com um novo código.')
  }, [])

  const carregarSessao = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    try {
      const resposta = await fetch('/api/paciente/email/sessao', { cache: 'no-store' })
      if (resposta.status === 401) {
        setPaciente(null)
        if (opcoes?.silencioso) {
          setErroLogin('Sua sessão expirou por inatividade. Entre novamente.')
        }
        return false
      }
      if (!resposta.ok) return false

      const dados = await resposta.json()
      // `agendamentos` vem embutido no paciente; garante array mesmo se a
      // resposta vier com o campo em outra posição.
      setPaciente({
        ...dados.paciente,
        agendamentos: Array.isArray(dados.paciente?.agendamentos) ? dados.paciente.agendamentos : [],
      })
      if (typeof dados.sessaoMinutos === 'number') setSessaoMinutos(dados.sessaoMinutos)
      return true
    } catch {
      return false
    } finally {
      setCarregandoInicial(false)
    }
  }, [])

  useEffect(() => {
    void carregarSessao()
  }, [carregarSessao])

  // Mantém a consulta selecionada válida quando a lista muda.
  useEffect(() => {
    if (!paciente) return
    if (!agendamentoId || !paciente.agendamentos.some(item => item.id === agendamentoId)) {
      setAgendamentoId(paciente.agendamentos[0]?.id ?? null)
    }
  }, [paciente, agendamentoId])

  // Ao trocar de consulta, fecha painéis que pertencem à anterior.
  useEffect(() => {
    setDiagnosticos(null)
    setRemarcando(false)
    setDias([])
    setErroRemarcar(null)
    setSlotEscolhido(null)
  }, [agendamentoId])

  // Renova a sessão enquanto o painel estiver aberto (janela de 30 min).
  useEffect(() => {
    if (!paciente) return
    const intervaloMs = Math.max(60_000, Math.floor((sessaoMinutos * 60_000) / 3))
    const intervalo = setInterval(() => {
      void carregarSessao({ silencioso: true })
    }, intervaloMs)
    return () => clearInterval(intervalo)
  }, [paciente, sessaoMinutos, carregarSessao])

  // Contagem regressiva do botão "Reenviar código".
  useEffect(() => {
    if (segundosReenvio <= 0) return
    timerRef.current = setTimeout(() => {
      setSegundosReenvio(valor => Math.max(0, valor - 1))
    }, 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [segundosReenvio])

  const pedirCodigo = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (enviando) return

    setEnviando(true)
    setErroLogin(null)
    setAvisoLogin(null)

    try {
      const resposta = await fetch('/api/paciente/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const dados = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        setErroLogin(dados.erro || 'Informe um e-mail válido.')
        return
      }

      setPasso('codigo')
      setCodigo('')
      setAvisoLogin(dados.mensagem || MENSAGEM_NEUTRA)
      setSegundosReenvio(
        typeof dados.reenviarEm === 'number' ? dados.reenviarEm : INTERVALO_REENVIO
      )
    } catch {
      setErroLogin('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const validarCodigo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (validando) return

    setValidando(true)
    setErroLogin(null)

    try {
      const resposta = await fetch('/api/paciente/email/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo }),
      })
      const dados = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        setErroLogin(dados.erro || 'Código inválido ou expirado.')
        return
      }

      const abriu = await carregarSessao()
      if (!abriu) {
        setErroLogin('Não foi possível abrir sua sessão. Tente novamente.')
        return
      }

      setPasso('email')
      setCodigo('')
      setAvisoLogin(null)
      setSegundosReenvio(0)
      setMensagem({ tipo: 'sucesso', texto: 'Acesso liberado. Que bom ter você por aqui!' })
    } catch {
      setErroLogin('Não foi possível validar o código. Tente novamente.')
    } finally {
      setValidando(false)
    }
  }

  const sair = async () => {
    try {
      await fetch('/api/paciente/email/logout', { method: 'POST' })
    } catch {
      // Mesmo se a rede falhar, limpamos a tela local.
    }
    setPaciente(null)
    setPasso('email')
    setCodigo('')
    setErroLogin(null)
    setAvisoLogin(null)
    setSegundosReenvio(0)
    setMensagem(null)
    setDiagnosticos(null)
    setRemarcando(false)
    setAgendamentoId(null)
  }

  const carregarDiagnosticos = async () => {
    if (!agendamentoAtivo || carregandoDiagnosticos) return

    setCarregandoDiagnosticos(true)
    setMensagem(null)

    try {
      const resposta = await fetch('/api/paciente/email/diagnosticos', { cache: 'no-store' })
      if (resposta.status === 401) {
        tratarSessaoExpirada()
        return
      }
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setMensagem({
          tipo: 'erro',
          texto: dados.erro || 'Não foi possível carregar seus diagnósticos.',
        })
        return
      }
      setDiagnosticos(Array.isArray(dados.diagnosticos) ? dados.diagnosticos : [])
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar seus diagnósticos.' })
    } finally {
      setCarregandoDiagnosticos(false)
    }
  }

  const abrirRemarcacao = async () => {
    if (!agendamentoAtivo) return

    setRemarcando(true)
    setErroRemarcar(null)
    setSlotEscolhido(null)
    setDias([])
    setCarregandoHorarios(true)

    try {
      const resposta = await fetch(
        `/api/paciente/email/horarios?agendamentoId=${encodeURIComponent(agendamentoAtivo.id)}`,
        { cache: 'no-store' }
      )
      if (resposta.status === 401) {
        tratarSessaoExpirada()
        return
      }
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setErroRemarcar(dados.erro || 'Não foi possível carregar os horários livres.')
        return
      }
      setDias(Array.isArray(dados.dias) ? dados.dias : [])
    } catch {
      setErroRemarcar('Não foi possível carregar os horários livres.')
    } finally {
      setCarregandoHorarios(false)
    }
  }

  const confirmarRemarcacao = async () => {
    if (!agendamentoAtivo || !slotEscolhido || salvandoRemarcacao) return

    setSalvandoRemarcacao(true)
    setErroRemarcar(null)

    try {
      const resposta = await fetch('/api/paciente/email/remarcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendamentoId: agendamentoAtivo.id,
          data: slotEscolhido.data,
          horario: slotEscolhido.horario,
        }),
      })
      if (resposta.status === 401) {
        tratarSessaoExpirada()
        return
      }
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setErroRemarcar(dados.erro || 'Não foi possível remarcar agora.')
        return
      }

      setRemarcando(false)
      setDias([])
      setSlotEscolhido(null)
      setMensagem({
        tipo: 'sucesso',
        texto: dados.mensagem || 'Consulta remarcada com sucesso.',
      })
      await carregarSessao({ silencioso: true })
    } catch {
      setErroRemarcar('Não foi possível remarcar agora. Tente novamente.')
    } finally {
      setSalvandoRemarcacao(false)
    }
  }

  const cancelarConsulta = async () => {
    if (!agendamentoAtivo || cancelando) return
    if (!window.confirm('Deseja cancelar esta consulta? Essa ação não pode ser desfeita.')) {
      return
    }

    setCancelando(true)
    setMensagem(null)

    try {
      const resposta = await fetch('/api/paciente/email/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: agendamentoAtivo.id }),
      })
      if (resposta.status === 401) {
        tratarSessaoExpirada()
        return
      }
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setMensagem({ tipo: 'erro', texto: dados.erro || 'Não foi possível cancelar agora.' })
        return
      }

      setMensagem({
        tipo: 'sucesso',
        texto: dados.mensagem || 'Consulta cancelada. Se precisar, agende um novo horário.',
      })
      setDiagnosticos(null)
      setRemarcando(false)
      await carregarSessao({ silencioso: true })
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível cancelar agora. Tente novamente.' })
    } finally {
      setCancelando(false)
    }
  }

  if (carregandoInicial) {
    return <div className="py-12 text-center text-neutral-500">Carregando...</div>
  }

  if (!paciente) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card-padded space-y-6">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-neutral-900">
              Acesse sua consulta
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {passo === 'email'
                ? 'Informe o e-mail cadastrado para receber um código de acesso.'
                : `Digite o código de 6 dígitos enviado para ${email}.`}
            </p>
          </div>

          {erroLogin && (
            <div
              role="alert"
              className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
            >
              {erroLogin}
            </div>
          )}

          {avisoLogin && (
            <div
              role="status"
              className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700"
            >
              {avisoLogin}
            </div>
          )}

          {passo === 'email' ? (
            <form onSubmit={pedirCodigo} className="space-y-4">
              <div className="form-group">
                <label htmlFor="email" className="label">
                  E-mail
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="input"
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={enviando} className="btn btn-primary w-full">
                {enviando ? 'Enviando...' : 'Receber código por e-mail'}
              </button>
            </form>
          ) : (
            <form onSubmit={validarCodigo} className="space-y-4">
              <div className="form-group">
                <label htmlFor="otp" className="label">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  id="otp"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={event => setCodigo(event.target.value.replace(/\D/g, ''))}
                  className="input text-center font-mono text-2xl tracking-[0.5em]"
                  placeholder="000000"
                  autoFocus
                />
                <p className="mt-2 text-xs text-neutral-500">
                  O código vale por 10 minutos e só pode ser usado uma vez.
                </p>
              </div>
              <button
                type="submit"
                disabled={validando || codigo.length < 6}
                className="btn btn-primary w-full"
              >
                {validando ? 'Validando...' : 'Entrar'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => pedirCodigo()}
                  disabled={segundosReenvio > 0 || enviando}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-neutral-400"
                >
                  {segundosReenvio > 0
                    ? `Reenviar código em ${segundosReenvio}s`
                    : 'Não recebi o código'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasso('email')
                    setCodigo('')
                    setErroLogin(null)
                    setAvisoLogin(null)
                  }}
                  className="mt-2 block w-full text-xs text-neutral-500 hover:text-neutral-700"
                >
                  Trocar e-mail
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-[11px] leading-relaxed text-neutral-400">
            Usamos seu e-mail apenas para confirmar sua identidade e liberar os dados
            da sua consulta. Não enviamos propaganda.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-white p-6 shadow-soft sm:flex-row">
        <div>
          <h2 className="font-heading text-xl font-bold text-neutral-900">
            Olá, {paciente.nome.split(' ')[0]}!
          </h2>
          <p className="text-sm text-neutral-500">{paciente.email}</p>
          <p className="mt-1 text-[11px] text-neutral-400">
            Por segurança, sua sessão expira após {sessaoMinutos} minutos sem uso.
          </p>
        </div>
        <button
          onClick={sair}
          className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
        >
          Sair
        </button>
      </div>

      {mensagem && (
        <div
          role="status"
          className={cn('rounded-xl border p-4 text-sm', {
            'border-green-100 bg-green-50 text-green-700': mensagem.tipo === 'sucesso',
            'border-red-100 bg-red-50 text-red-700': mensagem.tipo === 'erro',
            'border-blue-100 bg-blue-50 text-blue-700': mensagem.tipo === 'info',
          })}
        >
          {mensagem.texto}
        </div>
      )}

      {paciente.agendamentos.length === 0 ? (
        <div className="card-padded py-12 text-center">
          <p className="text-neutral-500">
            Você não possui consultas ativas no momento.
          </p>
          <a href="/agendar" className="btn btn-primary mt-4">
            Agendar consulta
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <aside className="space-y-3">
            <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              Suas consultas
            </h3>
            {paciente.agendamentos.map(agendamento => (
              <button
                key={agendamento.id}
                onClick={() => setAgendamentoId(agendamento.id)}
                className={cn(
                  'w-full rounded-xl border p-4 text-left transition-all',
                  agendamentoAtivo?.id === agendamento.id
                    ? 'border-primary-200 bg-primary-50 shadow-soft'
                    : 'border-neutral-100 bg-white hover:border-neutral-200'
                )}
              >
                <p className="mb-1 text-xs text-neutral-400">Código {agendamento.codigo}</p>
                <p className="font-semibold leading-tight text-neutral-900">
                  {agendamento.servico.nome}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {formatarDataBR(agendamento.dataHora)}
                </p>
                <p className="text-sm text-neutral-500">
                  às {formatarHoraBR(agendamento.dataHora)}
                </p>
              </button>
            ))}
          </aside>

          <main className="space-y-6 md:col-span-2">
            {agendamentoAtivo && (
              <>
                <div className="card-padded space-y-5">
                  <div>
                    <span
                      className={cn(
                        'badge mb-2',
                        STATUS_CLASS[agendamentoAtivo.status] || 'badge'
                      )}
                    >
                      {STATUS_LABEL[agendamentoAtivo.status] || agendamentoAtivo.status}
                    </span>
                    <h3 className="font-heading text-2xl font-bold text-neutral-900">
                      {agendamentoAtivo.servico.nome}
                    </h3>
                    <p className="text-neutral-600">
                      {formatarDataBR(agendamentoAtivo.dataHora)} às{' '}
                      {formatarHoraBR(agendamentoAtivo.dataHora)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Código da consulta: {agendamentoAtivo.codigo}
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                    <p className="mb-2 text-xs font-bold uppercase text-neutral-400">
                      Antes da consulta
                    </p>
                    <ul className="space-y-1 text-sm text-neutral-700">
                      <li>• Chegue com 10 minutos de antecedência.</li>
                      <li>• Traga exames anteriores, se tiver.</li>
                    </ul>
                  </div>
                </div>

                <div className="card-padded space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-heading text-lg font-bold text-neutral-900">
                        Meus diagnósticos
                      </h4>
                      <p className="text-xs text-neutral-500">
                        Somente as anotações que a dentista liberou para você.
                      </p>
                    </div>
                    {diagnosticos === null && (
                      <button
                        onClick={carregarDiagnosticos}
                        disabled={carregandoDiagnosticos}
                        className="btn btn-outline btn-sm"
                      >
                        {carregandoDiagnosticos ? 'Carregando...' : 'Ver diagnósticos'}
                      </button>
                    )}
                  </div>

                  {diagnosticos !== null && (
                    <div className="space-y-3">
                      {diagnosticos.length === 0 ? (
                        <p className="text-sm italic text-neutral-500">
                          Nenhum diagnóstico liberado por enquanto.
                        </p>
                      ) : (
                        diagnosticos.map(item => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-neutral-100 bg-neutral-50 p-4"
                          >
                            <p className="whitespace-pre-wrap text-sm text-neutral-700">
                              {item.texto}
                            </p>
                            <p className="mt-2 text-[11px] text-neutral-400">
                              Liberado em {formatarDataBR(item.criadoEm)}
                            </p>
                          </div>
                        ))
                      )}
                      <button
                        onClick={() => setDiagnosticos(null)}
                        className="text-xs text-neutral-500 hover:text-neutral-700"
                      >
                        Ocultar diagnósticos
                      </button>
                    </div>
                  )}
                </div>

                <div className="card-padded space-y-4">
                  <h4 className="font-heading text-lg font-bold text-neutral-900">
                    Precisa alterar?
                  </h4>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {agendamentoAtivo.prazos.podeRemarcar ? (
                      <button
                        onClick={abrirRemarcacao}
                        disabled={remarcando}
                        className="btn btn-outline btn-sm flex-1"
                      >
                        {remarcando ? 'Escolha um horário abaixo' : 'Remarcar consulta'}
                      </button>
                    ) : (
                      <p className="flex-1 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                        {agendamentoAtivo.prazos.motivoRemarcacao ||
                          'Remarcação não disponível pelo site.'}
                      </p>
                    )}

                    {agendamentoAtivo.prazos.podeCancelar ? (
                      <button
                        onClick={cancelarConsulta}
                        disabled={cancelando}
                        className="btn btn-ghost btn-sm flex-1 text-red-600 hover:bg-red-50"
                      >
                        {cancelando ? 'Cancelando...' : 'Cancelar consulta'}
                      </button>
                    ) : (
                      <p className="flex-1 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                        {agendamentoAtivo.prazos.motivoCancelamento ||
                          'Cancelamento não disponível pelo site.'}
                      </p>
                    )}
                  </div>

                  {remarcando && (
                    <div className="space-y-4 rounded-xl border border-primary-100 bg-primary-50/50 p-4">
                      {carregandoHorarios && (
                        <p className="text-sm text-neutral-600">Carregando horários livres...</p>
                      )}

                      {erroRemarcar && (
                        <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                          {erroRemarcar}
                        </p>
                      )}

                      {!carregandoHorarios && !erroRemarcar && dias.length === 0 && (
                        <p className="text-sm text-neutral-600">
                          Nenhum horário livre no momento. Fale com a clínica pelo WhatsApp.
                        </p>
                      )}

                      {!carregandoHorarios &&
                        dias.slice(0, 14).map(dia => (
                          <div key={dia.data}>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                              {formatarDataBR(dia.data)}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {dia.slots.map(slot => {
                                const escolhido =
                                  slotEscolhido?.data === dia.data &&
                                  slotEscolhido?.horario === slot.horario
                                return (
                                  <button
                                    key={`${dia.data}-${slot.horario}`}
                                    type="button"
                                    onClick={() =>
                                      setSlotEscolhido({ data: dia.data, horario: slot.horario })
                                    }
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-sm transition-colors',
                                      escolhido
                                        ? 'border-primary-500 bg-primary-600 text-white'
                                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-300'
                                    )}
                                  >
                                    {slot.horario}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}

                      {!carregandoHorarios && dias.length > 0 && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={confirmarRemarcacao}
                            disabled={!slotEscolhido || salvandoRemarcacao}
                            className="btn btn-primary btn-sm flex-1"
                          >
                            {salvandoRemarcacao ? 'Salvando...' : 'Confirmar novo horário'}
                          </button>
                          <button
                            onClick={() => {
                              setRemarcando(false)
                              setDias([])
                              setSlotEscolhido(null)
                              setErroRemarcar(null)
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            Voltar
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-neutral-400">
                    Alterações com menos de {agendamentoAtivo.prazos.prazoHoras} horas de
                    antecedência devem ser feitas pelo WhatsApp.
                  </p>
                </div>
              </>
            )}

            <div className="rounded-2xl border border-neutral-100 bg-white p-5 text-center shadow-soft">
              <p className="text-sm text-neutral-600">
                Precisa de ajuda com sua consulta?
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm mt-3"
              >
                Falar pelo WhatsApp
              </a>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
