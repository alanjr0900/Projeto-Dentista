import { getConfiguracoes } from './config'

export interface DadosMensagemWhatsApp {
  codigo: string
  pacienteNome: string
  servicoNome: string
  dataHora: Date
  endereco: string
  clinicaNome: string
  dentistaNome: string
  telefoneClinica: string
  observacoes?: string
}

export async function gerarMensagemConfirmacao(dados: DadosMensagemWhatsApp): Promise<string> {
  const cfg = await getConfiguracoes()
  
  const dataFormatada = dados.dataHora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
  const horaFormatada = dados.dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  const linhas = [
    `Olá, ${dados.pacienteNome}! 👋`,
    '',
    `Seu agendamento foi confirmado com carinho:`,
    '',
    `🦷 *Serviço:* ${dados.servicoNome}`,
    `📅 *Data:* ${dataFormatada}`,
    `⏰ *Horário:* ${horaFormatada}`,
    `🏥 *Local:* ${cfg.clinicaNome}`,
    `📍 *Endereço:* ${cfg.clinicaEndereco}`,
    '',
    `🔐 *Código do agendamento:* ${dados.codigo}`,
    '',
    `Guarde este código para cancelar ou remarcar se precisar.`,
    `Basta acessar nosso site ou responder esta mensagem.`,
  ]

  if (dados.observacoes) {
    linhas.push('', `📝 *Observações:* ${dados.observacoes}`)
  }

  linhas.push(
    '',
    `📞 *Contato:* ${cfg.clinicaTelefone}`,
    `💬 *WhatsApp:* ${cfg.clinicaTelefone}`,
    '',
    `Estamos ansiosos para cuidar do seu sorriso! ✨`,
    '',
    `— Equipe ${cfg.clinicaNome}`
  )

  return linhas.join('\n')
}

export async function gerarMensagemCancelamento(dados: Pick<DadosMensagemWhatsApp, 'codigo' | 'pacienteNome' | 'servicoNome' | 'dataHora'>): Promise<string> {
  const dataFormatada = dados.dataHora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
  const horaFormatada = dados.dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  return [
    `Olá, ${dados.pacienteNome}.`,
    '',
    `Seu agendamento foi *cancelado*:`,
    '',
    `🦷 *Serviço:* ${dados.servicoNome}`,
    `📅 *Data:* ${dataFormatada}`,
    `⏰ *Horário:* ${horaFormatada}`,
    `🔐 *Código:* ${dados.codigo}`,
    '',
    `Se foi um engano ou deseja remarcar, estamos à disposição!`,
    '',
    `— Equipe ${(await getConfiguracoes()).clinicaNome}`
  ].join('\n')
}

export async function gerarMensagemRemarcacao(
  dados: DadosMensagemWhatsApp & { dataAnterior: Date; horarioAnterior: string }
): Promise<string> {
  const cfg = await getConfiguracoes()
  
  const dataNova = dados.dataHora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
  const horaNova = dados.dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  
  const dataAntiga = dados.dataAnterior.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })

  return [
    `Olá, ${dados.pacienteNome}! 👋`,
    '',
    `Seu agendamento foi *remarcado*:`,
    '',
    `🦷 *Serviço:* ${dados.servicoNome}`,
    '',
    `❌ *Anterior:* ${dataAntiga} às ${dados.horarioAnterior}`,
    `✅ *Novo:* ${dataNova} às ${horaNova}`,
    '',
    `🏥 *Local:* ${cfg.clinicaNome}`,
    `📍 *Endereço:* ${cfg.clinicaEndereco}`,
    `🔐 *Código:* ${dados.codigo}`,
    '',
    `Qualquer dúvida, é só chamar.`,
    '',
    `— Equipe ${cfg.clinicaNome}`
  ].join('\n')
}

export function gerarLinkWhatsApp(telefone: string, mensagem: string): string {
  // telefone deve estar no formato 55DDDNNNNNNNNN
  const telefoneLimpo = telefone.replace(/\D/g, '')
  const mensagemCodificada = encodeURIComponent(mensagem)
  return `https://wa.me/${telefoneLimpo}?text=${mensagemCodificada}`
}

export async function gerarLinkConfirmacao(dados: DadosMensagemWhatsApp): Promise<string> {
  const mensagem = await gerarMensagemConfirmacao(dados)
  const cfg = await getConfiguracoes()
  return gerarLinkWhatsApp(cfg.clinicaWhatsApp, mensagem)
}

export async function gerarLinkCancelamento(
  dados: Pick<DadosMensagemWhatsApp, 'codigo' | 'pacienteNome' | 'servicoNome' | 'dataHora'>
): Promise<string> {
  const mensagem = await gerarMensagemCancelamento(dados)
  const cfg = await getConfiguracoes()
  return gerarLinkWhatsApp(cfg.clinicaWhatsApp, mensagem)
}