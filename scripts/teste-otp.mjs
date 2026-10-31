/**
 * Teste de ponta a ponta do login por CÓDIGO NO E-MAIL ("Minha consulta").
 *
 * Cobre: resposta neutra (e-mail existente x inexistente), limites de envio,
 * tentativas erradas, bloqueio de 30 min, sessão HttpOnly, diagnósticos,
 * horários, remarcação, cancelamento, posse do agendamento, cookie adulterado
 * e logout.
 *
 * O script cria um paciente/agendamento temporários e APAGA tudo ao final.
 * Nenhum código ou e-mail completo é impresso.
 *
 * Uso: node scripts/teste-otp.mjs
 */
import { createHmac, randomInt } from 'crypto'
import { readFileSync } from 'fs'

function carregarEnv(arquivo) {
  try {
    for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const valor = m[2].trim().replace(/^"(.*)"$/, '$1')
      // .env.local tem prioridade: só sobrescreve se ainda não veio dele.
      if (arquivo.endsWith('.env.local') || !(m[1] in process.env)) {
        process.env[m[1]] = valor
      }
    }
  } catch {
    /* arquivo opcional */
  }
}
carregarEnv('.env')
carregarEnv('.env.local')

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3110'
const SEGREDO = process.env.OTP_HASH_SECRET || process.env.AUTH_SECRET
const COOKIE = process.env.PACIENTE_COOKIE_NAME || 'consulta-sessao-otp'
const MENSAGEM_NEUTRA = 'Se este e-mail estiver cadastrado, enviamos um código de acesso.'
const MENSAGEM_48H =
  'Remarcações precisam ser feitas com pelo menos 48 horas de antecedência. Fale com a clínica pelo WhatsApp.'

if (!SEGREDO) throw new Error('AUTH_SECRET não encontrado no .env/.env.local')

const hashCodigo = codigo =>
  createHmac('sha256', SEGREDO).update(`otp:${codigo}`).digest('hex')
const hashEmail = email =>
  createHmac('sha256', SEGREDO).update(`email:${email.trim().toLowerCase()}`).digest('hex')
const hashIp = ip => createHmac('sha256', SEGREDO).update(`ip:${ip.trim()}`).digest('hex')

let passos = 0
function ok(condicao, mensagem) {
  passos++
  if (!condicao) throw new Error(`FALHOU (${passos}): ${mensagem}`)
  console.log(`  ✔ ${mensagem}`)
}

function cookieDe(res) {
  const bruto = res.headers.get('set-cookie') || ''
  const encontrado = bruto.match(new RegExp(`${COOKIE}=[^;]*`))
  return encontrado ? encontrado[0] : ''
}

async function post(caminho, body, { cookie, ip } = {}) {
  const inicio = Date.now()
  const res = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
  const corpo = await res.json().catch(() => ({}))
  return { res, corpo, ms: Date.now() - inicio, cookie: cookieDe(res), setCookie: res.headers.get('set-cookie') || '' }
}

async function get(caminho, { cookie, ip } = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    headers: { ...(cookie ? { cookie } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) },
    cache: 'no-store',
  })
  const corpo = await res.json().catch(() => ({}))
  return { res, corpo }
}

const sufixo = `${Date.now()}${randomInt(1000)}`
const EMAIL_TESTE = `jralan0900+otp${sufixo}@gmail.com`
const EMAIL_OUTRO = `jralan0900+otpoutro${sufixo}@gmail.com`
const TELEFONE_A = `1997${sufixo.slice(-7)}`
const TELEFONE_B = `1986${sufixo.slice(-7)}`
const IP_LOGIN = `203.0.113.${randomInt(2, 250)}`
const CODIGO_SENHA = '424242'

let pacienteA = null
let pacienteB = null
let agendamentoA = null
let agendamentoB = null

async function semearCodigoConhecido(codigo, extras = {}) {
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000)
  const existente = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  const base = {
    codigoHash: hashCodigo(codigo),
    expiraEm,
    usado: false,
    usadoEm: null,
    tentativas: 0,
    bloqueado: false,
    bloqueioAte: null,
  }
  if (existente) {
    await prisma.codigoAcesso.update({
      where: { pacienteId: pacienteA.id },
      data: { ...base, ...extras },
    })
  } else {
    await prisma.codigoAcesso.create({
      data: { pacienteId: pacienteA.id, bloqueiosConsecutivos: 0, ...base, ...extras },
    })
  }
}

try {
  console.log(`\n== Servidor ${BASE} ==`)
  const home = await fetch(BASE)
  ok(home.status === 200, 'site responde')

  const servico = await prisma.servico.findFirst({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  })
  ok(Boolean(servico), 'existe serviço ativo')

  const dataA = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
  dataA.setUTCHours(13, 0, 0, 0) // 10:00 em São Paulo
  const dataB = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)
  dataB.setUTCHours(13, 0, 0, 0)

  await prisma.paciente.deleteMany({ where: { telefone: { in: [TELEFONE_A, TELEFONE_B] } } })
  pacienteA = await prisma.paciente.create({
    data: { nome: 'Teste OTP A', telefone: TELEFONE_A, email: EMAIL_TESTE, consentimentoEm: new Date() },
  })
  pacienteB = await prisma.paciente.create({
    data: { nome: 'Teste OTP B', telefone: TELEFONE_B, email: EMAIL_OUTRO, consentimentoEm: new Date() },
  })

  agendamentoA = await prisma.agendamento.create({
    data: {
      codigo: `OTPA${sufixo.slice(-5)}`,
      servicoId: servico.id,
      pacienteId: pacienteA.id,
      dataHora: dataA,
      duracaoMin: servico.duracaoMin,
      pacienteNome: pacienteA.nome,
      pacienteTelefone: TELEFONE_A,
      pacienteEmail: EMAIL_TESTE,
      status: 'CONFIRMADO',
    },
  })
  agendamentoB = await prisma.agendamento.create({
    data: {
      codigo: `OTPB${sufixo.slice(-5)}`,
      servicoId: servico.id,
      pacienteId: pacienteB.id,
      dataHora: dataB,
      duracaoMin: servico.duracaoMin,
      pacienteNome: pacienteB.nome,
      pacienteTelefone: TELEFONE_B,
      pacienteEmail: EMAIL_OUTRO,
      status: 'CONFIRMADO',
    },
  })

  const liberada = await prisma.anotacaoPaciente.create({
    data: {
      pacienteId: pacienteA.id,
      texto: 'Diagnóstico liberado: acompanhamento de rotina.',
      liberado: true,
    },
  })
  await prisma.anotacaoPaciente.create({
    data: {
      pacienteId: pacienteA.id,
      texto: 'Nota interna: não mostrar ao paciente.',
      liberado: false,
    },
  })

  // Limpa contadores que possam ter sobrado de execuções anteriores.
  await prisma.limiteEnvioEmail.deleteMany({ where: { chave: hashEmail(EMAIL_TESTE) } })
  await prisma.limiteEnvioEmail.deleteMany({ where: { chave: hashEmail(EMAIL_OUTRO) } })
  await prisma.tentativaAcesso.deleteMany({ where: { emailHash: hashEmail(EMAIL_TESTE) } })
  await prisma.codigoAcesso.deleteMany({ where: { pacienteId: pacienteA.id } })

  console.log('\n== Resposta neutra (não revela se o e-mail existe) ==')
  const pedidoExistente = await post('/api/paciente/email/login', { email: EMAIL_TESTE }, { ip: IP_LOGIN })
  ok(pedidoExistente.res.status === 200, 'pedido com e-mail cadastrado responde 200')
  ok(pedidoExistente.corpo.mensagem === MENSAGEM_NEUTRA, 'mensagem neutra exata (cadastrado)')
  ok(pedidoExistente.ms >= 800, `resposta tem tempo mínimo (${pedidoExistente.ms}ms)`)

  const pedidoInexistente = await post(
    '/api/paciente/email/login',
    { email: `nao-existe-${sufixo}@example.com` },
    { ip: `203.0.113.${randomInt(2, 250)}` }
  )
  ok(pedidoInexistente.res.status === 200, 'pedido com e-mail inexistente responde 200')
  ok(
    JSON.stringify(pedidoExistente.corpo) === JSON.stringify(pedidoInexistente.corpo),
    'corpo idêntico para e-mail existente e inexistente'
  )
  ok(
    Math.abs(pedidoExistente.ms - pedidoInexistente.ms) < 700,
    `tempos equivalentes (${pedidoExistente.ms}ms x ${pedidoInexistente.ms}ms)`
  )

  const registro = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(Boolean(registro), 'código foi gerado para o e-mail cadastrado')
  ok(/^[a-f0-9]{64}$/.test(registro.codigoHash), 'só o hash HMAC do código é gravado')
  const validadeMin = Math.round((registro.expiraEm.getTime() - Date.now()) / 60000)
  ok(validadeMin >= 9 && validadeMin <= 10, `código vale ~10 minutos (${validadeMin} min)`)
  const hashInicial = registro.codigoHash

  console.log('\n== Limites no servidor ==')
  const reenvioImediato = await post('/api/paciente/email/login', { email: EMAIL_TESTE }, { ip: IP_LOGIN })
  ok(reenvioImediato.res.status === 200 && reenvioImediato.corpo.mensagem === MENSAGEM_NEUTRA, 'reenvio imediato continua neutro')
  let atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(atual.codigoHash === hashInicial, 'reenvio em menos de 60s NÃO gera novo código')

  // Cota por e-mail: 3/hora.
  await prisma.limiteEnvioEmail.update({
    where: { chave: hashEmail(EMAIL_TESTE) },
    data: { quantidade: 3, janelaInicio: new Date(), ultimoEnvioEm: new Date(Date.now() - 120000) },
  })
  await post('/api/paciente/email/login', { email: EMAIL_TESTE }, { ip: `203.0.113.${randomInt(2, 250)}` })
  atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(atual.codigoHash === hashInicial, 'cota de 3 envios/hora por e-mail bloqueia novo código')

  // Cota por IP: 10 pedidos/hora.
  const ipCota = `203.0.113.${randomInt(2, 250)}`
  await prisma.limiteEnvioEmail.update({
    where: { chave: hashEmail(EMAIL_TESTE) },
    data: { quantidade: 1, janelaInicio: new Date(), ultimoEnvioEm: new Date(Date.now() - 120000) },
  })
  await prisma.limiteEnvioIp.upsert({
    where: { chave: hashIp(ipCota) },
    create: {
      chave: hashIp(ipCota),
      janelaInicio: new Date(),
      ultimaHorario: new Date(),
      quantidade: 10,
    },
    update: { quantidade: 10, janelaInicio: new Date(), ultimaHorario: new Date() },
  })
  await post('/api/paciente/email/login', { email: EMAIL_TESTE }, { ip: ipCota })
  atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(atual.codigoHash === hashInicial, 'cota de 10 pedidos/hora por IP bloqueia novo código')
  await prisma.limiteEnvioIp.deleteMany({ where: { chave: hashIp(ipCota) } })

  console.log('\n== Tentativas erradas e bloqueio de 30 minutos ==')
  await semearCodigoConhecido('111111', { bloqueiosConsecutivos: 0 })
  const erros = []
  for (let i = 0; i < 5; i++) {
    const r = await post('/api/paciente/email/validar', { email: EMAIL_TESTE, codigo: '000000' })
    erros.push(r)
  }
  ok(erros.slice(0, 4).every(r => r.res.status === 401), '4 primeiras tentativas são recusadas')
  ok(erros[0].corpo.erro === 'Código inválido ou expirado.', 'mensagem de erro é genérica')
  ok(erros[4].res.status === 401 && /peça um novo código/i.test(erros[4].corpo.erro || ''), '5ª tentativa invalida o código')
  atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(atual.usado === true && atual.bloqueiosConsecutivos === 1, 'código invalidado e bloqueio #1 contabilizado')

  for (let ciclo = 2; ciclo <= 3; ciclo++) {
    await semearCodigoConhecido('111111')
    for (let i = 0; i < 5; i++) {
      await post('/api/paciente/email/validar', { email: EMAIL_TESTE, codigo: '000000' })
    }
    atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
    if (ciclo < 3) {
      ok(atual.bloqueiosConsecutivos === ciclo, `bloqueio #${ciclo} contabilizado`)
    }
  }
  ok(atual.bloqueado === true, '3 códigos invalidados seguidos bloqueiam o e-mail')
  const minutosBloqueio = Math.round((atual.bloqueioAte.getTime() - Date.now()) / 60000)
  ok(minutosBloqueio >= 29 && minutosBloqueio <= 30, `bloqueio dura ~30 minutos (${minutosBloqueio} min)`)

  const corretoDuranteBloqueio = await post('/api/paciente/email/validar', {
    email: EMAIL_TESTE,
    codigo: '111111',
  })
  ok(corretoDuranteBloqueio.res.status === 401, 'código correto também é recusado durante o bloqueio')
  ok(
    /por segurança, aguarde/i.test(corretoDuranteBloqueio.corpo.erro || ''),
    'mensagem orienta aguardar (sem revelar detalhes)'
  )

  const hashAntesDoBloqueio = atual.codigoHash
  await post('/api/paciente/email/login', { email: EMAIL_TESTE }, { ip: `203.0.113.${randomInt(2, 250)}` })
  atual = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(atual.codigoHash === hashAntesDoBloqueio, 'e-mail bloqueado não recebe novo código')

  console.log('\n== Login válido e sessão ==')
  await semearCodigoConhecido(CODIGO_SENHA, { bloqueado: false, bloqueioAte: null, bloqueiosConsecutivos: 0 })
  const login = await post('/api/paciente/email/validar', { email: EMAIL_TESTE, codigo: CODIGO_SENHA })
  ok(login.res.status === 200 && login.corpo.sucesso === true, 'código correto cria a sessão')
  ok(Boolean(login.cookie), 'cookie de sessão enviado')
  ok(/HttpOnly/i.test(login.setCookie), 'cookie é HttpOnly')
  ok(/SameSite=Lax/i.test(login.setCookie), 'cookie tem SameSite=Lax por padrão')
  ok(!/;\s*Secure/i.test(login.setCookie), 'sem Secure fora de HTTPS (localhost)')
  ok(/Max-Age=1800/i.test(login.setCookie), 'sessão expira em 30 minutos')

  const reuso = await post('/api/paciente/email/validar', { email: EMAIL_TESTE, codigo: CODIGO_SENHA })
  ok(reuso.res.status === 401, 'código é de uso único')

  const sessao = await get('/api/paciente/email/sessao', { cookie: login.cookie })
  ok(sessao.res.status === 200, 'sessão válida é reconhecida')
  ok(sessao.corpo.paciente?.id === pacienteA.id, 'sessão devolve apenas o próprio paciente')
  ok(sessao.corpo.paciente?.agendamentos?.length >= 1, 'sessão lista as consultas ativas')
  ok(Boolean(sessao.corpo.paciente?.agendamentos?.[0]?.prazos), 'prazos vêm calculados do servidor')

  const alheioHorarios = await get(`/api/paciente/email/horarios?agendamentoId=${agendamentoB.id}`, {
    cookie: login.cookie,
  })
  ok(alheioHorarios.res.status === 404, 'não é possível ver horários de consulta de outro paciente')

  const alheioRemarcar = await post(
    '/api/paciente/email/remarcar',
    { agendamentoId: agendamentoB.id, data: '2026-12-20', horario: '10:00' },
    { cookie: login.cookie }
  )
  ok(alheioRemarcar.res.status === 404, 'não é possível remarcar consulta de outro paciente')

  const alheioCancelar = await post(
    '/api/paciente/email/cancelar',
    { agendamentoId: agendamentoB.id },
    { cookie: login.cookie }
  )
  ok(alheioCancelar.res.status === 404, 'não é possível cancelar consulta de outro paciente')

  console.log('\n== Diagnósticos ==')
  const diag = await get('/api/paciente/email/diagnosticos', { cookie: login.cookie })
  ok(diag.res.status === 200, 'diagnósticos liberados são retornados')
  ok(diag.corpo.diagnosticos?.length === 1, 'somente o registro liberado aparece')
  ok(diag.corpo.diagnosticos[0].id === liberada.id, 'registro liberado é o esperado')
  ok(!JSON.stringify(diag.corpo).includes('Nota interna'), 'nota interna não é exposta')
  const log = await prisma.logAcessoDiagnostico.findFirst({
    where: { pacienteId: pacienteA.id },
    orderBy: { criadoEm: 'desc' },
  })
  ok(Boolean(log) && log.quantidade === 1, 'acesso aos diagnósticos é auditado (LGPD)')

  const diagSemSessao = await get('/api/paciente/email/diagnosticos')
  ok(diagSemSessao.res.status === 401, 'diagnósticos exigem sessão no servidor')

  console.log('\n== Horários e remarcação ==')
  const horarios = await get(`/api/paciente/email/horarios?agendamentoId=${agendamentoA.id}`, {
    cookie: login.cookie,
  })
  ok(horarios.res.status === 200, 'horários livres são retornados')
  ok(Array.isArray(horarios.corpo.dias) && horarios.corpo.dias.length > 0, 'há dias com horários livres')
  const slots = horarios.corpo.dias.flatMap(dia => dia.slots)
  ok(slots.length > 0, 'há slots livres')
  ok(
    slots.every(s => Object.keys(s).sort().join(',') === 'dataHoraISO,horario'),
    'cada slot expõe apenas horário e instante'
  )
  const limite48h = Date.now() + 48 * 60 * 60 * 1000 - 60 * 1000
  ok(slots.every(s => new Date(s.dataHoraISO).getTime() >= limite48h), 'nenhum slot antes de agora + 48h')
  const jsonAgenda = JSON.stringify(horarios.corpo)
  ok(!jsonAgenda.includes(pacienteB.nome) && !jsonAgenda.includes(TELEFONE_B), 'agenda não expõe dados de outros pacientes')

  const diaEscolhido = horarios.corpo.dias.find(d => d.slots.length > 0)
  const slot = diaEscolhido.slots[0]
  const remarcar = await post(
    '/api/paciente/email/remarcar',
    { agendamentoId: agendamentoA.id, data: diaEscolhido.data, horario: slot.horario },
    { cookie: login.cookie }
  )
  ok(remarcar.res.status === 200 && remarcar.corpo.sucesso === true, 'remarcação com mais de 48h funciona')
  const noBanco = await prisma.agendamento.findUnique({
    where: { id: agendamentoA.id },
    include: { remarcacoes: true },
  })
  ok(noBanco.dataHora.toISOString() === slot.dataHoraISO, 'banco recebeu o novo horário')
  ok(noBanco.status === 'REMARCADO', 'status atualizado para REMARCADO')
  ok(noBanco.remarcacoes.length === 1 && noBanco.remarcacoes[0].por === 'paciente', 'histórico registra a remarcação do paciente')

  console.log('\n== Cancelamento ==')
  const cancelar = await post(
    '/api/paciente/email/cancelar',
    { agendamentoId: agendamentoA.id },
    { cookie: login.cookie }
  )
  ok(cancelar.res.status === 200 && cancelar.corpo.sucesso === true, 'cancelamento com mais de 48h funciona')
  const cancelado = await prisma.agendamento.findUnique({ where: { id: agendamentoA.id } })
  ok(cancelado.status === 'CANCELADO' && cancelado.canceladoPor === 'paciente', 'banco registra o cancelamento pelo paciente')

  console.log('\n== Cookie adulterado, privacidade e logout ==')
  const adulterado = `${login.cookie.slice(0, -2)}xx`
  const comAdulterado = await get('/api/paciente/email/sessao', { cookie: adulterado })
  ok(comAdulterado.res.status === 401, 'cookie adulterado é recusado')

  const semCookie = await get('/api/paciente/email/sessao')
  ok(semCookie.res.status === 401, 'sem cookie a sessão é recusada')

  const tentativas = await prisma.tentativaAcesso.findMany({ where: { emailHash: hashEmail(EMAIL_TESTE) } })
  ok(tentativas.length > 0, 'tentativas são auditadas')
  ok(tentativas.every(t => t.emailHash === hashEmail(EMAIL_TESTE)), 'auditoria usa hash do e-mail')
  ok(!JSON.stringify(tentativas).includes(EMAIL_TESTE), 'auditoria não guarda o e-mail completo')
  const codigoFinal = await prisma.codigoAcesso.findUnique({ where: { pacienteId: pacienteA.id } })
  ok(!codigoFinal.codigoHash.includes(CODIGO_SENHA), 'código puro não fica no banco')

  const logout = await post('/api/paciente/email/logout', {}, { cookie: login.cookie })
  ok(logout.res.status === 200, 'logout responde com sucesso')
  ok(new RegExp(`${COOKIE}=;`).test(logout.setCookie) || /Max-Age=0/i.test(logout.setCookie), 'logout limpa o cookie')

  console.log(`\n✅ TODOS OS ${passos} TESTES PASSARAM`)
} finally {
  // Limpeza: nenhum dado temporário permanece no banco.
  for (const paciente of [pacienteA, pacienteB]) {
    if (!paciente) continue
    await prisma.logAcessoDiagnostico.deleteMany({ where: { pacienteId: paciente.id } }).catch(() => {})
    await prisma.tentativaAcesso.deleteMany({ where: { emailHash: hashEmail(paciente.email) } }).catch(() => {})
    await prisma.codigoAcesso.deleteMany({ where: { pacienteId: paciente.id } }).catch(() => {})
    await prisma.remarcacao.deleteMany({ where: { agendamento: { pacienteId: paciente.id } } }).catch(() => {})
    await prisma.agendamento.deleteMany({ where: { pacienteId: paciente.id } }).catch(() => {})
    await prisma.anotacaoPaciente.deleteMany({ where: { pacienteId: paciente.id } }).catch(() => {})
    await prisma.paciente.deleteMany({ where: { id: paciente.id } }).catch(() => {})
  }
  for (const email of [EMAIL_TESTE, EMAIL_OUTRO]) {
    await prisma.limiteEnvioEmail.deleteMany({ where: { chave: hashEmail(email) } }).catch(() => {})
  }
  await prisma.$disconnect()
  console.log('\nDados temporários removidos.')
}
