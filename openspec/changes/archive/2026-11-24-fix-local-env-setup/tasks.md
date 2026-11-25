# Tasks

## 1. Fallback de Banco de Dados Local e Testes

- [x] 1.1 Atualizar `dom-jaboatao-monitor/src/lib/db.ts` para definir `process.env.DATABASE_URL = "file:./dev.db"` quando `DATABASE_URL` não estiver definida no ambiente, e verificar com `npm run typecheck` que a tipagem passa sem erros.
- [x] 1.2 Adicionar teste automatizado em `dom-jaboatao-monitor/tests/parser.test.ts` (ou arquivo de teste dedicado) validando o fallback de `DATABASE_URL` e verificar que `npm test` passa integralmente.

## 2. Script de Preparação Local e Documentação

- [x] 2.1 Adicionar script `db:setup` em `dom-jaboatao-monitor/package.json` que garante a criação de `.env` a partir de `.env.example` (se ausente), executa `prisma generate` e `prisma db push`, e verificar executando `npm run db:setup` que `.env` e `prisma/dev.db` são criados.
- [x] 2.2 Atualizar `dom-jaboatao-monitor/README.md` incluindo o passo `copy .env.example .env` (e referência ao `npm run db:setup`) na seção "Como executar localmente", e verificar que a sequência documentada corresponde aos scripts de `package.json`.
