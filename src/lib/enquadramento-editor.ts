import type { FocoFoto } from '@/components/FotoDentista'

/**
 * Lógica do editor de enquadramento (moldura do editor).
 *
 * O posicionamento é o MESMO das prévias (estilosFoco no FotoDentista):
 *   - a imagem cobre a moldura (object-fit cover);
 *   - o ponto de foco (focoX/focoY em % da IMAGEM) fica ancorado na
 *     mesma posição relativa da MOLDURA;
 *   - o zoom amplia ao redor do ponto de foco.
 *
 * Tudo em porcentagem — nada de deslocamento em pixels calculado antes de
 * a imagem carregar.
 */

export const ZOOM_MINIMO = 1
export const ZOOM_MAXIMO = 3

export interface ConteudoFoto {
  W: number // largura da moldura em px de tela
  H: number // altura da moldura em px de tela
  iw: number // largura natural da imagem
  ih: number // altura natural da imagem
}

/** Fator de escala base (object-fit cover): maior lado preenchido. */
export function escalarConteudo({ W, H, iw, ih }: ConteudoFoto): number {
  return Math.max(W / iw, H / ih)
}

/**
 * Quanto o conteúdo "vaza" da moldura num zoom dado (px de tela).
 * Valores negativos não ocorrem com zoom >= mínimo: com cover, o conteúdo
 * sempre preenche a moldura inteira — logo não há espaço vazio.
 */
export function sobraConteudo(conteudo: ConteudoFoto, zoom: number): { sobraX: number; sobraY: number } {
  const esc = escalarConteudo(conteudo)
  const larguraConteudo = conteudo.iw * esc * zoom
  const alturaConteudo = conteudo.ih * esc * zoom
  return {
    sobraX: larguraConteudo - conteudo.W,
    sobraY: alturaConteudo - conteudo.H,
  }
}

/**
 * Arraste (dx/dy em px de tela) → novo ponto de foco em %.
 *
 * A imagem segue o ponteiro (como no dedo/de mouse): arrastar para a direita
 * mostra mais do lado esquerdo da foto, então o foco X diminui. Com zoom que
 * não cria sobra num eixo (ex.: foto retrato na moldura vertical a 100%),
 * esse eixo fica travado — sem risco de deixar vazio.
 */
export function focoAposArraste(
  foco: FocoFoto,
  dx: number,
  dy: number,
  conteudo: ConteudoFoto
): FocoFoto {
  const { sobraX, sobraY } = sobraConteudo(conteudo, foco.zoom)

  const focoX =
    sobraX > 1
      ? limitar(foco.focoX - (dx / sobraX) * 100, 0, 100)
      : foco.focoX
  const focoY =
    sobraY > 1
      ? limitar(foco.focoY - (dy / sobraY) * 100, 0, 100)
      : foco.focoY

  return { ...foco, focoX, focoY }
}

function limitar(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
