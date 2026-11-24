# Plano de Busca e Coleta Paginada — Monitor DOM Jaboatão dos Guararapes

Este plano define como evoluir o sistema em `dom-jaboatao-monitor/` para **navegar, procurar e coletar informações respeitando toda a paginação real do portal oficial** (`https://diariooficial.jaboatao.pe.gov.br/`), tanto na listagem geral quanto na busca direta do site e nas páginas por ano — além de adicionar paginação real às telas do nosso próprio site.

---

## 1. Mapeamento Real da Paginação no Portal Oficial

Em verificação técnica direta no portal `diariooficial.jaboatao.pe.gov.br`, foram mapeados **3 mecanismos reais de paginação** (todos com **12 edições por página**, renderizados no servidor via HTML):

| Fluxo no Portal | Padrão de URL Real | Alcance Observado | Observação Técnica |
| :--- | :--- | :--- | :--- |
| **Listagem Geral (Home)** | `/?page=1` até `/?page=234` | ~2.800 edições (2015 a 2026) | Links de navegação: `1`, `2`, `3`, `Próxima`, `+10` e `Última` (`/?page=234`). |
| **Listagem por Ano (Categoria)** | `/category/diario-oficial-{ANO}?page=1` | Ex.: 2026 tem **19 páginas** (~220 edições) | Ideal para varrer um ano específico sem precisar percorrer páginas de anos anteriores. |
| **Busca Oficial do Portal** | `/?search={termo}&page=1` (`&page=2`, `&page=3`...) | Filtra em todo o histórico (2015–2026) | **Detalhe crítico encontrado:** os links das edições nos resultados de busca vêm com `?searchTerm={termo}` no final (ex.: `/2026/11/18/...?searchTerm=pregao`). |

> **Nota sobre o interior de cada edição:** cada página interna de edição (`/YYYY/MM/DD/...`) entrega o documento completo em uma única página HTML (não possui paginação interna); toda a paginação do portal ocorre nas telas de listagem, categoria anual e resultados de busca.

---

## 2. Limitações Atuais no Projeto (`dom-jaboatao-monitor`)

Comparando o código atual com a paginação real do portal:

1. **`src/lib/scraper/listParser.ts`:**
   - O regex `EDITION_PATH_REGEX` exige que o caminho relativo não tenha querystring. Em resultados de busca (`/?search=pregao&page=1`), os links relativos trazem `?searchTerm=pregao`, o que faria o parser atual descartar os resultados se usado na busca do portal.
   - Retorna apenas `maxPage`, sem informar explicitamente `currentPage`, `nextPage` e `hasNextPage`.
2. **`src/lib/syncService.ts`:**
   - Possui teto fixo de `10` páginas (`Math.min(pages, 10)`) e começa sempre na página `1`.
   - Não possui **parada antecipada (*early stop*)** quando uma página inteira já está salva no banco.
   - Não permite informar faixa de páginas (`startPage` → `endPage`), filtro por **ano** (`/category/diario-oficial-YYYY`), **intervalo de datas** (`dateFrom` → `dateTo`) nem **busca por termo** (`?search=...`).
3. **Páginas do nosso site (`/historico` e `/busca`):**
   - `/historico` limita a exibição a `take: 100` sem controles de paginação.
   - `/busca` pesquisa apenas nas edições já baixadas no SQLite local (e limita a `take: 80` sem paginação), não oferecendo opção de **"Procurar direto nas páginas do portal oficial"** para termos em edições ainda não coletadas.

---

## 3. Arquitetura dos 4 Modos de Busca e Coleta Paginada

### Modo 1 — Sincronização Incremental Inteligente (*Early Stop*)
Usado no dia a dia (botão "Sincronizar Agora" e Agendador/Cron):
- Percorre `/?page=1`, `/?page=2`, `/?page=3`...
- **Regra de parada:** assim que encontrar uma página completa cujas 12 edições já existam no banco local (e `forceResync` for `false`), encerra imediatamente a paginação sem desperdiçar requisições.
- Garante que, mesmo se o sistema ficar vários dias desligado (ex.: 25 novas edições acumuladas), ele avance automaticamente até a página 3 ou 4 até alcançar o ponto já coletado.

### Modo 2 — Coleta Paginada por Período ou Ano (`dateFrom`/`dateTo` ou `year`)
Usado quando o usuário quer analisar um mês, trimestre ou ano inteiro:
- **Por Ano:** usa diretamente `/category/diario-oficial-{ANO}?page=1..N` (para 2026, percorre apenas 19 páginas em vez de 234).
- **Por Intervalo de Datas (`dateFrom` até `dateTo`):** avança `page=1, 2, 3...`:
  - Ignora edições mais novas que `dateTo`;
  - Coleta todas as edições entre `dateFrom` e `dateTo`;
  - **Para automaticamente** assim que todas as edições de uma página forem mais antigas que `dateFrom` (aproveitando a ordenação cronológica decrescente do portal).

### Modo 3 — Busca Remota Paginada Direto no Portal Oficial
Resolve o cenário em que o usuário quer procurar um nome, empresa, decreto ou edital em **qualquer uma das ~2.800 edições (2015–2026)** sem precisar baixar todo o banco antes:
- Nova rota `GET /api/portal-search?q={termo}&page={N}`:
  - Consulta `https://diariooficial.jaboatao.pe.gov.br/?search={termo}&page={N}` em tempo real;
  - Extrai os 12 resultados daquela página, normaliza a URL (removendo `?searchTerm=...`), detecta se há Edição Extraordinária/Suplementar e cruza com o SQLite local para indicar quais já estão importadas;
  - Retorna `{ items, currentPage, nextPage, maxPage, hasNextPage }`.
- Na tela `/busca`, o usuário pode alternar entre:
  - **Aba "Banco Local (Atos Detalhados)"** — busca rápida dentro dos atos já classificados (com paginação real `?page=1, 2, 3...`);
  - **Aba "Procurar no Portal Oficial (2015–2026)"** — navega página por página nos resultados do site da prefeitura e oferece o botão **"Importar e Resumir Edição"** (ou **"Importar Página Inteira"**) que baixa, classifica e abre o resumo na hora.

### Modo 4 — Coleta Histórica por Faixa de Páginas com Retomada (*Backfill*)
Usado via CLI (`npm run sync`) ou painel avançado para montar acervo histórico maior:
- Aceita `--start-page=1 --end-page=20` ou `--year=2026` ou `--from=2026-01-01 --to=2026-11-24` ou `--search="concurso" --max-pages=5`.
- Salva progresso/checkpoint (`lastPageProcessed`, `totalPagesDetected`, `status`) em tabela `SyncLog` (ou `CrawlJob`) para retomar exatamente de onde parou em caso de erro de rede.
- Mantém *rate limiting* respeitoso (mínimo `650ms`–`1000ms` entre requisições) e `retries` com backoff exponencial.

---

## 4. Alterações Técnicas Planejadas

### 4.1. Parser de Listagem e Paginação (`src/lib/scraper/listParser.ts`)
- Limpar querystring (`href.split("?")[0]`) antes de aplicar `EDITION_PATH_REGEX`, suportando URLs de busca com `?searchTerm=...`.
- Extrair e retornar metadados completos de paginação:
  ```ts
  export interface ParsedListPage {
    items: EditionListItem[];
    currentPage: number;
    maxPage: number;
    hasNextPage: boolean;
    nextPage: number | null;
  }
  ```
- Suportar links de paginação de todos os formatos: `/?page=2`, `/?page=2&search=pregao` e `/category/diario-oficial-2026?page=2&categories=53`.

### 4.2. Motor de Coleta Paginada (`src/lib/syncService.ts` e `scripts/sync-cli.ts`)
- Estender `SyncOptions`:
  ```ts
  export interface SyncOptions {
    mode?: "incremental" | "pageRange" | "dateRange" | "year" | "search";
    startPage?: number;
    endPage?: number;
    maxPages?: number;
    limit?: number;
    dateFrom?: string; // YYYY-MM-DD
    dateTo?: string;   // YYYY-MM-DD
    year?: number;     // ex.: 2026
    searchTerm?: string;
    stopOnExistingPage?: boolean; // default true no modo incremental
    forceResync?: boolean;
  }
  ```
- Adicionar função `syncSingleEditionByUrl(url: string)` para importação sob demanda a partir da busca no portal (1 clique).
- Atualizar `scripts/sync-cli.ts` para aceitar flags:
  - `--mode=incremental|pageRange|dateRange|year|search`
  - `--start-page=1 --end-page=10`
  - `--year=2026`
  - `--from=2026-10-01 --to=2026-11-24`
  - `--search="licitação" --max-pages=5`

### 4.3. Novas Rotas de API
- **`GET /api/portal-search?q={termo}&page={N}`:** busca paginada ao vivo no portal oficial do DOM, indicando para cada edição encontrada se ela já existe no banco (`localEditionId`) e se é Extraordinária/Suplementar.
- **`POST /api/editions/import`:** recebe `{ url }` (ou lista de URLs) e importa/resume imediatamente a edição escolhida, retornando o `editionId` para redirecionar para `/edicoes/[id]`.
- **`GET /api/editions` e `GET /api/search`:** passar a retornar paginação real (`page`, `pageSize`, `total`, `totalPages`).

### 4.4. Interface Web (UX de Paginação e Busca)
1. **Página `/busca`:**
   - Alternador de fonte: **Banco Local** vs. **Portal Oficial (Busca Paginada 2015–2026)**.
   - Controles de paginação completos (`Anterior`, números de página, `Próxima`, indicador *"Página X de Y"*).
   - Nos resultados do Portal Oficial: badge `Já resumida` (link direto para `/edicoes/[id]`) ou botão `Importar e Resumir` (baixa na hora e abre o resumo completo).
2. **Página `/historico`:**
   - Paginação real de edições (`20` por página, mantendo o filtro `onlyExtra=true` na URL).
   - Painel expansível **"Coleta Avançada (Paginada)"** permitindo sincronizar por **Ano**, **Intervalo de Datas** ou **Faixa de Páginas** direto pela interface, com feedback do total de páginas percorridas e novas edições encontradas.

---

## 5. Etapas de Implementação (Roadmap)

### Etapa 1 — Upgrade do `listParser.ts` e Correção de Links com QueryString
- Normalizar `href` removendo `?searchTerm=...`.
- Retornar `currentPage`, `maxPage`, `hasNextPage` e `nextPage` para home, categoria anual e busca.
- Adicionar fixtures HTML reais de `/?search=pregao&page=1` e `/category/diario-oficial-2026?page=1` em `tests/fixtures/` + testes automatizados.

### Etapa 2 — Motor Paginado (`syncService.ts`, `syncSingleEditionByUrl` e `sync-cli.ts`)
- Implementar os 4 modos (`incremental` com *early stop*, `dateRange`, `year`, `pageRange` e `search`).
- Implementar importação unitária `syncSingleEditionByUrl(url)` para uso sob demanda.
- Adicionar testes unitários validando parada antecipada (*early stop*) e filtro por intervalo de datas.

### Etapa 3 — APIs de Busca Remota Paginada e Importação Sob Demanda
- Criar `GET /api/portal-search` e `POST /api/editions/import`.
- Adicionar paginação real (`page`, `pageSize`, `total`, `totalPages`) em `GET /api/editions` e `GET /api/search`.

### Etapa 4 — Interface Paginada em `/busca` e `/historico` + Validação Final
- Atualizar `/busca` com aba **Procurar no Portal Oficial (Paginado)** + botão **Importar e Resumir** + paginação real na busca local.
- Atualizar `/historico` com paginação real (`?page=N`) e painel de **Coleta Avançada por Ano / Período / Páginas**.
- Rodar `npm test`, `tsc --noEmit`, `npm run build` e testar busca paginada real contra o portal.

---

## 6. Critérios de Aceite

- Buscar um termo na aba **Portal Oficial** em `/busca` retorna resultados paginados de `diariooficial.jaboatao.pe.gov.br`, permite navegar entre páginas (`1, 2, 3...`) e importar/resumir qualquer edição antiga (ex.: de 2025 ou início de 2026) em 1 clique.
- `npm run sync -- --mode=incremental` percorre quantas páginas forem necessárias para pegar novidades e **para automaticamente** assim que atingir uma página já sincronizada.
- `npm run sync -- --mode=dateRange --from=2026-10-01 --to=2026-10-31` coleta exatamente o mês de outubro sem varrer o resto do portal.
- `/historico` e `/busca` possuem navegação paginada limpa sem limites fixos escondendo edições.
- Todos os testes automatizados (`npm test`) e o `npm run build` passam sem erros.
