# AGENTS.md — Regras permanentes do projeto

Documentação para agentes de IA e desenvolvedores. Estas regras valem para
**qualquer alteração futura** deste projeto e só podem mudar com revisão
explícita do responsável pelo repositório.

## 🔐 Regra permanente 1 — A tela de login exibe APENAS o login

- A página de login (`src/app/(admin)/[adminPath]/login/page.tsx`) é envolvida
  APENAS pelo layout mínimo `src/app/(admin)/[adminPath]/layout.tsx`, que
  valida o segmento da URL e não renderiza NADA além do conteúdo da própria
  página.
- Na tela de login NÃO pode aparecer: menu (Agenda, Serviços, Pacientes,
  Configurações), subtítulo "Gerencie sua agenda, serviços e pacientes",
  título "Área da Dentista", formulários internos ou quaisquer outros dados
  do painel.
- É permitido exibir apenas: título simples ("Área Restrita") e o cartão com
  o campo de senha, o botão de entrar e mensagens de erro/aviso do próprio
  login.

## 🔐 Regra permanente 2 — Conteúdo do painel só após autenticação real

- Header, título, menu e subtítulo ficam em
  `src/app/(admin)/[adminPath]/(painel)/layout.tsx`.
- Esse layout chama `auth()` (NextAuth) no servidor e, sem sessão válida,
  faz `redirect()` para o login ANTES de renderizar qualquer conteúdo —
  o conteúdo interno nem chega a entrar no HTML entregue ao navegador.
- **Proibido** "esconder com CSS" (`hidden`, `display:none`, presença
  condicional no cliente, dados embarcados no bundle/hydration): o
  conteúdo interno não pode estar presente de forma alguma na página
  entregue sem autenticação.
- Cada página do painel também revalida a sessão no servidor
  (`const session = await auth(); if (!session?.user) redirect(...)`) antes
  de consultar dados, pois layout e página podem renderizar em paralelo no
  App Router.

## 🔐 Regra permanente 3 — Rotas administrativas exigem sessão válida no servidor

- Todo acesso a `/<ADMIN_PATH>/*` (páginas) é barrado pelo middleware
  (`src/middleware.ts`) com redirect para `/<ADMIN_PATH>/login` quando não
  há sessão.
- Toda rota em `src/app/api/admin/*` revalida a sessão no handler
  (`session?.user.role === 'admin'`) e responde **401 "Não autorizado/Acesso
  negado"** sem sessão válida — além da proteção do próprio middleware.
- Nenhuma consulta de dados do painel (Prisma ou arquivo) pode acontecer
  antes da verificação de sessão no servidor.
- Qualquer nova página/rota interna deve seguir EXATAMENTE este padrão:
  criar dentro do grupo `(painel)`, validar sessão no layout existente e
  revalidar na própria página/rota.

## 🗺️ Estrutura de rotas da área administrativa

```
src/app/(admin)/[adminPath]/
├── layout.tsx          # mínimo: valida o segmento (ADMIN_PATH) — nada de conteúdo
├── login/page.tsx      # SOMENTE o cartão de login
└── (painel)/           # exige sessão (layout abaixo exige auth() no servidor)
    ├── layout.tsx      # Header + título "Área da Dentista" + menu + subtítulo + Sair
    ├── page.tsx        # Agenda (dashboard)
    ├── servicos/       # CRUD de serviços
    ├── pacientes/      # lista com histórico
    └── configuracoes/  # geral, horários, regras, foto
```

## 🛠️ Manutenção

- Histórico do Git deve permanecer em **um único commit** (amend + push
  forçado, conforme acordado com o responsável).
- Ao alterar estruturas em `src/app/(admin)/`, rodar `npm run build`
  e `npx vitest run src/lib/enquadramento-editor.test.ts src/lib/rate-limit.test.ts`.
- Testes de navegador quando o fluxo de login/sessão mudar:
  1. Sem sessão: `/<ADMIN_PATH>` redireciona para o login; o HTML do login
     não contêm menu/título/subtítulo do painel.
  2. Com sessão: o painel exibe Header, título e menu.
  3. "Sair" ou expiração da sessão: volta a mostrar apenas o cartão de login.
