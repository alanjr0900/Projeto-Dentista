import { PrismaClient} from '@prisma/client'
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const prisma = new PrismaClient()

const TIMEZONE = 'America/Sao_Paulo'

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Limpar dados existentes (apenas em desenvolvimento)
  await prisma.agendamento.deleteMany()
  await prisma.bloqueioAgenda.deleteMany()
  await prisma.servico.deleteMany()
  await prisma.configuracao.deleteMany()
  await prisma.paciente.deleteMany()

  // Configurações padrão
  const configuracoes = [
    {
      chave: 'clinica_nome',
      valor: 'Consultório Dra. [Nome da Dentista]',
      descricao: 'Nome da clínica/consultório',
    },
    {
      chave: 'clinica_endereco',
      valor: '[Endereço completo do consultório]',
      descricao: 'Endereço completo para exibição e mapa',
    },
    {
      chave: 'clinica_telefone',
      valor: '(XX) XXXX-XXXX',
      descricao: 'Telefone fixo do consultório',
    },
    {
      chave: 'clinica_whatsapp',
      valor: '55XXXXXXXXXXX',
      descricao: 'WhatsApp no formato 55DDDNNNNNNNNN (apenas números)',
    },
    {
      chave: 'clinica_email',
      valor: 'contato@exemplo.com',
      descricao: 'E-mail de contato',
    },
    {
      chave: 'dentista_nome',
      valor: 'Dra. [Nome da Dentista]',
      descricao: 'Nome completo da dentista',
    },
    {
      chave: 'dentista_cro',
      valor: 'CRO/UF XXXXX',
      descricao: 'Registro no Conselho Regional de Odontologia',
    },
    {
      chave: 'dentista_foto',
      valor: '',
      descricao: 'URL da foto da dentista (deixar vazio para placeholder)',
    },
    {
      chave: 'horario_funcionamento_seg',
      valor: '08:00-12:00,13:30-18:00',
      descricao: 'Horários de segunda-feira (formato HH:MM-HH:MM, separados por vírgula)',
    },
    {
      chave: 'horario_funcionamento_ter',
      valor: '08:00-12:00,13:30-18:00',
      descricao: 'Horários de terça-feira',
    },
    {
      chave: 'horario_funcionamento_qua',
      valor: '08:00-12:00,13:30-18:00',
      descricao: 'Horários de quarta-feira',
    },
    {
      chave: 'horario_funcionamento_qui',
      valor: '08:00-12:00,13:30-18:00',
      descricao: 'Horários de quinta-feira',
    },
    {
      chave: 'horario_funcionamento_sex',
      valor: '08:00-12:00,13:30-17:00',
      descricao: 'Horários de sexta-feira',
    },
    {
      chave: 'horario_funcionamento_sab',
      valor: '08:00-12:00',
      descricao: 'Horários de sábado',
    },
    {
      chave: 'horario_funcionamento_dom',
      valor: '',
      descricao: 'Horários de domingo (vazio = fechado)',
    },
    {
      chave: 'duracao_padrao_minutos',
      valor: '60',
      descricao: 'Duração padrão de consulta em minutos',
    },
    {
      chave: 'antecedencia_minima_horas',
      valor: '24',
      descricao: 'Antecedência mínima para cancelar/remarcar em horas',
    },
    {
      chave: 'limite_dias_futuro',
      valor: '60',
      descricao: 'Limite máximo de dias à frente para agendamento',
    },
    {
      chave: 'intervalo_agendamento_minutos',
      valor: '15',
      descricao: 'Intervalo entre horários disponíveis em minutos',
    },
    {
      chave: 'limite_agendamentos_ip_hora',
      valor: '10',
      descricao: 'Limite de tentativas de agendamento por IP por hora',
    },
  ]

  for (const config of configuracoes) {
    await prisma.configuracao.create({ data: config })
  }

  // Serviços padrão
  const servicos = [
    {
      nome: 'Consulta de Avaliação',
      descricao: 'Exame clínico completo, radiografias se necessário, diagnóstico e plano de tratamento personalizado.',
      duracaoMin: 60,
      ordem: 1,
    },
    {
      nome: 'Limpeza e Profilaxia',
      descricao: 'Remoção de placa bacteriana, tártaro e polimento dental para prevenção de cáries e doenças gengivais.',
      duracaoMin: 50,
      ordem: 2,
    },
    {
      nome: 'Restauração (Resina Composta)',
      descricao: 'Tratamento de cáries com material estético da cor do dente, devolvendo forma e função.',
      duracaoMin: 60,
      ordem: 3,
    },
    {
      nome: 'Clareamento Dental',
      descricao: 'Clareamento supervisionado para dentes mais brancos e brilhantes, com segurança e acompanhamento.',
      duracaoMin: 90,
      ordem: 4,
    },
    {
      nome: 'Tratamento de Canal',
      descricao: 'Endodontia para tratar infecção na polpa do dente, aliviando a dor e preservando o dente natural.',
      duracaoMin: 90,
      ordem: 5,
    },
    {
      nome: 'Extração Simples',
      descricao: 'Remoção de dente irrecuperável com técnica atraumática e orientações de pós-operatório.',
      duracaoMin: 45,
      ordem: 6,
    },
    {
      nome: 'Urgência / Dor Aguda',
      descricao: 'Atendimento prioritário para dor de dente intensa, trauma ou infecção aguda.',
      duracaoMin: 40,
      ordem: 7,
    },
  ]

  const servicosCriados = []
  for (const servico of servicos) {
    const criado = await prisma.servico.create({ data: servico })
    servicosCriados.push(criado)
  }

  // Agendamentos de exemplo para demonstração
  const hoje = startOfDay(new Date())
  const agendamentosExemplo = [
    {
      servicoId: servicosCriados[0].id,
      dataHora: setMinutes(setHours(addDays(hoje, 1), 9), 0),
      duracaoMin: 60,
      pacienteNome: 'Maria Silva Santos',
      pacienteTelefone: '11999998888',
      pacienteEmail: 'maria.silva@email.com',
      observacoes: 'Primeira consulta - avaliação geral',
      status: "CONFIRMADO",
      confirmadoEm: new Date(),
    },
    {
      servicoId: servicosCriados[1].id,
      dataHora: setMinutes(setHours(addDays(hoje, 1), 10), 30),
      duracaoMin: 50,
      pacienteNome: 'João Pedro Oliveira',
      pacienteTelefone: '11988887777',
      observacoes: 'Retorno para limpeza',
      status: "CONFIRMADO",
      confirmadoEm: new Date(),
    },
    {
      servicoId: servicosCriados[2].id,
      dataHora: setMinutes(setHours(addDays(hoje, 2), 14), 0),
      duracaoMin: 60,
      pacienteNome: 'Ana Carolina Ferreira',
      pacienteTelefone: '11977776666',
      pacienteEmail: 'ana.ferreira@email.com',
      status: "PENDENTE",
    },
    {
      servicoId: servicosCriados[0].id,
      dataHora: setMinutes(setHours(addDays(hoje, 3), 9), 0),
      duracaoMin: 60,
      pacienteNome: 'Carlos Eduardo Lima',
      pacienteTelefone: '11966665555',
      status: "CONFIRMADO",
      confirmadoEm: new Date(),
    },
    {
      servicoId: servicosCriados[3].id,
      dataHora: setMinutes(setHours(addDays(hoje, 5), 15), 0),
      duracaoMin: 90,
      pacienteNome: 'Fernanda Costa Ribeiro',
      pacienteTelefone: '11955554444',
      pacienteEmail: 'fernanda.ribeiro@email.com',
      observacoes: 'Interesse em clareamento caseiro',
      status: "CONFIRMADO",
      confirmadoEm: new Date(),
    },
  ]

  for (const ag of agendamentosExemplo) {
    await prisma.agendamento.create({ data: ag })
  }

  // Bloqueios de exemplo (férias, plantão)
  await prisma.bloqueioAgenda.create({
    data: {
      inicio: new Date(Date.UTC(2025, 11, 20)), // 20/12/2025
      fim: new Date(Date.UTC(2026, 0, 10)),     // 10/01/2026
      motivo: 'Férias de fim de ano',
      recorrente: false,
    },
  })

  // Plantão no posto de saúde - quartas-feiras à tarde (recorrente)
  await prisma.bloqueioAgenda.create({
    data: {
      inicio: new Date('2024-01-01T13:00:00'),
      fim: new Date('2024-01-01T18:00:00'),
      motivo: 'Plantão no posto de saúde',
      recorrente: true,
      diaSemana: 3, // Quarta-feira
    },
  })

  // Pacientes de exemplo
  const pacientesExemplo = [
    {
      nome: 'Maria Silva Santos',
      telefone: '11999998888',
      email: 'maria.silva@email.com',
      anotacoes: 'Paciente ansiosa - explicar procedimentos com calma. Alergia a látex.',
    },
    {
      nome: 'João Pedro Oliveira',
      telefone: '11988887777',
      anotacoes: 'Prefere horários pela manhã. Tratamento periodontal em andamento.',
    },
    {
      nome: 'Ana Carolina Ferreira',
      telefone: '11977776666',
      email: 'ana.ferreira@email.com',
      anotacoes: 'Sensibilidade dentinária - usar anestesia tópica.',
    },
  ]

  for (const paciente of pacientesExemplo) {
    await prisma.paciente.create({ data: paciente })
  }

  console.log('✅ Seed concluído com sucesso!')
  console.log(`📋 ${configuracoes.length} configurações criadas`)
  console.log(`🦷 ${servicos.length} serviços criados`)
  console.log(`📅 ${agendamentosExemplo.length} agendamentos de exemplo criados`)
  console.log(`🚫 2 bloqueios de agenda criados`)
  console.log(`👥 ${pacientesExemplo.length} pacientes de exemplo criados`)
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })