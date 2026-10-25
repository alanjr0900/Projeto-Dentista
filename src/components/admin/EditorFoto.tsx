'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FotoDentista,
  estilosFoco,
  normalizarFoco,
  type FocoFoto,
} from '@/components/FotoDentista'
import { cn } from '@/lib/utils'
import {
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
  focoAposArraste,
  type ConteudoFoto,
} from '@/lib/enquadramento-editor'

/**
 * Editor de enquadramento da foto da dentista.
 *
 * - A moldura tem exatamente a proporção usada no topo da página pública (4:5).
 * - A imagem é renderizada com AS MESMAS regras das prévias (estilosFoco:
 *   object-fit cover + object-position no ponto de foco + scale ao redor
 *   dele) — o editor mostra exatamente o mesmo recorte que o site.
 * - Arrastar move a foto; o controle deslizante dá zoom; no celular a pinça
 *   funciona com dois dedos e no computador a roda do mouse.
 * - "Centralizar no rosto" tenta detectar o rosto (FaceDetector do navegador,
 *   quando disponível) e cai para um enquadramento inteligente (terço
 *   superior) quando não há suporte — sempre ajustável à mão.
 * - Salva PONTO DE FOCO + ZOOM (não recorta o arquivo): mantém a qualidade
 *   original e o rosto ancorado em qualquer tamanho de tela.
 *
 * Nada é calculado antes da imagem carregar: o `load` dispara a medição da
 * moldura e da imagem, e o arraste atualiza o foco em porcentagem (limitado
 * para a moldura nunca ficar vazia).
 */

interface EditorFotoProps {
  url: string
  focoInicialX?: number | string | null
  focoInicialY?: number | string | null
  zoomInicial?: number | string | null
  onCancelar: () => void
  onSalvo: (foco: FocoFoto) => void
}

type Dimensoes = {
  W: number // largura da moldura (px)
  H: number // altura da moldura (px)
}

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const arredondar = (n: number, casas = 2) => Number(n.toFixed(casas))

function carregarImagem(url: string, comCors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (comCors) {
      try {
        const absoluto = new URL(url, window.location.href)
        if (absoluto.origin !== window.location.origin) img.crossOrigin = 'anonymous'
      } catch {
        // URL relativa inválida: segue sem CORS
      }
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = url
  })
}

/** Detecção de rosto quando o navegador oferece FaceDetector (Chromium) */
async function detectarRosto(
  url: string
): Promise<{ cx: number; cy: number; alturaRelativa: number } | null> {
  const Construtor = (window as unknown as { FaceDetector?: new (o: unknown) => {
    detect: (i: HTMLImageElement) => Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>>
  } }).FaceDetector

  if (!Construtor) return null

  try {
    const img = await carregarImagem(url, true)
    const deteccoes = await new Construtor({ maxDetectedFaces: 1, fastMode: true }).detect(img)
    const caixa = deteccoes?.[0]?.boundingBox
    if (!caixa || !caixa.width || !img.naturalWidth || !img.naturalHeight) return null
    return {
      cx: (caixa.x + caixa.width / 2) / img.naturalWidth,
      cy: (caixa.y + caixa.height / 2) / img.naturalHeight,
      alturaRelativa: caixa.height / img.naturalHeight,
    }
  } catch {
    return null
  }
}

type Cursor = { x: number; y: number }

type EstadoGesto = {
  arrastando: boolean
  pinca: boolean
  x0: number
  y0: number
  fx0: number
  fy0: number
  zoom0: number
  dist0: number
}

function distanciaEntrePonteiros(ponteiros: Map<number, Cursor>): number {
  if (ponteiros.size < 2) return 0
  const [a, b] = Array.from(ponteiros.values())
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function EditorFoto({
  url,
  focoInicialX,
  focoInicialY,
  zoomInicial,
  onCancelar,
  onSalvo,
}: EditorFotoProps) {
  const molduraRef = useRef<HTMLDivElement>(null)
  const dimensoesImagemRef = useRef<{ iw: number; ih: number } | null>(null)
  const ponteirosAtivos = useRef(new Map<number, Cursor>())
  const gestoRef = useRef<EstadoGesto>({
    arrastando: false,
    pinca: false,
    x0: 0,
    y0: 0,
    fx0: 50,
    fy0: 35,
    zoom0: 1,
    dist0: 0,
  })

  const [pronto, setPronto] = useState(false)
  const [dims, setDims] = useState<Dimensoes | null>(null)
  const [foco, setFoco] = useState<FocoFoto>(() =>
    normalizarFoco(focoInicialX, focoInicialY, zoomInicial)
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [autoStatus, setAutoStatus] = useState<'ocioso' | 'detectando'>('ocioso')
  const [avisoAuto, setAvisoAuto] = useState<string | null>(null)

  // Mede a moldura e a imagem APÓS o evento load da imagem. Nada é
  // calculado/deslocado antes disso: os estilos do recorte ficam todos em
  // porcentagem, então o recorte correto aparece desde o primeiro frame.
  useEffect(() => {
    let cancelado = false

    const iniciar = async () => {
      setPronto(false)
      setErro(null)
      try {
        const img = await carregarImagem(url)
        if (cancelado) return

        // Espera o layout da moldura (alguns frames, se necessário)
        let rect: DOMRect | null = null
        for (let tentativa = 0; tentativa < 10; tentativa++) {
          rect = molduraRef.current?.getBoundingClientRect() ?? null
          if (rect && rect.width > 0 && rect.height > 0) break
          await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
        }
        if (cancelado) return
        if (!rect || rect.width === 0) {
          setErro('Não foi possível medir a área do editor. Feche e tente novamente.')
          return
        }

        dimensoesImagemRef.current = { iw: img.naturalWidth, ih: img.naturalHeight }
        setDims({ W: rect.width, H: rect.height })
        setFoco(normalizarFoco(focoInicialX, focoInicialY, zoomInicial))
        setPronto(true)
      } catch {
        if (!cancelado) {
          setErro('Não foi possível carregar a imagem. Verifique se a URL aponta para uma imagem JPG, PNG ou WebP.')
        }
      }
    }

    iniciar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // A moldura segue o tamanho da janela (girar o celular, redimensionar a
  // janela): as medidas são atualizadas e o arraste continua preciso.
  useEffect(() => {
    const el = molduraRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observar = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setDims({ W: rect.width, H: rect.height })
    }
    const obs = new ResizeObserver(observar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Fecha com Esc
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onCancelar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancelar, salvando])

  // Zoom pela roda do mouse (precisa de listener não passivo)
  useEffect(() => {
    if (!pronto) return
    const el = molduraRef.current
    if (!el) return

    const aoRodar = (e: WheelEvent) => {
      if (!e.deltaY) return
      e.preventDefault()
      const fator = Math.exp(-e.deltaY * 0.002)
      setFoco(f => ({ ...f, zoom: limitar(f.zoom * fator, ZOOM_MINIMO, ZOOM_MAXIMO) }))
    }
    el.addEventListener('wheel', aoRodar, { passive: false })
    return () => el.removeEventListener('wheel', aoRodar)
  }, [pronto])

  const conteudoAtual = (): ConteudoFoto | null => {
    if (!dims || !dimensoesImagemRef.current) return null
    return { ...dims, iw: dimensoesImagemRef.current.iw, ih: dimensoesImagemRef.current.ih }
  }

  // Arraste com mouse ou dedo (pointer events cobrem os dois)
  const aoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pronto) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sem suporte à captura: o rastreio pelo move/up continua funcionando
    }
    ponteirosAtivos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const gesto = gestoRef.current
    if (ponteirosAtivos.current.size === 2) {
      // Segundo dedo: o arraste vira pinça (zoom) ancorada no gesto atual
      gesto.arrastando = false
      gesto.pinca = true
      gesto.zoom0 = foco.zoom
      gesto.dist0 = distanciaEntrePonteiros(ponteirosAtivos.current)
    } else if (ponteirosAtivos.current.size === 1) {
      gesto.arrastando = true
      gesto.pinca = false
      gesto.x0 = e.clientX
      gesto.y0 = e.clientY
      gesto.fx0 = foco.focoX
      gesto.fy0 = foco.focoY
      gesto.zoom0 = foco.zoom
      gesto.dist0 = 0
    }
  }

  const aoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ponteirosAtivos.current.has(e.pointerId)) return
    ponteirosAtivos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const conteudo = conteudoAtual()
    if (!conteudo) return
    const gesto = gestoRef.current

    if (gesto.pinca) {
      if (ponteirosAtivos.current.size >= 2 && gesto.dist0 > 0) {
        const d = distanciaEntrePonteiros(ponteirosAtivos.current)
        setFoco(f => ({
          ...f,
          zoom: limitar((gesto.zoom0 * d) / gesto.dist0, ZOOM_MINIMO, ZOOM_MAXIMO),
        }))
      }
      return
    }

    if (!gesto.arrastando) return
    const dx = e.clientX - gesto.x0
    const dy = e.clientY - gesto.y0
    setFoco(f => focoAposArraste({ ...f, focoX: gesto.fx0, focoY: gesto.fy0 }, dx, dy, conteudo))
  }

  const aoPointerLiberar = (e: React.PointerEvent<HTMLDivElement>) => {
    ponteirosAtivos.current.delete(e.pointerId)

    const gesto = gestoRef.current
    if (ponteirosAtivos.current.size === 1) {
      // Saiu da pinça e restou um dedo: reancora o arraste nesse toque
      const [, ponto] = Array.from(ponteirosAtivos.current.entries())[0]
      gesto.pinca = false
      gesto.arrastando = true
      gesto.x0 = ponto.x
      gesto.y0 = ponto.y
      gesto.fx0 = foco.focoX
      gesto.fy0 = foco.focoY
      gesto.zoom0 = foco.zoom
    } else if (ponteirosAtivos.current.size === 0) {
      gesto.arrastando = false
      gesto.pinca = false
    }
  }

  const centralizarNoRosto = useCallback(async () => {
    const conteudo = conteudoAtual()
    if (!conteudo) return
    setAutoStatus('detectando')
    setAvisoAuto(null)

    const rosto = await detectarRosto(url)
    let alvo: FocoFoto

    if (rosto) {
      const { W, H, iw, ih } = conteudo
      const esc = Math.max(W / iw, H / ih)
      // Zoom para o rosto ocupar ~30% da altura da moldura
      const zoomIdeal = limitar(
        (0.3 * H) / (Math.max(rosto.alturaRelativa, 0.05) * ih * esc),
        ZOOM_MINIMO,
        ZOOM_MAXIMO
      )
      alvo = {
        focoX: limitar(rosto.cx * 100, 0, 100),
        focoY: limitar(rosto.cy * 100, 0, 100),
        zoom: zoomIdeal,
      }
      setAvisoAuto('Rosto detectado e centralizado. Arraste para ajustar se quiser.')
    } else {
      // Sem detecção no navegador: enquadramento típico de retrato (terço superior)
      alvo = { focoX: 50, focoY: 38, zoom: 1.15 }
      setAvisoAuto('Ajuste automático aplicado. Arraste a foto para posicionar o rosto com precisão.')
    }

    setFoco(alvo)
    setAutoStatus('ocioso')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, url])

  const redefinir = useCallback(() => {
    setFoco({ focoX: 50, focoY: 35, zoom: ZOOM_MINIMO })
    setAvisoAuto(null)
  }, [])

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const valores = {
        focoX: arredondar(foco.focoX, 2),
        focoY: arredondar(foco.focoY, 2),
        zoom: arredondar(foco.zoom, 2),
      }
      const res = await fetch('/api/admin/foto/enquadramento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erro || 'Não foi possível salvar o enquadramento')
      }
      onSalvo(valores)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o enquadramento')
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editor-foto"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h3 id="titulo-editor-foto" className="font-heading text-lg font-semibold text-neutral-900">
              Ajustar enquadramento da foto
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Arraste a foto para posicionar o rosto, use o zoom (ou a pinça no celular) e escolha o ponto de foco.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Fechar editor"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Corpo */}
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Área de edição — mesma moldura 4:5 do site */}
          <div className="min-w-0">
            <div className="mx-auto w-full max-w-[340px]">
              <div
                className="rounded-3xl border-8 border-white bg-neutral-900 shadow-soft ring-1 ring-neutral-200"
                style={{ padding: 0 }}
              >
                <div
                  ref={molduraRef}
                  role="img"
                  aria-label="Editor de enquadramento — arraste para ajustar o recorte da foto"
                  onPointerDown={aoPointerDown}
                  onPointerMove={aoPointerMove}
                  onPointerUp={aoPointerLiberar}
                  onPointerCancel={aoPointerLiberar}
                  onDragStart={e => e.preventDefault()}
                  className={cn(
                    'relative aspect-[4/5] w-full overflow-hidden rounded-2xl',
                    'touch-none select-none',
                    pronto ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  )}
                >
                  {!erro && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt="Foto em edição"
                      draggable={false}
                      className="absolute inset-0 h-full w-full"
                      style={estilosFoco(foco)}
                    />
                  )}
                  {!pronto && !erro && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-neutral-900/70 text-sm text-neutral-300"
                      role="status"
                    >
                      Carregando imagem…
                    </div>
                  )}
                  {erro && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-4 text-center text-sm text-neutral-300"
                      role="alert"
                    >
                      {erro}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-neutral-500">
                Moldura exatamente igual à do topo da página pública (4:5, cantos arredondados e borda branca).
              </p>
            </div>

            {/* Zoom */}
            <div className="mx-auto mt-4 w-full max-w-[340px]">
              <label htmlFor="zoom-foto" className="flex items-center justify-between text-sm font-medium text-neutral-800">
                Zoom
                <span className="text-neutral-500">{Math.round(foco.zoom * 100)}%</span>
              </label>
              <input
                id="zoom-foto"
                type="range"
                min={ZOOM_MINIMO}
                max={ZOOM_MAXIMO}
                step={0.01}
                value={foco.zoom}
                disabled={!pronto}
                onChange={e =>
                  setFoco(f => ({ ...f, zoom: limitar(Number(e.target.value), ZOOM_MINIMO, ZOOM_MAXIMO) }))
                }
                className="mt-2 w-full accent-primary-600"
              />
            </div>

            <div className="mx-auto mt-4 flex w-full max-w-[340px] flex-wrap gap-2">
              <button
                type="button"
                onClick={centralizarNoRosto}
                disabled={!pronto || autoStatus === 'detectando'}
                className="btn btn-primary btn-sm flex-1"
              >
                {autoStatus === 'detectando' ? 'Detectando…' : 'Centralizar no rosto'}
              </button>
              <button
                type="button"
                onClick={redefinir}
                disabled={!pronto}
                className="btn btn-secondary btn-sm flex-1"
              >
                Redefinir
              </button>
            </div>
            {avisoAuto && (
              <p className="mx-auto mt-2 w-full max-w-[340px] text-center text-xs text-primary-700" role="status">
                {avisoAuto}
              </p>
            )}
            {erro && (
              <p className="mx-auto mt-3 w-full max-w-[340px] rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                {erro}
              </p>
            )}
          </div>

          {/* Pré-visualizações em tempo real */}
          <aside className="space-y-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Prévia em tempo real
            </h4>

            <div className="flex items-start gap-4">
              <div className="w-[132px] shrink-0">
                <FotoDentista
                  src={url}
                  alt="Prévia no topo do site, no computador"
                  focoX={foco.focoX}
                  focoY={foco.focoY}
                  zoom={foco.zoom}
                  className="border-4 shadow-sm"
                />
              </div>
              <div className="pt-1 text-xs leading-relaxed text-neutral-600">
                <strong className="block text-neutral-800">Topo do site · computador</strong>
                Moldura vertical 4:5 com cantos arredondados e borda branca, ao lado do texto de boas-vindas.
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-[88px] shrink-0">
                <FotoDentista
                  src={url}
                  alt="Prévia no topo do site, no celular"
                  focoX={foco.focoX}
                  focoY={foco.focoY}
                  zoom={foco.zoom}
                  className="border-4 shadow-sm"
                />
              </div>
              <div className="pt-1 text-xs leading-relaxed text-neutral-600">
                <strong className="block text-neutral-800">Topo do site · celular</strong>
                A mesma moldura em tela pequena — o rosto permanece ancorado.
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-[76px] shrink-0">
                <FotoDentista
                  src={url}
                  alt="Prévia em formato de perfil"
                  focoX={foco.focoX}
                  focoY={foco.focoY}
                  zoom={foco.zoom}
                  quadrada
                  className="border-4 shadow-sm"
                />
              </div>
              <div className="pt-1 text-xs leading-relaxed text-neutral-600">
                <strong className="block text-neutral-800">Formato de perfil</strong>
                Círculo — confirma que o rosto fica bem enquadrado também em avatares.
              </div>
            </div>

            <div
              className={cn(
                'rounded-xl border p-3 text-xs leading-relaxed',
                'border-primary-100 bg-primary-50 text-primary-800'
              )}
            >
              O enquadramento é salvo como <strong>ponto de foco + zoom</strong>. A imagem original
              é preservada e o rosto fica bem posicionado em qualquer tamanho de tela.
            </div>
          </aside>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4">
          <button type="button" onClick={onCancelar} disabled={salvando} className="btn btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!pronto || salvando}
            className="btn btn-primary"
          >
            {salvando ? 'Salvando…' : 'Salvar enquadramento'}
          </button>
        </div>
      </div>
    </div>
  )
}
