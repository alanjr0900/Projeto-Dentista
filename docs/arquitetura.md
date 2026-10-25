# Arquitetura — Consultório Dra. [Nome]

Visão geral da arquitetura e das regras de segurança permanentes. Regras de
comportamento para agentes de IA estão em [`AGENTS.md`](../AGENTS.md).

## Stack

- **Next.js 14 (App Router)** + TypeScript strict
- **Tailwind CSS** (design system em `tailwind.config.ts` + `globals.css`)
- **Prisma + SQLite** (dev) / PostgreSQL (prod) — `src/lib/prisma.ts` singleton
- **NextAuth v5** com provider de credenciais (senha única do `.env`),
  sessão **JWT em cookie HttpOnly** (`dentista-session`, 8h)
- Rate limiting de login em memória (`src/lib/rate-limit.ts`)
- Middleware central (`src/middleware.ts`): separação por host + guard de sessão
- Vitest (unitários) + Playwright (E2E)

## Estrutura de rotas

| Área | Caminho | Proteção |
|---|---|---|
| Site público | `/`, `/agendar`, APIs `/api/*` públicas | — (dados públicos do consultório) |
| Painel | `/<ADMIN_PATH>` (`.env`, ex.: `/painel-dra-luciana`) | middleware + layouts + páginas |
| Login do painel | `/<ADMIN_PATH>/login` | **sem** conteúdo interno |
| APIs admin | `/api/admin/*` | middleware (401 JSON) + revalidação em cada handler |
| Rota antiga | `/admin` (e filhos) | **404** proposital |

## Camadas de proteção da área administrativa

1. **Middleware** (`src/middleware.ts`)
   - Só responde `/<ADMIN_PATH>*` quando o segmento é exatamente `ADMIN_PATH`;
     qualquer outra coisa → 404.
   - Sem sessão: páginas internas → redirect para o login; `/api/admin/*` →
     401 JSON. Com sessão inválida/expirada, o mesmo tratamento.
   - Confia no Host apenas quando configurado (troca de host externa → 404).

2. **Layout mínimo** (`(admin)/[adminPath]/layout.tsx`)
   - Valida `ADMIN_SEGMENT` (decode URI, anti-confusão) → senão `notFound()`.
   - Não renderiza conteúdo interno: é this layout que permite ao login
     mostrar APENAS o cartão de login.

3. **Layout do painel** (`(admin)/[adminPath]/(painel)/layout.tsx`)
   - Chama `auth()` no servidor: sem sessão → `redirect(ADMIN_LOGIN_PATH)`;
     o HTML do painel (Header, título "Área da Dentista", menu Agenda/
     Serviços/Pacientes/Configurações, subtítulo e botão Sair) só é
     **renderizado** após sessão válida — não é ocultado com CSS.
   - Botão "Sair" (`src/components/admin/BotaoSair.tsx`) chama
     `next-auth/react.signOut`, apagando o cookie de sessão no servidor.

4. **Páginas individuais**
   - Cada página revalida a sessão antes de qualquer consulta a dados
     (Prisma/arquivo), pois layout e página podem renderizar em paralelo.

5. **APIs admin**
   - Cada handler valida `session.user.role === 'admin'` e responde 401
     ("Não autorizado" / acesso negado) sem sessão — inclusive rotas de
     upload, configurações, agenda, serviços, pacientes e enquadramento
     da foto.

6. **Consulta de dados** — nenhuma consulta do painel acontece antes de uma
   dessas verificações; dados públicos (`/api/servicos`, disponibilidade)
   expõem apenas informação de agenda pública.

## Fluxo de sessão

```
sem cookie válido ──► middleware ──► redirect /<ADMIN_PATH>/login
                                     └─ página minimalista (só cartão)
login POST /api/auth/callback/credentials ──► cookie HttpOnly (8h)
cookie válido ──► (painel)/layout renderiza header/menu/conteúdo
"Sair" ou expiração ──► cookie apagado ──► volta ao estado "só login"
```

## Decisões importantes

- **Ponto de foco + zoom da foto** (`src/lib/enquadramento-editor.ts` +
  `src/components/FotoDentista.tsx`): single source of truth — o editor
  renderiza com as mesmas regras CSS (`object-position` % + `scale` na
  origem do foco) das prévias e do site público. Não reintroduzir
  conversões em pixels no editor.
- **ADMIN_PATH único segmento**: `src/lib/constants.ts` normaliza; rota
  `/admin` reservada para 404. Nunca criar link do site público para o painel.
- **Timezone fixo**: `America/Sao_Paulo` (`src/lib/disponibilidade.ts`).
