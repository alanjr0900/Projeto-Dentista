# Consultório Dra. [Nome] - Sistema de Agendamento

Landing page completa para consultório odontológico com agendamento online, apresentação da profissional e área administrativa.

## 🚀 Tecnologias

- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript** (strict mode)
- **Tailwind CSS** (design system customizado)
- **Prisma ORM** + **SQLite** (desenvolvimento) / PostgreSQL (produção)
- **NextAuth v5** (autenticação por credenciais)
- **Google Calendar API** (`googleapis`, conta de serviço) — fonte dos horários livres
- **Nodemailer** — e-mails de confirmação/cancelamento/remarcação (SMTP genérico)
- **Zod** (validação)
- **date-fns + date-fns-tz** (manipulação de datas/timezone)
- **Vitest** (testes unitários)
- **Playwright** (testes E2E)
- **ESLint + Prettier** (qualidade de código)

## 📦 Instalação e Execução

```bash
# 1. Clonar e entrar no diretório
cd dentista-app

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# 4. Inicializar banco de dados
npm run db:generate
npm run db:push
npm run db:seed

# 5. Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

O `.env.example` está 100% documentado — copie-o para `.env` e preencha. Resumo:

```env
# Banco de dados
DATABASE_URL="file:./dev.db"

# Autenticação Admin (GERE UMA SENHA SEGURA!)
ADMIN_PASSWORD="sua-senha-super-segura-aqui"
AUTH_SECRET="gere-com-openssl-rand-base64-32"
# URL própria do painel (não óbvia) + limite de tentativas
ADMIN_PATH="/painel-dra-luciana"
LOGIN_MAX_TENTATIVAS=5
LOGIN_BLOQUEIO_MINUTOS=15

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CLINICA_NOME="Consultório Dra. [Nome]"

# Timezone
TZ="America/Sao_Paulo"

# Google Calendar (vazio = agenda do banco; detalhes abaixo)
GOOGLE_CALENDAR_ID=""
GOOGLE_CLIENT_EMAIL=""
GOOGLE_PRIVATE_KEY=""

# E-mail (vazio = sem e-mails; detalhes abaixo)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""

# URL pública (links de gestão nos e-mails)
PUBLIC_BASE_URL="http://localhost:3000"
```

**Importante:** sem as credenciais de Google/SMTP **nada quebra** — o site
funciona com a agenda do banco (índice de pacientes + histórico) e os e-mails
são simplesmente ignorados. Configure em ordem, teste, e cresça a partir daí.

**Gerar senhas seguras:**
```bash
# Senha do admin
openssl rand -base64 32

# Secret do NextAuth
openssl rand -base64 32
```

### 🔐 Como a dentista acessa o painel

O site público **não tem nenhum link, botão ou ícone** para a área administrativa.
O painel continua no mesmo sistema (mesmo banco, mesma agenda), mas responde
apenas em uma URL própria, definida no `.env` pela variável `ADMIN_PATH`.

Neste projeto a URL está configurada como:

```
http://localhost:3000/painel-dra-luciana
```

Em produção, troque `http://localhost:3000` pelo domínio do site.

- A tela de login só abre nessa URL.
- A tela de login exibe **somente o cartão de login**: sem menu, sem título
  do painel, sem qualquer conteúdo interno antes da autenticação (regra
  permanente — ver `AGENTS.md` e `docs/arquitetura.md`).
- O conteúdo do painel (header, título, menu, subtítulo) só é **renderizado
  no servidor** após sessão validada — não é apenas escondido com CSS.
- A senha é a `ADMIN_PASSWORD` do `.env`.
- A rota antiga `/admin` (e qualquer `/admin/...`) responde **404**.
- Todas as rotas `/api/admin/*` continuam validando a sessão no servidor e
  respondem 401 (acesso negado) sem sessão válida.
- A sessão dura 8 horas; o botão **Sair** no painel encerra a sessão na hora.
- Após **5 tentativas erradas**, o login fica bloqueado por **15 minutos**
  (ajustável em `LOGIN_MAX_TENTATIVAS` e `LOGIN_BLOQUEIO_MINUTOS`).

#### Como trocar a URL do painel

1. Abra o `.env`.
2. Altere `ADMIN_PATH` para outro endereço de um único segmento. Exemplo:
   ```env
   ADMIN_PATH="/acesso-dra-luciana"
   ```
3. Reinicie o servidor (`npm run dev` ou `npm start`).
4. Guarde o novo endereço: ele não aparece em nenhum lugar do site público.
   Se perder a URL, consulte o `.env` no servidor.

> Não use `ADMIN_PATH="/admin"`: essa rota é reservada para responder 404.

### 📅 Google Calendar como fonte dos horários livres

Quando configurado, os horários livres mostrados no agendamento passam a respeitar
**tudo o que está no calendário da doutora** (consultas marcadas por telefone,
compromissos pessoais, etc.), e cada agendamento do site cria um evento no
calendário com nome, telefone, e-mail e motivo do paciente. O banco continua
sendo o índice de pacientes + histórico — o Google é a fonte da agenda do dia.

**Como ativar (conta de serviço — a forma mais simples para um calendário fixo):**

1. **Projeto**: acesse [console.cloud.google.com](https://console.cloud.google.com),
   crie um projeto (ex.: `dentista-agenda`).
2. **Ativar a API**: em *APIs e Serviços → Biblioteca*, busque **"Google Calendar API"**
   e clique em **Ativar**.
3. **Conta de serviço**: em *IAM e Administrador → Contas de serviço → Criar conta
   de serviço*: dê um nome (ex.: `agenda-site`), nenhum papel é necessário.
   Depois abra a conta criada → aba **Chaves → Adicionar chave → Criar nova
   chave → JSON**. Baixe o arquivo `.json` ( guarde com muito cuidado).
4. **Compartilhar o calendário**: no [Google Agenda](https://calendar.google.com)
   da doutora → engrenagem → *Configurações* → selecione o calendário →
   **Compartilhar com pessoas específicas** → *Adicionar pessoas*: cole o
   **e-mail da conta de serviço** (`nome@projeto.iam.gserviceaccount.com`,
   aparece no JSON como `client_email`) e dê permissão **Fazer alterações em
   eventos** (editor).
5. **Preencher o `.env`**:
   ```env
   GOOGLE_CALENDAR_ID="historia-da-doutora@gmail.com"   # ou um calendarId de calendário secundário
   GOOGLE_CLIENT_EMAIL="agenda-site@dentista-agenda.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
   ```
   > A chave privada entra no `.env` com os `\n` em UMA linha só — o código
   > converte para quebras reais automaticamente.

**O que muda com o Google ativo:**

- Dias/horários ocupados no calendário desaparecem do seletor do paciente
- Ao agendar, é criado um evento no calendário (título com nome e serviço,
  descrição com código/telefone/e-mail/observações, cor suave, lembretes 24h/2h)
- Cancelar no site remove o evento; remarcar move o evento
- Se o paciente informar e-mail, o próprio Google envia o convite
- Se o Google estiver fora do ar, o agendamento continua válido pelo banco e o
  erro fica registrado no log (o site não derruba)

### ✉️ E-mails de confirmação (SMTP)

Cada agendamento/cancelamento/remarcação dispara um e-mail ao paciente (quando
o e-mail foi informado), com o convite `.ics` para adicionar no próprio
calendário. Requer SMTP:

1. **Gmail (simples)**: ative a verificação em duas etapas e gere uma
   **senha de app** em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="clinica@gmail.com"
   SMTP_PASS="senha-de-app-gerada"
   SMTP_FROM="Consultório Dra. [Nome] <clinica@gmail.com>"
   ```
2. **Serviços com SMTP** (Resend, SendGrid, Brevo, Mailgun...): use host/porta/
   usuário/senha fornecidos por eles — o código é genérico.

> **LGPD:** os e-mails são enviados **somente** quando o paciente informa
> o e-mail no formulário, onde o consentimento é explícito.

### Personalização do Consultório

Todas as configurações podem ser alteradas em **Área Administrativa > Configurações** ou editando o arquivo `prisma/seed.ts` para valores padrão:

- **Dados da clínica**: nome e e-mail
- **Dados da dentista**: nome, CRO, foto (URL)
- **Horários de funcionamento**: por dia da semana, múltiplos períodos
- **Regras de agendamento**: duração padrão, antecedência mínima, limite de dias, intervalo entre horários
- **Serviços**: nome, descrição, duração, ordem, ativo/inativo

> ☎️ **Telefone/WhatsApp e endereço estão em `src/lib/contato.ts`** (fonte
> única, regra permanente — ver `AGENTS.md`). Os valores do banco/painel
> para esses campos são ignorados em favor da fonte única — altere o número
> ou o endereço APENAS nesse arquivo. Nenhum placeholder tipo `(XX) XXXX-XXXX`
> deve existir no projeto.

### Textos e Identidade Visual

- **Cores**: Edite `tailwind.config.ts` (paleta `primary` = azul-petróleo, `accent` = dourado)
- **Fontes**: `layout.tsx` usa `Playfair Display` (títulos) + `Inter` (corpo)
- **Textos públicos**: Componentes em `src/components/apresentacao/` e `src/components/agendamento/`
- **Foto da dentista**: Configure URL nas configurações ou substitua `public/images/dentista.jpg`

## 🏗️ Estrutura do Projeto

```
src/
├── app/
│   ├── (public)/           # Páginas públicas
│   │   ├── page.tsx        # Landing com abas (Agendamento | Apresentação)
│   │   ├── api/            # APIs públicas
│   │   └── ...
│   ├── (admin)/            # Área administrativa (protegida)
│   │   ├── [adminPath]/    # Segmento dinâmico = ADMIN_PATH do .env
│   │   │   ├── layout.tsx  # Mínimo: valida segmento, sem conteúdo interno
│   │   │   ├── login/      # SOMENTE o cartão de login
│   │   │   └── (painel)/   # Exige sessão no servidor (layout com auth())
│   │   │       ├── layout.tsx  # Header + título + menu + Sair (só pós-auth)
│   │   │       ├── page.tsx    # Dashboard/Agenda
│   │   │       ├── servicos/   # CRUD de serviços
│   │   │       ├── pacientes/  # Lista com histórico
│   │   │       └── configuracoes/
│   │   └── api/admin/      # APIs admin (validação de sessão em cada rota)
│   ├── admin/              # Rota antiga /admin -> 404 (notFound)
│   ├── layout.tsx          # Layout raiz + SEO/Schema.org
│   └── globals.css         # Estilos globais + design system
├── components/
│   ├── layout/             # Header, Footer, WhatsAppFloat, Tabs
│   ├── agendamento/        # Fluxo completo de agendamento (5 passos)
│   ├── apresentacao/       # Seções da apresentação da dentista
│   ├── admin/              # Componentes da área admin
│   └── ui/                 # Componentes base (Button, Input, Card...)
├── lib/
│   ├── prisma.ts           # Cliente Prisma (singleton)
│   ├── auth.ts             # NextAuth config
│   ├── constants.ts        # ADMIN_PATH (URL do painel) e utilitários
│   ├── rate-limit.ts       # Limite de tentativas de login
│   ├── config.ts           # Configurações centralizadas (cache)
│   ├── google/agenda.ts    # Integração Google Calendar (conta de serviço)
│   ├── email.ts            # E-mails de confirmação/cancelamento (Nodemailer)
│   ├── disponibilidade.ts  # Lógica de slots (banco + bloqueios + Google)
│   ├── validations.ts      # Schemas Zod
│   ├── utils.ts            # Helpers (telefone, data, rate-limit)
│   ├── contato.ts          # FONTE ÚNICA de telefone/WhatsApp/endereço/links (regra permanente)
│   ├── ics.ts              # Geração de arquivo .ics
│   └── whatsapp.ts         # Links WhatsApp com mensagem pré-preenchida
├── hooks/
│   └── useAgendamento.ts   # Estado do fluxo de agendamento
└── types/
    └── index.ts            # Tipos TypeScript compartilhados
```

## 🧪 Testes

```bash
# Testes unitários (lógica pura)
npm run test

# Testes em modo watch
npm run test:watch

# Testes E2E (requer build prévio)
npm run build
npm run test:e2e
```

### Cobertura de Testes

- **Lógica de disponibilidade** (`disponibilidade.test.ts`): slots, conflitos, bloqueios
- **Fluxo de agendamento** (`AbaAgendamento.test.tsx`): passos, validações
- **Utils**: formatação de telefone, datas

## 📋 Funcionalidades

### Público (Pacientes)

1. **Agendamento guiado em 5 passos**:
   - Escolha do serviço
   - Calendário com dias disponíveis
   - Horários livres calculados em tempo real (respeitando o Google Calendar quando ativo)
   - Dados do paciente (nome, WhatsApp, e-mail, observações, LGPD)
   - Confirmação com código, .ics e WhatsApp

2. **Cancelar/Remarcar**: Código + telefone, respeita antecedência mínima (e sincroniza o evento no Google)

3. **Apresentação da Dra.**: Sobre, jeito de atender, tratamentos, depoimentos, FAQ, localização

4. **Acessibilidade**: WCAG 2.1 AA, navegação por teclado, foco visível, contraste, ARIA

### Administrativo (Dentista)

- **Login seguro**: Senha única via env, cookie HttpOnly, rate limiting
- **Agenda**: Visão dia, semana, lista com filtros
- **Ações**: Confirmar, concluir, cancelar, remarcar, marcar falta
- **Bloqueios**: Férias, plantões, recorrentes (ex: quartas no posto)
- **Serviços**: CRUD completo com ordenação
- **Configurações**: Tudo em um lugar (geral, horários, regras)
- **Pacientes**: Lista com histórico, anotações internas, export CSV
- **Exportação**: Agenda e pacientes em CSV

## 🔒 Segurança e LGPD

- Validação server-side com Zod em **todas** as rotas
- Rate limiting por IP + honeypot nos formulários
- Autenticação apenas server-side (middleware + NextAuth)
- **Tela de login minimalista**: apenas cartão de login — menu, título e
  subtítulo do painel só existem no HTML após sessão válida no servidor
  (regra permanente em `AGENTS.md` e `docs/arquitetura.md`)
- Rotas e APIs administrativas exigem sessão válida no servidor em duas
  camadas (middleware + revalidação por página/rota), respondendo acesso
  negado quando não há sessão
- Headers de segurança (CSP, X-Frame-Options, etc.)
- Consentimento LGPD explícito no agendamento
- Dados mínimos necessários, exclusão sob demanda
- Timezone fixo: `America/Sao_Paulo`

## 🚀 Deploy

### Vercel (Recomendado)

1. Push para GitHub
2. Import no Vercel
3. Adicione variáveis de ambiente
4. **Banco**: Use **Vercel Postgres** ou **Neon** (PostgreSQL)
   - Altere `DATABASE_URL` no Vercel
   - No `schema.prisma`: `provider = "postgresql"`
   - Rode `npx prisma migrate deploy` no build

### VPS (Docker)

```dockerfile
# Dockerfile.example
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate && npx prisma migrate deploy
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build e run
docker build -t dentista-app .
docker run -d -p 3000:3000 --env-file .env dentista-app
```

## 📝 Checklist de Produção

- [ ] Alterar `ADMIN_PASSWORD` e `AUTH_SECRET` no .env
- [ ] Configurar banco PostgreSQL real
- [ ] Substituir placeholders: nome, CRO, endereço, foto
- [ ] Configurar Google Calendar (conta de serviço; ver seção acima) e `PUBLIC_BASE_URL`
- [ ] Configurar SMTP real (SMTP_HOST/USER/PASS/FROM) e testar envio
- [ ] Configurar domínio e HTTPS
- [ ] Testar fluxo completo: agendar → e-mail/ics → cancelar/remarcar
- [ ] Verificar e-mails/WhatsApp de confirmação
- [ ] Configurar backups do banco
- [ ] Monitorar logs de erro

## 🔮 Melhorias Futuras

1. **Lembretes automáticos**: WhatsApp/E-mail 24h e 2h antes (via cron job + Evolution API ou Twilio)
2. **Integração bidirecional com Google Calendar**: importar eventos criados no Agenda direto para o painel
3. **Prontuário digital**: Anexo de radiografias, odontogramas, evoluções
4. **Pagamento online**: PIX/Stripe para sinal ou pagamento antecipado
5. **App mobile**: PWA com notificações push
6. **Múltiplos profissionais**: Suporte a clínicas com várias dentistas
7. **Relatórios**: Financeiros, ocupação, pacientes recorrentes
8. **Teleodontologia**: Videochamada integrada para triagem

## 📄 Licença

MIT - Uso livre para fins comerciais e não-comerciais.

---

**Desenvolvido com carinho para a Dra. [Nome] ❤️**

*Para dúvidas ou suporte, consulte a documentação do Next.js, Prisma e NextAuth.*