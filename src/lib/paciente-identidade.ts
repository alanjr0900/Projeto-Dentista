/**
 * Confirmação de identidade do paciente na "Minha consulta".
 *
 * O segundo dado aceito é a data de nascimento (DD/MM/AAAA, AAAA-MM-DD ou
 * DDMMAAAA) OU os 4 últimos dígitos do telefone cadastrado. A comparação é
 * feita no servidor, contra o cadastro do próprio agendamento.
 *
 * Módulo puro (sem banco) para ser testável isoladamente.
 */
import { dataNascimentoConfere, parseDataNascimento } from './data-nascimento'

export function segundoFatorConfere(
  agendamento: {
    pacienteTelefone: string
    paciente?: { dataNascimento: Date | null } | null
  },
  valor: string
): boolean {
  const bruto = String(valor ?? '').trim()
  if (!bruto) return false

  // 4 dígitos → finais do telefone cadastrado.
  if (/^\d{4}$/.test(bruto)) {
    const telefone = agendamento.pacienteTelefone.replace(/\D/g, '')
    return telefone.length >= 4 && telefone.slice(-4) === bruto
  }

  // Data de nascimento com separadores (DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD).
  let data: Date | null = null
  const brasileira = bruto.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/)
  const iso = bruto.match(/^(\d{4})[/.-](\d{2})[/.-](\d{2})$/)

  if (brasileira) {
    data = parseDataNascimento(`${brasileira[1]}/${brasileira[2]}/${brasileira[3]}`)
  } else if (iso) {
    data = parseDataNascimento(`${iso[1]}-${iso[2]}-${iso[3]}`)
  } else if (/^\d{8}$/.test(bruto)) {
    // DDMMAAAA
    data = parseDataNascimento(`${bruto.slice(0, 2)}/${bruto.slice(2, 4)}/${bruto.slice(4)}`)
  }

  if (!data) return false
  return dataNascimentoConfere(agendamento.paciente?.dataNascimento ?? null, data)
}

/**
 * Acesso COMPLETO por código de agendamento (fluxo sem e-mail — pacientes
 * sem cadastro com e-mail ou que preferem). Exige código + data de nascimento
 * + telefone, os três conferindo com o mesmo paciente do agendamento.
 * O telefone é comparado ignorando máscara, espaços, parênteses e o código do
 * país, para o paciente idoso não errar por formatação.
 */
export function dadosAcessoConferem(
  agendamento: {
    pacienteTelefone: string
    paciente?: { dataNascimento: Date | null } | null
  },
  dataNascimentoInformada: string,
  telefoneInformado: string
): boolean {
  const data = parseDataNascimento(dataNascimentoInformada)
  if (!data) return false

  const digitosInformados = String(telefoneInformado ?? '').replace(/\D/g, '')
  const digitosCadastrados = String(agendamento.pacienteTelefone ?? '').replace(/\D/g, '')
  const informados = digitosInformados.replace(/^55/, '')
  const cadastrados = digitosCadastrados.replace(/^55/, '')
  if (!informados || !cadastrados || informados !== cadastrados) return false

  return dataNascimentoConfere(agendamento.paciente?.dataNascimento ?? null, data)
}
