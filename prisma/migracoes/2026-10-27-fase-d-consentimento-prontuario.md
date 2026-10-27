# Migração da Fase D — consentimento, primeiro agendamento e prontuário datado

Data: 2026-10-27 · SQLite (`prisma/dev.db`)

## O que mudou (aditivo, reversível)

O projeto não usa pasta `prisma/migrations` (o fluxo é `prisma db push`).
A alteração abaixo é **100% aditiva**: 2 colunas novas e nulas em `Paciente`
e a tabela nova `AnotacaoPaciente`. Nada existente é alterado ou apagado.

1. `Paciente.consentimentoEm` (DateTime nulo) — data/hora do consentimento LGPD.
2. `Paciente.primeiroAgendamentoEm` (DateTime nulo) — base da ordem cronológica.
3. `model AnotacaoPaciente` — prontuário datado (texto + criadoEm), com
   `onDelete: Cascade` (excluir paciente apaga as notas dele).

Aplicado com: `npx prisma db push` (executa `PRAGMA foreign_keys` etc. e
regenera o Prisma Client).

## SQL equivalente (SQLite)

```sql
CREATE TABLE "AnotacaoPaciente" (
  "id"         TEXT PRIMARY KEY,
  "pacienteId" TEXT NOT NULL REFERENCES "Paciente"("id") ON DELETE CASCADE,
  "texto"      TEXT NOT NULL,
  "criadoEm"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AnotacaoPaciente_pacienteId_criadoEm_idx" ON "AnotacaoPaciente"("pacienteId", "criadoEm");

ALTER TABLE "Paciente" ADD COLUMN "consentimentoEm"       DATETIME;
ALTER TABLE "Paciente" ADD COLUMN "primeiroAgendamentoEm" DATETIME;
```

## Reverter (SQLite 3.35+)

```sql
DROP TABLE IF EXISTS "AnotacaoPaciente";
ALTER TABLE "Paciente" DROP COLUMN "consentimentoEm";
ALTER TABLE "Paciente" DROP COLUMN "primeiroAgendamentoEm";
```

Backup anterior à mudança: `prisma/backup-dev-20261027-171408.db`
(não versionado; contém dados de pacientes — LGPD).
