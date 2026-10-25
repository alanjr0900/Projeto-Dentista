import { describe, expect, it } from 'vitest'
import {
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
  escalarConteudo,
  focoAposArraste,
  sobraConteudo,
} from './enquadramento-editor'
import type { ConteudoFoto } from './enquadramento-editor'

const moldura = 400 // px de largura da moldura 4:5
const alturaMoldura = 500

const retrato: ConteudoFoto = { W: moldura, H: alturaMoldura, iw: 800, ih: 1200 }
const paisagem: ConteudoFoto = { W: moldura, H: alturaMoldura, iw: 1600, ih: 900 }
const quadrada: ConteudoFoto = { W: moldura, H: alturaMoldura, iw: 1000, ih: 1000 }

/**
 * Borda esquerda do conteúdo pintado, em px de tela, para um foco dado.
 * (Mesma geometria de object-position + scale no ponto de foco.)
 */
function bordaEsquerda(focoX: number, conteudo: ConteudoFoto, zoom: number): number {
  const { sobraX } = sobraConteudo(conteudo, zoom)
  return -sobraX * (focoX / 100)
}

describe('sobraConteudo (object-fit cover)', () => {
  it('a zoom mínimo a imagem cobre a moldura em qualquer proporção', () => {
    for (const conteudo of [retrato, paisagem, quadrada]) {
      const esc = escalarConteudo(conteudo)
      const largura = conteudo.iw * esc
      const altura = conteudo.ih * esc
      expect(largura).toBeGreaterThanOrEqual(conteudo.W)
      expect(altura).toBeGreaterThanOrEqual(conteudo.H)
    }
  })

  it('foto retrato a 100% transborda só na vertical (horizontal fica exata)', () => {
    const { sobraX, sobraY } = sobraConteudo(retrato, 1)
    expect(sobraX).toBeLessThanOrEqual(1) // sem sobra horizontal
    expect(sobraY).toBeGreaterThan(0)
  })

  it('foto paisagem a 100% transborda só na horizontal (vertical fica exata)', () => {
    const { sobraX, sobraY } = sobraConteudo(paisagem, 1)
    expect(sobraX).toBeGreaterThan(0)
    expect(sobraY).toBeLessThanOrEqual(1)
  })
})

describe('focoAposArraste (a imagem segue o ponteiro, sem vazio na moldura)', () => {
  it('arrastar a metade da sobra horizontal no paisagem vai do centro à borda esquerda', () => {
    const { sobraX } = sobraConteudo(paisagem, 1)
    const inicial = { focoX: 50, focoY: 35, zoom: 1 }
    const novo = focoAposArraste(inicial, sobraX / 2, 0, paisagem)
    expect(novo.focoX).toBe(0)
  })

  it('arrastar para o lado oposto leva o foco até 100', () => {
    const { sobraX } = sobraConteudo(paisagem, 1)
    const inicial = { focoX: 50, focoY: 35, zoom: 1 }
    const novo = focoAposArraste(inicial, -sobraX / 2, 0, paisagem)
    expect(novo.focoX).toBe(100)
  })

  it('exceeder a sobra → travar na borda (nunca deixa a moldura vazia)', () => {
    const inicial = { focoX: 25, focoY: 35, zoom: 1.5 }
    for (const delta of [-100000, 100000]) {
      const novo = focoAposArraste(inicial, delta, 0, quadrada)
      expect(novo.focoX).toBe(delta < 0 ? 100 : 0)
    }
  })

  it('retrato a 100% não tem sobra horizontal: o foco X fica intacto', () => {
    const inicial = { focoX: 30, focoY: 40, zoom: 1 }
    const novo = focoAposArraste(inicial, 12345, 0, retrato)
    expect(novo.focoX).toBe(30)
  })

  it('arrastar verticalmente move o foco Y na direção oposta ao ponteiro', () => {
    const { sobraY } = sobraConteudo(retrato, 1.5)
    const inicial = { focoX: 50, focoY: 50, zoom: 1.5 }
    const baixo = focoAposArraste(inicial, 0, sobraY / 2, retrato)
    expect(baixo.focoY).toBe(0)
    const cima = focoAposArraste(inicial, 0, -sobraY / 2, retrato)
    expect(cima.focoY).toBe(100)
  })

  it('o zoom não muda durante o arraste', () => {
    const inicial = { focoX: 50, focoY: 35, zoom: 2 }
    const novo = focoAposArraste(inicial, 10, -10, quadrada)
    expect(novo.zoom).toBe(2)
  })

  it('geometria consistente: foco nas bordas ainda deixa a moldura coberta', () => {
    for (const conteudo of [retrato, paisagem, quadrada]) {
      for (const zoom of [ZOOM_MINIMO, 1.5, ZOOM_MAXIMO]) {
        const esc = escalarConteudo(conteudo)
        const larguraConteudo = conteudo.iw * esc * zoom
        // valor foco = 0 (borda esquerda) e foco = 100 ( direita)
        for (const focoX of [0, 100]) {
          const direita = bordaEsquerda(focoX, conteudo, zoom) + larguraConteudo
          expect(bordaEsquerda(focoX, conteudo, zoom)).toBeLessThanOrEqual(0)
          expect(direita).toBeGreaterThanOrEqual(conteudo.W)
        }
      }
    }
  })
})
