# RESUMO — Pacote de melhorias (1.1–3.6)

Data: 27/10/2026 · Executado em modo autônomo, em fases, com commit ao fim de cada uma.
Build de produção OK (`npm run build` EXIT 0) e testes unitários estáveis 14/14 em todas as fases.

## 1. O que foi feito

### Fase A — Página pública (commit "Fase A: pagina publica (1.1-1.5)...")
- **1.1** Todos os e-mails/telefones clicáveis (`mailto:` e `tel:`), WhatsApp com `wa.me` + `noopener noreferrer`.
- **1.2** Rodapé reformulado: telefone/WhatsApp/e-mail em links; endereço sai do footer (fica no mapa, seção 1.3).
- **1.3** Seção "Onde nos encontrar" reorganizada: card **Contato** | **mapa do Google Maps** (iframe `output=embed`, `loading="lazy"`, botão "Abrir no Google Maps") e horários embaixo ocupando as duas colunas; no celular empilha na ordem contato → mapa → horários.
  - Fonte única de contato: novo **`src/lib/contato.ts`** (regra permanente 4 em `AGENTS.md`) — `WHATSAPP_NUMERO=5511964074862`, `TELEFONE_EXIBICAO=+55 11 96407-4862`, `ENDERECO=Avenida Pietro Petri, 601`, `LINK_LIGAR`, `linkWhatsApp()`, `MAPS_LINK`, `MAPS_EMBED_SRC`.
  - `getConfiguracoes` sobrescreve telefone/WhatsApp/endereço com `contato.ts` (valores antigos do painel/banco são ignorados). Sem placeholders `(XX) XXXX-XXXX` em lugar nenhum.
- **1.4** Botão flutuante de WhatsApp com o **SVG oficial** e `aria-label="Falar pelo WhatsApp"`.
- **1.5** Botão **"Informações do dia"** no header (desktop) e ícone compacto no mobile; abre modal que busca `/api/aviso-do-dia` (rota pública somente-leitura) e fecha por X, Esc e clique fora.

### Fase B — Consentimento no agendamento (2.1) (commit 6c67180)
- Botão **"Confirmar agendamento"** só ativa com nome ≥ 3 caracteres, telefone ≥ 10 dígitos **e** consentimento marcado (`disabled` + `opacity-40` + `title` explicativo).
- Servidor também recusa: `consentimentoLGPD: z.literal(true)` → 400 "É necessário aceitar o consentimento de uso dos dados".
- Correção durante a verificação: o spread `{ ...prev.dadosPaciente, [campo]: valor }` em `handleDadosChange` criava objeto parcial (só o primeiro campo digitado) e um `.replace` em `undefined` derrubava a hidratação de `/agendar` — agora os campos são inicializados com defaults e a validação do render usa fallbacks `|| ''`.

### Fase C — Cabeçalho admin e campo de senha (3.5 + 3.6) (commit ae64fbe)
- **3.5** Novo `MenuPainel.tsx`: título "Área da Dentista" à esquerda; Agenda / Serviços / Pacientes / Configurações (botões arredondados, página ativa com `bg-accent-100` + `aria-current`) e "Sair" discreto. No celular quebra linha (`flex-wrap`). O caminho do painel vem do servidor (`ADMIN_PATH` via props).
- **3.6** Login com cadeado fixo à esquerda e **botão de olho** à direita (`aria-label` Mostrar/Ocultar senha, `aria-pressed`, alterna `password`↔`text`).

### Fase D — Pacientes e Informações do dia (3.3 + 3.4) (commit 3a95884)
- **3.3** Prisma: `Paciente.consentimentoEm`, `Paciente.primeiroAgendamentoEm` e tabela nova **`AnotacaoPaciente`** (prontuário datado, `onDelete: Cascade`). Migração 100% aditiva e reversível documentada em `prisma/migracoes/2026-10-27-fase-d-consentimento-prontuario.md` (aplicada com `prisma db push`; projeto não usa pasta migrations).
  - POST `/api/agendamentos` cria/víncula o paciente ANTES e grava `consentimentoEm`/`primeiroAgendamentoEm` + `pacienteId`.
  - Aba Pacientes: ordem cronológica pelo 1º agendamento (sem `primeiroAgendamentoEm` vai pro fim, por nome), bloco **Cadastro** (consentimento e 1º agendamento com data/hora), **busca** e **prontuário datado** (GET/POST `/api/admin/pacientes/[id]/prontuario`, notas com data/hora, preservadas como histórico, texto puro).
  - Correção durante a verificação: filtro de busca por telefone chamado `includes('')` era sempre verdadeiro e fazia a busca por nome não filtrar — agora só compara dígitos quando a busca tem dígitos.
- **3.4** Campo **"Informações do dia"** nas Configurações (textarea 500 car. com contador, Salvar/Limpar) usando rota dedicada `PUT/DELETE /api/admin/aviso-do-dia` — não toca na rota geral de configurações (que apaga fotos e sobrescreve configs). O texto aparece no modal público **sempre como texto puro** (HTML inserido no painel aparece escapado).

### Fase E — Ações da agenda e remarcar via WhatsApp (3.1 + 3.2) (commit "Fase E: acoes da agenda...")
- **3.1** Confirmar / Concluir / Cancelar (com `window.confirm` mostrando nome do paciente e data) / Falta: atualizam o status **sem recarregar a página** (cópias locais das listas + toast `role="status"`). Cancelamento também remove o evento do Google Calendar quando existe; falha do Google nunca falha a ação. Botões só-ícone com `aria-label` + tooltip.
- **3.2** Relógio "Remarcar": abre o **WhatsApp do paciente** com número e mensagem montados **no servidor** (PATCH `/api/admin/agenda?id=...`) — número validado (11 dígitos ou DDI 55 + 11; senão 422 com mensagem clara) e mensagem com nome, serviço, data e hora em pt-BR.

## 2. Testes

- `npm run build` → EXIT 0 em todas as fases (incluindo as correções da verificação).
- `npx vitest run src/lib/enquadramento-editor.test.ts src/lib/rate-limit.test.ts` → **14/14 aprovados**.
- Testes **pré-existentes que já falhavam antes deste trabalho** (não alterados, fora do escopo): `disponibilidade.test.ts`, `AbaAgendamento.test.tsx`.
- Verificação no navegador (produção `next start` em `127.0.0.1:3110`):
  - **Pública `/`**: card Contato, mapa embed + botão Google Maps, `tel:`/`wa.me` corretos, sem "(XX)" nem número antigo, footer sem endereço, botão "Informações do dia". **Mobile 390×844 (iframe real)**: ícone compacto do aviso, modal dentro da tela, layout íntegro (screenshot).
  - **Modal 1.5**: vazio → "Nenhum aviso para hoje."; fecha por X/Esc/clique fora; aviso com `<b>` do painel aparece **escapado** (texto puro).
  - **Login/segurança**: sem sessão o login exibe APENAS o cartão; `/painel-dra-luciana` sem sessão não vaza título/menu; `/api/admin/*` sem sessão → **401**. "Informações do dia" só no header público.
  - **2.1**: botão começa `disabled` com `title`; ativa exatamente quando nome+telefone+consentimento OK; POST direto sem `consentimentoLGPD` → 400.
  - **3.1**: Falta → status "Faltou" sem recarregar + toast; Cancelar → diálogo com a mensagem certa, recusa mantém o status, aceitação cancela + toast. (Statuses de teste restaurados.)
  - **3.2**: PATCH devolve `https://wa.me/5511955554444?text=...` com mensagem correta; telefone inválido → 422 com mensagem clara.
  - **3.3**: busca por nome ("Pamela" → 1 linha) e por telefone ("98888" → 2 linhas certas); nota de prontuário criada datada (27/10/2026 17:54) e **persistida após restart do servidor** (nota de teste apagada em seguida).
  - **3.4**: aviso salvo via UI com contador e retornado por `/api/aviso-do-dia`.
- Infra: `next start` em `127.0.0.1:3110` ligado; **nenhum dado do painel exposto** (só 127.0.0.1 na 3110); **Cloudflare túnel parado** (0 processos `cloudflared`).

## 3. Decisões

1. **Fonte única de contato** em `src/lib/contato.ts` + override em `getConfiguracoes` (regra permanente 4): garante um só lugar para trocar número/endereço, mesmo que o banco tenha valores antigos.
2. **Commit por fase** substitui o histórico único (regra permanente 5 em `AGENTS.md`).
3. Migração 3.3 via `prisma db push` (padrão do projeto) com SQL de reversão documentado em `prisma/migracoes/`.
4. **3.4 em rota dedicada** (`/api/admin/aviso-do-dia`), porque POST `/api/admin/configuracoes` apaga fotos (`foto-dentista-*`) e sobrescreve configs — nunca usar em testes.
5. **3.1 no PUT já existente** de `/api/admin/agenda` (com `confirmadoEm/canceladoEm` e remarcar) + `excluirEvento` do Google no cancelamento; PUT duplicado criado por engano foi removido.
6. **3.2 com wa.me montado no servidor** (validação de celular com DDI/DDD) — o navegador só abre o link pronto.
7. `start-local.ps1` (script do responsável que apareceu na pasta) ficou fora dos commits (`.gitignore`), junto com `prisma/backup-*.db` (LGPD: dados de pacientes fora do git).
8. Correções achadas na verificação viraram um 6º commit ("Correção: hidratação..."): dados parciais do paciente em `AbaAgendamento` e filtro de busca de `AdminPacientes`.

## 4. Pendências

- ~~Testes pré-existentes falhando (`disponibilidade.test.ts`, `AbaAgendamento.test.tsx`)~~ **Corrigido (27/10, verificação independente)**: os 37 testes passam. Correções: testes chamavam `setHours` sem a hora e esperavam número de slots contra a semântica real (slots sobrepostos com intervalo < duração por design); trocado `vi.requireActual` (API Jest) por `vi.importActual`; `getConfiguracoes` agora usa fallback do React `cache` fora do App Router; `globals: true` no vitest (auto-cleanup do DOM); helpers puros de `disponibilidade.ts` exportados para os testes.
- Testes E2E Playwright não executados (cobertura via build + vitest + verificação manual no navegador).
- Quando o telefone/endereço mudar de novo: editar **somente** `src/lib/contato.ts`.
- Aviso do dia de teste ficou gravado no banco (`aviso_do_dia` com `<b>` escapado) — limpar em Configurações > Informações do dia quando quiser.

## 5. Como iniciar

```powershell
cd dentista-app
npm install            # primeira vez
npx prisma db push     # (re)aplica o schema no prisma/dev.db
npm run build          # build de produção
npx next start -H 127.0.0.1 -p 3110   # site + painel só em localhost
# desenvolvimento (NÃO usar junto com next start; o dev sobrescreve .next):
# npm run dev

# Acesso
# Site público:  http://127.0.0.1:3110/
# Agendamento:   http://127.0.0.1:3110/agendar
# Painel:        http://127.0.0.1:3110/painel-dra-luciana  (senha @J231209090301)
```

Regras do projeto: ver `AGENTS.md`. Backup pré-mudança: `prisma/backup-dev-20261027-171408.db` (fora do git).
