import { describe, expect, it } from 'vitest'
import { segundoFatorConfere } from './paciente-identidade'
import { parseDataNascimento } from './data-nascimento'

const agendamento = {
  pacienteTelefone: '11971850356',
  paciente: { dataNascimento: parseDataNascimento('1990-05-20') },
}

describe('segundo fator do paciente', () => {
  it('aceita a data de nascimento em formatos usuais', () => {
    expect(segundoFatorConfere(agendamento, '20/05/1990')).toBe(true)
    expect(segundoFatorConfere(agendamento, '20-05-1990')).toBe(true)
    expect(segundoFatorConfere(agendamento, '1990-05-20')).toBe(true)
    expect(segundoFatorConfere(agendamento, '20051990')).toBe(true)
    expect(segundoFatorConfere(agendamento, ' 20/05/1990 ')).toBe(true)
  })

  it('aceita os 4 últimos dígitos do telefone cadastrado', () => {
    expect(segundoFatorConfere(agendamento, '0356')).toBe(true)
    expect(segundoFatorConfere(agendamento, '(11) 97185-0356')).toBe(false)
    expect(segundoFatorConfere(agendamento, '9999')).toBe(false)
  })

  it('rejeita data errada, vazia ou sem cadastro', () => {
    expect(segundoFatorConfere(agendamento, '20/05/1991')).toBe(false)
    expect(segundoFatorConfere(agendamento, '31/02/1990')).toBe(false)
    expect(segundoFatorConfere(agendamento, '')).toBe(false)
    expect(
      segundoFatorConfere(
        { pacienteTelefone: '11971850356', paciente: { dataNascimento: null } },
        '20/05/1990'
      )
    ).toBe(false)
  })
})
