/**
 * Teste de ponta a ponta do "Minha consulta" contra o servidor rodando.
 *
 * Pré-requisitos:
 *   - servidor em BASE_URL (padrão http://127.0.0.1:3110);
 *   - banco de desenvolvimento (prisma/dev.db) já com o schema atualizado.
 *
 * O teste cria um paciente/agendamento temporários, valida os fluxos de
 * login, diagnósticos, agenda e remarcação, e APAGA tudo ao final.
 *
 * Uso: node scripts/teste-minha-consulta.mjs
 */
import { PrismaClient } from '@prisma/client'
import { randomInt } from 'crypto'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3110'
const prisma = new PrismaClient()

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const MENSAGEM_GENERICA =
  'Não foi possível acessar com esses dados. Confira o código e o dado informado e tente novamente.'
const MENSAGEM_PRAZO =
  'Remarcações precisam ser feitas com pelo menos 48 horas de antecedência. Fale com a clínica pelo WhatsApp.'

let passos = 0
function ok(condicao, mensagem) {
  passos++
  if (!condicao) throw new Error(`FALHOU (${passos}): ${mensagem}`)
  console.log(`  ✔ ${mensagem}`)
}

function gerarCodigo() {
  let codigo = ''
  for (let i = 0; i < 8; i++) codigo += ALFABETO[randomInt(ALFABETO.length)]
  return codigo
}

function cookieDe(res) {
  const bruto = res.headers.get('set-cookie') || ''
  const encontrado = bruto.match(/consulta-sessao=[^;]+/)
  return encontrado ? encontrado[0] : ''
}

async function login(codigo, segundoFator) {
  const res = await fetch(`${BASE}/api/paciente/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(segundoFator ? { codigo, segundoFator } : { codigo }),
  })
  const corpo = await res.json().catch(() => ({}))
  return { res, corpo, cookie: cookieDe(res) }
}

async function api(caminho, { cookie, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const corpo = await res.json().catch(() => ({}))
  return { res, corpo }
}

const TEMP_NOME = 'Teste Minha Consulta'
const TEMP_TELEFONE = '19999990001'
let pacienteTempId = null
let agendamentoTempId = null

try {
  console.log(`\n== Servidor ${BASE} ==`)
  const home = await fetch(BASE)
  ok(home.status === 200, 'site responde na porta 3110')

  // -------------------------------------------------------------------
  console.log('\n== Prazo de 48h (agendamento real MK5CKD8W, 31/10 09:00) ==')
  const loginReal = await login('mk5ckd8w') // minúsculo: deve normalizar
  ok(loginReal.res.status === 200, 'código em minúsculas é aceito e normalizado')
  ok(loginReal.corpo.nivel === 'basico', 'sem segundo dado a sessão é básica')
  ok(loginReal.corpo.agendamento?.codigo === 'MK5CKD8W', 'sessão devolve o próprio código')

  const remarcarBloqueado = await api('/api/paciente/remarcar', {
    cookie: loginReal.cookie,
    method: 'POST',
    body: { data: '2026-11-10', horario: '10:00' },
  })
  ok(remarcarBloqueado.res.status === 422, 'remarcar consulta dentro de 48h é bloqueado no servidor')
  ok(remarcarBloqueado.corpo.codigo === 'PRAZO', 'bloqueio devolve código PRAZO')
  ok(remarcarBloqueado.corpo.erro === MENSAGEM_PRAZO, 'mensagem exata de 48h com WhatsApp')

  const horariosBloqueados = await api('/api/paciente/horarios', { cookie: loginReal.cookie })
  ok(horariosBloqueados.res.status === 422, 'agenda também respeita as 48h no servidor')

  const cancelarBloqueado = await api('/api/paciente/cancelar', {
    cookie: loginReal.cookie,
    method: 'POST',
  })
  ok(cancelarBloqueado.res.status === 422, 'cancelamento dentro do prazo também é bloqueado')

  // -------------------------------------------------------------------
  console.log('\n== Preparando paciente/agendamento temporários ==')
  await prisma.anotacaoPaciente.deleteMany({ where: { paciente: { telefone: TEMP_TELEFONE } } })
  await prisma.agendamento.deleteMany({ where: { pacienteTelefone: TEMP_TELEFONE } })
  await prisma.paciente.deleteMany({ where: { telefone: TEMP_TELEFONE } })

  const servico = await prisma.servico.findFirst({ where: { ativo: true }, orderBy: { ordem: 'asc' } })
  ok(Boolean(servico), 'existe serviço ativo para o teste')

  const dataFutura = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
  dataFutura.setUTCHours(18, 0, 0, 0) // 15:00 em São Paulo

  const paciente = await prisma.paciente.create({
    data: {
      nome: TEMP_NOME,
      telefone: TEMP_TELEFONE,
      dataNascimento: new Date(Date.UTC(1990, 4, 20, 12, 0, 0)),
      consentimentoEm: new Date(),
    },
  })
  pacienteTempId = paciente.id

  const codigoTemp = gerarCodigo()
  const agendamento = await prisma.agendamento.create({
    data: {
      codigo: codigoTemp,
      servicoId: servico.id,
      pacienteId: paciente.id,
      dataHora: dataFutura,
      duracaoMin: servico.duracaoMin,
      pacienteNome: TEMP_NOME,
      pacienteTelefone: TEMP_TELEFONE,
      status: 'CONFIRMADO',
    },
  })
  agendamentoTempId = agendamento.id

  const liberada = await prisma.anotacaoPaciente.create({
    data: { pacienteId: paciente.id, texto: 'Diagnóstico liberado: acompanhamento de rotina.', liberado: true },
  })
  await prisma.anotacaoPaciente.create({
    data: { pacienteId: paciente.id, texto: 'Nota interna: não mostrar ao paciente.', liberado: false },
  })
  ok(true, `agendamento temporário ${codigoTemp} criado`)

  // -------------------------------------------------------------------
  console.log('\n== Acesso e diagnósticos ==')
  const basico = await login(codigoTemp)
  ok(basico.res.status === 200 && basico.corpo.nivel === 'basico', 'código sozinho entra no nível básico')

  const diagBasico = await api('/api/paciente/diagnosticos', { cookie: basico.cookie })
  ok(diagBasico.res.status === 403, 'nível básico não vê diagnósticos')

  const completoData = await login(codigoTemp, '20/05/1990')
  ok(completoData.res.status === 200 && completoData.corpo.nivel === 'completo', 'data de nascimento correta libera nível completo')

  const diagCompleto = await api('/api/paciente/diagnosticos', { cookie: completoData.cookie })
  ok(diagCompleto.res.status === 200, 'nível completo lê diagnósticos')
  ok(diagCompleto.corpo.registros.length === 1, 'só o registro liberado aparece')
  ok(diagCompleto.corpo.registros[0]?.id === liberada.id, 'registro liberado é o esperado')
  ok(
    !JSON.stringify(diagCompleto.corpo).includes('Nota interna'),
    'registro NÃO liberado não aparece'
  )

  const log = await prisma.logAcessoDiagnostico.findFirst({
    where: { pacienteId: paciente.id, agendamentoId: agendamento.id },
    orderBy: { criadoEm: 'desc' },
  })
  ok(Boolean(log), 'acesso aos diagnósticos é registrado (LGPD)')
  ok(log.registros === liberada.id && log.quantidade === 1, 'log guarda quais registros (sem conteúdo)')

  const completoTelefone = await login(codigoTemp, '0001')
  ok(completoTelefone.res.status === 200 && completoTelefone.corpo.nivel === 'completo', '4 últimos dígitos do telefone também liberam')

  const errado = await login(codigoTemp, '01/01/1900')
  ok(errado.res.status === 401, 'segundo dado errado é recusado')
  ok(errado.corpo.erro === MENSAGEM_GENERICA, 'mensagem de erro é genérica (não diz qual campo errou)')

  const inexistente = await login('ZZZZ2345')
  ok(inexistente.res.status === 401 && inexistente.corpo.erro === MENSAGEM_GENERICA, 'código inexistente usa a mesma mensagem genérica')

  // -------------------------------------------------------------------
  console.log('\n== Agenda: somente horários livres, sem dados de ninguém ==')
  const horarios = await api('/api/paciente/horarios', { cookie: completoTelefone.cookie })
  ok(horarios.res.status === 200, 'agenda responde para sessão válida')
  ok(Array.isArray(horarios.corpo.dias) && horarios.corpo.dias.length > 0, 'há dias com horários livres')

  const todosSlots = horarios.corpo.dias.flatMap(dia => dia.slots)
  ok(todosSlots.length > 0, 'há slots livres')
  ok(
    todosSlots.every(slot => Object.keys(slot).sort().join(',') === 'dataHoraISO,horario'),
    'cada slot expõe apenas horário e instante'
  )
  const limite48h = Date.now() + 48 * 60 * 60 * 1000 - 60 * 1000
  ok(
    todosSlots.every(slot => new Date(slot.dataHoraISO).getTime() >= limite48h),
    'nenhum slot antes de agora + 48h'
  )

  const pacientes = await prisma.paciente.findMany({ select: { nome: true, telefone: true } })
  const jsonAgenda = JSON.stringify(horarios.corpo)
  ok(!jsonAgenda.includes(TEMP_NOME), 'agenda não expõe nome do paciente')
  ok(!jsonAgenda.includes(TEMP_TELEFONE), 'agenda não expõe telefone')
  ok(
    !pacientes.some(p => jsonAgenda.includes(p.nome) || jsonAgenda.includes(p.telefone)),
    'agenda não expõe dados de nenhum outro paciente'
  )
  ok(!jsonAgenda.toLowerCase().includes('paciente'), 'agenda não menciona pacientes')

  // -------------------------------------------------------------------
  console.log('\n== Remarcação com mais de 48h ==')
  const slot = todosSlots[0]
  const diaDoSlot = horarios.corpo.dias.find(dia => dia.slots.includes(slot))
  const remarcar = await api('/api/paciente/remarcar', {
    cookie: completoTelefone.cookie,
    method: 'POST',
    body: { data: diaDoSlot.data, horario: slot.horario },
  })
  ok(remarcar.res.status === 200, 'remarcação com mais de 48h funciona')
  ok(
    remarcar.corpo.agendamento?.dataHora === slot.dataHoraISO,
    'resposta confirma o novo horário'
  )

  const noBanco = await prisma.agendamento.findUnique({
    where: { id: agendamento.id },
    include: { remarcacoes: true },
  })
  ok(noBanco.dataHora.toISOString() === slot.dataHoraISO, 'banco recebeu o novo horário')
  ok(noBanco.remarcacoes.length === 1, 'histórico de remarcação registrado')
  ok(
    noBanco.remarcacoes[0].por === 'paciente' &&
      noBanco.remarcacoes[0].de.getTime() === dataFutura.getTime() &&
      noBanco.remarcacoes[0].para.toISOString() === slot.dataHoraISO,
    'histórico guarda quem, de onde e para onde'
  )

  // -------------------------------------------------------------------
  console.log('\n== Limite de tentativas ==')
  let recebeu429 = false
  for (let i = 0; i < 6; i++) {
    const tentativa = await login(codigoTemp, '01/01/1900')
    if (tentativa.res.status === 429) recebeu429 = true
  }
  ok(recebeu429, 'após várias tentativas erradas o acesso é bloqueado temporariamente')

  const bloqueadoMesmoCorreto = await login(codigoTemp, '20/05/1990')
  ok(bloqueadoMesmoCorreto.res.status === 429, 'bloqueio vale mesmo com o dado correto')
  ok(
    /muitas tentativas/i.test(bloqueadoMesmoCorreto.corpo.erro || ''),
    'mensagem de bloqueio é clara e temporária'
  )

  console.log(`\n✅ TODOS OS ${passos} TESTES PASSARAM`)
} finally {
  // Limpeza total dos dados temporários (o banco real fica intacto).
  if (pacienteTempId) {
    await prisma.logAcessoDiagnostico.deleteMany({ where: { pacienteId: pacienteTempId } }).catch(() => {})
    await prisma.remarcacao.deleteMany({ where: { agendamento: { pacienteId: pacienteTempId } } }).catch(() => {})
    await prisma.anotacaoPaciente.deleteMany({ where: { pacienteId: pacienteTempId } }).catch(() => {})
  }
  if (agendamentoTempId) {
    await prisma.agendamento.deleteMany({ where: { id: agendamentoTempId } }).catch(() => {})
  }
  if (pacienteTempId) {
    await prisma.paciente.deleteMany({ where: { id: pacienteTempId } }).catch(() => {})
  }
  await prisma.$disconnect()
  console.log('\nDados temporários removidos.')
}
