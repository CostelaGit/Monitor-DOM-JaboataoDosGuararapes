# Monitor DOM — Jaboatão dos Guararapes

Aplicação web desenvolvida em **Next.js + TypeScript + Prisma (SQLite)** para coletar, classificar, pesquisar e resumir automaticamente as edições do **Diário Oficial do Município (DOM) de Jaboatão dos Guararapes** ([diariooficial.jaboatao.pe.gov.br](https://diariooficial.jaboatao.pe.gov.br/)).

---

## Principais Funcionalidades

- **Resumo Geral da Edição:** painel no topo do site com síntese automática do que foi publicado no dia (modo determinístico offline + suporte opcional a IA via `GEMINI_API_KEY`) e botão **Copiar Resumo (WhatsApp)**.
- **Classificação Automática nas Categorias Prioritárias:**
  - **Leis e Atos Normativos:** leis municipais/complementares, decretos (com destaque para créditos suplementares e valores), resoluções, instruções normativas e portarias normativas.
  - **Atos de Pessoal:** nomeações, exonerações, designações, aposentadorias e licenças, com contadores e tabela estruturada.
  - **Contratos, Editais e Avisos:** extratos de contrato, termos aditivos, licitações, dispensas, inexigibilidades, atas de registro de preços, notificações e links para anexos PDF externos.
- **Detecção de Edições Extras e Suplementares:** identificação automática por título, slug, numeração complementar (ex.: `196-A`), sufixo numérico (`-2`) e colisão de data, com banner de alerta, aviso cruzado entre edições do mesmo dia e filtro dedicado.
- **Busca Paginada (Local e Portal Oficial 2015–2026):**
  - Pesquisa paginada nos atos já classificados no banco local (`/busca`).
  - Busca ao vivo direto nas páginas do portal oficial (`/?search=...&page=N` e `/category/diario-oficial-{ANO}?page=N`), com botão **Importar e Resumir** em 1 clique.
- **Coleta Paginada Avançada (`/historico` e CLI):**
  - Modo incremental com parada antecipada (*early stop*), por período (`dateFrom`/`dateTo`), por ano, por faixa de páginas ou por termo.
  - Painel de saúde e logs de sincronização (`SyncLog`).

---

## Tecnologias Utilizadas

- **Frontend / Backend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Coleta e Parsing:** `fetch` nativo + Cheerio
- **Banco de Dados:** SQLite (desenvolvimento) / PostgreSQL (produção) via Prisma ORM 6
- **Testes:** `node:test` + `tsx` com fixtures HTML reais do portal

---

## Como Executar Localmente

```powershell
# 1. Entrar na pasta do projeto
cd dom-jaboatao-monitor

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
copy .env.example .env

# 4. Gerar Prisma Client e criar o banco SQLite
npx prisma generate
npx prisma db push

# 5. Sincronizar edições iniciais do DOM
npm run sync

# 6. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse: **http://localhost:3000**

---

## Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Inicia o servidor em modo produção |
| `npm test` | Executa os testes automatizados de regressão (`tests/*.test.ts`) |
| `npm run typecheck` | Executa checagem de tipos TypeScript (`tsc --noEmit`) |
| `npm run sync` | Sincroniza novas edições do DOM via CLI |
| `npm run db:push` | Aplica o schema Prisma no banco de dados |

### Exemplos de coleta paginada via CLI

```powershell
# Sincronização incremental (para automaticamente ao encontrar página já coletada)
npm run sync -- --mode=incremental --max-pages=5

# Coletar um intervalo de datas específico
npm run sync -- --mode=dateRange --from=2026-10-01 --to=2026-10-31 --max-pages=10

# Coletar por ano oficial
npm run sync -- --mode=year --year=2026 --max-pages=5 --limit=60

# Coletar edições que contenham um termo específico
npm run sync -- --mode=search --search=pregao --max-pages=3
```

---

## Automação e Deploy

### Agendador de Tarefas do Windows (08h, 12h, 16h e 20h)
```powershell
# Registrar tarefa automática diária
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1

# Remover tarefa automática
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-windows-task.ps1
```

### Vercel Cron / Docker / PostgreSQL
- **Vercel Cron:** `vercel.json` agenda chamadas para `/api/cron/sync` às `11h, 15h, 19h e 23h UTC` (`08h, 12h, 16h e 20h` no horário de Brasília). Configure `CRON_SECRET` ou `SYNC_SECRET` nas variáveis de ambiente.
- **Docker:**
  ```bash
  docker build -t dom-jaboatao .
  docker run -p 3000:3000 dom-jaboatao
  ```
- **PostgreSQL em produção:** em `prisma/schema.prisma`, altere `provider = "sqlite"` para `provider = "postgresql"`, configure `DATABASE_URL` e execute `npx prisma db push`.

---

## Estrutura do Projeto

```text
dom-jaboatao-monitor/
├── prisma/schema.prisma            # Modelagem (Edition, Act, Attachment, SyncLog)
├── scripts/
│   ├── sync-cli.ts                 # CLI de coleta paginada
│   ├── register-windows-task.ps1   # Agendador automático no Windows
│   └── unregister-windows-task.ps1
├── src/
│   ├── app/
│   │   ├── page.tsx                # Painel principal (Resumo da edição)
│   │   ├── edicoes/[id]/page.tsx   # Rota permanente de cada edição
│   │   ├── historico/page.tsx      # Histórico paginado, extras e coleta avançada
│   │   ├── busca/page.tsx          # Busca paginada (Local e Portal Oficial)
│   │   └── api/                    # sync, cron/sync, editions, import, portal-search, search
│   ├── components/                 # EditionDashboard, AdvancedSyncPanel, ActDetailModal, SyncButton
│   └── lib/
│       ├── scraper/                # fetcher, listParser, editionParser, extraDetector
│       ├── classifier/             # rules, metadataExtractor
│       ├── summarizer/             # deterministic, llm
│       ├── editionQueries.ts
│       └── syncService.ts
└── tests/                          # Testes automatizados e fixtures HTML reais
```

---

## Aviso Legal

Este sistema apresenta resumos automatizados para facilitar a consulta cidadã e administrativa. Para fins oficiais e jurídicos, consulte sempre a publicação integral em [diariooficial.jaboatao.pe.gov.br](https://diariooficial.jaboatao.pe.gov.br/).
