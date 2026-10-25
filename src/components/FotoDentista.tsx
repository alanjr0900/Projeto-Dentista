import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Foto da dentista com enquadramento responsivo.
 *
 * O painel guarda o PONTO DE FOCO (x/y em % da imagem) e o ZOOM.
 * A renderização usa as mesmas regras da prévia do editor:
 *   - object-position: focoX% focoY%  → o ponto focal fica ancorado na mesma
 *     posição relativa em QUALQUER tamanho de moldura/tela;
 *   - scale(zoom) com origem no ponto focal → amplia sem deslocar o rosto.
 *
 * Assim o rosto permanece inteiro tanto na moldura vertical (4:5) do topo
 * do site quanto em um avatar circular, sem precisar regravar a imagem.
 */
export interface FocoFoto {
  focoX: number // 0–100 (% da largura da imagem)
  focoY: number // 0–100 (% da altura da imagem)
  zoom: number  // 1–3
}

/** Normaliza os valores vindos do banco (strings/números) para faixas seguras */
export function normalizarFoco(
  focoX?: number | string | null,
  focoY?: number | string | null,
  zoom?: number | string | null
): FocoFoto {
  const numero = (valor: unknown, padrao: number) => {
    const n = typeof valor === 'string' ? parseFloat(valor) : Number(valor)
    return Number.isFinite(n) ? n : padrao
  }
  const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  return {
    focoX: limitar(numero(focoX, 50), 0, 100),
    focoY: limitar(numero(focoY, 35), 0, 100),
    zoom: limitar(numero(zoom, 1), 1, 3),
  }
}

/** Estilos de enquadramento — ÚNICA fonte da verdade para página e prévias */
export function estilosFoco(foco: FocoFoto): CSSProperties {
  return {
    objectFit: 'cover',
    objectPosition: `${foco.focoX}% ${foco.focoY}%`,
    transform: `scale(${foco.zoom})`,
    transformOrigin: `${foco.focoX}% ${foco.focoY}%`,
  }
}

interface FotoDentistaProps {
  src: string
  alt: string
  focoX?: number | string | null
  focoY?: number | string | null
  zoom?: number | string | null
  className?: string
  /** Moldura quadrada (avatar) em vez da vertical 4:5 */
  quadrada?: boolean
}

export function FotoDentista({
  src,
  alt,
  focoX,
  focoY,
  zoom,
  className,
  quadrada = false,
}: FotoDentistaProps) {
  const foco = normalizarFoco(focoX, focoY, zoom)

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-neutral-100 shadow-soft',
        quadrada ? 'aspect-square rounded-full' : 'aspect-[4/5] rounded-3xl',
        'border-8 border-white',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full"
        style={estilosFoco(foco)}
        draggable={false}
      />
    </div>
  )
}
