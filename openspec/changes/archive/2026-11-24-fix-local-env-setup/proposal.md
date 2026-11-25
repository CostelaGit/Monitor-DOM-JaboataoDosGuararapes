# Proposal

## Why

O guia interno de execução local (`dom-jaboatao-monitor/README.md`) omite a criação do arquivo `.env` a partir de `.env.example`, e o cliente de banco de dados (`src/lib/db.ts`) não possui fallback padrão para `DATABASE_URL` no ambiente local SQLite. Isso faz com que a inicialização do banco (`prisma db push`), a coleta (`npm run sync`) e o servidor web (`npm run dev`) falhem em novas instalações locais por ausência de `DATABASE_URL` e de `prisma/dev.db`.

## What Changes

- Garantir fallback seguro de `DATABASE_URL` (`"file:./dev.db"`) em `dom-jaboatao-monitor/src/lib/db.ts` quando a variável de ambiente não estiver definida no ambiente local.
- Adicionar script utilitário de preparação local (`db:setup` / inicialização de `.env` e SQLite) em `dom-jaboatao-monitor/package.json`.
- Alinhar as instruções de configuração local em `dom-jaboatao-monitor/README.md` com o `README.md` da raiz, incluindo explicitamente a criação do `.env` (`copy .env.example .env`) e o comando de inicialização do banco.

## Capabilities

### New Capabilities
- `local-setup`: Configuração de ambiente local, fallback seguro de conexão com o banco SQLite padrão (`file:./dev.db`) e documentação/scripts de inicialização local do monitor.

### Modified Capabilities

## Impact

- `dom-jaboatao-monitor/src/lib/db.ts`: definição de fallback para `process.env.DATABASE_URL` antes de instanciar `PrismaClient`.
- `dom-jaboatao-monitor/package.json`: adição de script de setup local para garantir `.env`, geração do Prisma Client e `prisma db push`.
- `dom-jaboatao-monitor/README.md`: inclusão do passo `copy .env.example .env` no guia de execução local.
