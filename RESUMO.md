# Resumo das Alterações - Aba "Minha Consulta"

## Fase 2 — Login por código no e-mail (OTP) e preparação para domínio próprio

### O que foi feito
- **Login por código no e-mail (OTP):** a aba pública `/minha-consulta` passou a
  autenticar pelo e-mail informado. Se o e-mail estiver cadastrado, o servidor
  gera um código de 6 dígitos e envia pelo SMTP configurado (Brevo).
- **Resposta neutra:** exista ou não o e-mail, a resposta é sempre
  `Se este e-mail estiver cadastrado, enviamos um código de acesso.` com o
  mesmo corpo e tempo mínimo (`OTP_TEMPO_RESPOSTA_MS`, padrão 800 ms). O envio
  SMTP roda fora do caminho da resposta para não revelar a existência do e-mail
  pelo tempo.
- **Segurança do código:** gerado com `crypto.randomInt` (faixa completa
  000000–999999), validade de 10 minutos, uso único, novo código invalida o
  anterior. No banco fica apenas o hash HMAC-SHA256 (`AUTH_SECRET` ou
  `OTP_HASH_SECRET`).
- **Tentativas e bloqueios:** 5 tentativas erradas invalidam o código; 3 códigos
  invalidados seguidos bloqueiam novos pedidos para aquele e-mail por 30 minutos.
- **Limites de envio (no servidor):** 3 códigos por e-mail/hora, 10 pedidos por
  IP/hora e intervalo mínimo de 60 s entre reenvios (com contagem regressiva no
  botão). IP real lido de cabeçalho configurável (`IP_HEADER`, padrão
  `x-forwarded-for` → `cf-connecting-ip` → `x-real-ip`).
- **Sessão do paciente:** cookie `HttpOnly` assinado, `SameSite` configurável,
  `Secure` automático em HTTPS, 30 minutos de inatividade (renovado a cada
  requisição autenticada) e botão **Sair**. A sessão é do paciente — não de um
  agendamento.
- **Rotas do paciente (OTP):** `/api/paciente/email/login`, `validar`, `sessao`,
  `logout`, `diagnosticos`, `horarios`, `remarcar`, `cancelar` e
  `/api/paciente/otp/limpeza`. Todas revalidam a sessão no servidor e conferem
  que o agendamento pertence ao paciente autenticado.
- **Camada de e-mail isolada:** `src/lib/email/service.ts` +
  `src/lib/email/providers/brevo.ts` (SMTP genérico). Trocar de provedor exige
  mexer só nessa camada e ajustar `EMAIL_PROVIDER`. Chaves e remetente ficam
  somente em `.env`/`.env.local`.
- **Logs sem dados sensíveis:** `src/lib/log-seguro.ts` mascara e-mails e
  códigos de 6 dígitos em qualquer mensagem de erro antes de logar.
- **Regra de agendamento por e-mail:** se o e-mail já existe, o novo agendamento
  só é aceito com o mesmo nome, ignorando maiúsculas, acentos e espaços extras
  (`src/lib/nome-pessoa.ts`). Telefone não participa dessa validação.
- **Tabelas novas/ajustadas:** `CodigoAcesso.bloqueiosConsecutivos`,
  `LimiteEnvioEmail`, `LimiteEnvioIp.janelaInicio`, `TentativaAcesso` e
  `LogAcessoDiagnostico.agendamentoId` opcional. A limpeza apaga códigos
  expirados, contadores antigos e auditoria vencida (automática no login, no
  máximo 1x/hora, e pelo endpoint de limpeza protegido por `CRON_SECRET`).
- **Preparação para domínio próprio:** nenhuma URL/remetente fixo no código.
  `.env.example` e README documentam `PUBLIC_SITE_URL`, `SMTP_FROM`,
  `PACIENTE_COOKIE_DOMAIN`, `IP_HEADER` e o passo a passo de DNS no Brevo
  (SPF, DKIM, DMARC).
- **UI:** tela de login por e-mail com código de 6 dígitos, aviso curto de
  privacidade, painel de consultas, diagnósticos liberados, escolha de novo
  horário, cancelamento e logout.

### Decisões Tomadas
- **Rotas legadas preservadas:** o acesso por código de agendamento continua
  funcionando; o fluxo OTP foi adicionado em paralelo sob `/api/paciente/email/`.
- **E-mails duplicados:** quando há mais de um cadastro com o mesmo e-mail, o
  sistema escolhe de forma determinística o de atividade mais recente (última
  consulta ou atualização), evitando acesso "alternado" entre registros.
- **Envio assíncrono:** o login dispara o e-mail sem aguardar o SMTP; mesmo que
  o provedor falhe, a resposta permanece neutra e o código pode ser reenviado.
- **Build em VPS pequena:** `next.config.js` usa 1 worker de build
  (`experimental.cpus: 1`, sem worker thread, sem file tracing) e o
  type-check roda separado por `npm run typecheck`.
- **Validação de tipos fora do build:** `typescript.ignoreBuildErrors` e
  `eslint.ignoreDuringBuilds` ficam ligados apenas porque o worker de tipos do
  Next é encerrado por memória nesta máquina; a validação real é feita por
  `npx tsc --noEmit` e `npx vitest run`.

### Testes Realizados
- **Unitários:** 76 testes via Vitest (12 arquivos), todos passando.
- **Tipos:** `npx tsc --noEmit` sem erros.
- **Integração:** 65 verificações via `scripts/teste-otp.mjs` contra o servidor
  de produção na porta 3110 — resposta neutra (corpo e tempo), limites por
  e-mail/IP/intervalo, 5 tentativas, 3 bloqueios e 30 minutos, login válido,
  cookie HttpOnly/SameSite/Max-Age, sessão, posse do agendamento (404 para
  consulta de outro paciente), diagnósticos com auditoria, horários, remarcação,
  cancelamento, cookie adulterado, logout e ausência de código/e-mail em claro.
- **SMTP real:** envio de teste aceito pelo Brevo (`250 OK`), sem código e sem
  e-mail completo em log.
- **Build:** `npm run build` concluído com `EXIT=0`, servindo o novo build em
  `http://localhost:3110` e pelo túnel público.

### Correção aplicada após validação
- **Erro "Application error: a client-side exception has occurred"** na aba
  `/minha-consulta` logo após o paciente validar o código com sucesso: a resposta
  de `GET /api/paciente/email/sessao` colocava `agendamentos` no nível raiz do
  JSON (`{ paciente: {...}, agendamentos: [...] }`), enquanto a tela esperava
  `paciente.agendamentos`. O `undefined` explodia no render do painel
  (`paciente.agendamentos.find`). Correção: `agendamentos` agora vem embutido em
  `paciente`, com fallback defensivo no cliente. Após o fix, os 65 testes de
  integração OTP passaram novamente (incluindo "sessão lista as consultas
  ativas").

### Pendências
- **Domínio próprio:** comprar/apontar o domínio, verificar SPF/DKIM/DMARC no
  Brevo e trocar as variáveis (`PUBLIC_SITE_URL`, `SMTP_FROM`,
  `PACIENTE_COOKIE_DOMAIN`, `IP_HEADER`) — passo a passo no README.
- **Agendador da limpeza:** opcional; agendar `POST /api/paciente/otp/limpeza`
  com `CRON_SECRET` em produção.
- **Pendência de infraestrutura:** o worker de tipos do `next build` é
  encerrado por memória nesta máquina; o build é válido e o type-check é feito
  pelo comando dedicado.

---

# Fase 1 — Acesso por código de agendamento

## O que foi feito
- **Acesso do Paciente:** Criada página `/minha-consulta` com login via código de agendamento (8 chars, seguro) e segundo fator (data de nascimento ou 4 dígitos do telefone).
- **Segurança:** Sessão curta (15 min) em cookie assinado (HMAC), rate limit por IP/código com bloqueio temporário e mensagens genéricas (anti-enumeração).
- **Diagnósticos:** Aba de diagnósticos que exibe apenas notas do prontuário marcadas como "Liberado para o paciente" no painel admin. Acesso registrado em log (LGPD).
- **Gestão de Agendamento:** Funcionalidades de remarcar e cancelar integradas ao Google Calendar e banco de dados, com histórico de alterações.
- **Prazos (48h):** Implementação rigorosa de antecedência mínima de 48h para alterações, centralizada em `src/lib/prazos.ts`.
- **UI/UX:** Interface responsiva, sofisticada e acolhedora, com ícone de acesso rápido no Header mobile e link no desktop.
- **Admin:** Adicionado controle de liberação no prontuário e campo de data de nascimento (opcional) no cadastro de pacientes e formulário de agendamento.

## Decisões Tomadas
- **Prazo de Cancelamento:** Definido como 48h (mesmo do reagendamento) para consistência, conforme permissão no briefing.
- **Segunda Identidade:** Aceita múltiplos formatos de data (DD/MM/AAAA, ISO, sem separadores) para facilitar o acesso.
- **Transição de Códigos:** Backfill automático converteu códigos `cuid()` e códigos com caracteres ambíguos para o novo padrão seguro.

## Testes Realizados
- **Unitários:** 59 testes via Vitest (identidade, prazos, rate-limit, sessões, códigos).
- **Integração:** 41 passos validados via script `teste-minha-consulta.mjs` no servidor de produção (login, bloqueios 48h, privacidade da agenda, log LGPD).
- **Build:** `npm run build` executado sem erros.

## Pendências
- (Nenhuma) Sistema testado e em produção na porta 3110.
