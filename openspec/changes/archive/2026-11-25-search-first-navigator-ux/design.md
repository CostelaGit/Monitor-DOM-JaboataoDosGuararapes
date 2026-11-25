# Design

## Context

O Monitor DOM (`dom-jaboatao-monitor`) utiliza Next.js 15 (App Router) com Server Components para carregar os dados iniciais da edição em `src/app/page.tsx` (`loadEditionDashboardData`) e Client Components para interatividade (`EditionDashboard.tsx` e `src/app/busca/page.tsx`). Atualmente:
- A rota `/` renderiza apenas `EditionDashboard`, cujo campo de filtro (`localQuery`) atua somente em memória sobre `edition.acts` da edição aberta.
- A rota `/busca` contém toda a lógica de busca transversal (`/api/search` para atos locais e `/api/portal-search` + `/api/editions/import` para o portal oficial 2015–2026), mas exige que o usuário saia da Home e alterne manualmente entre duas abas com estados e formulários independentes.

Consulte `proposal.md` para a motivação completa da mudança para o modelo Search-First ("Barra como Navegador + Radar de Hoje").

## Goals / Non-Goals

**Goals:**
- Tornar a barra de pesquisa no topo da Home (`/`) o ponto focal de navegação sobre o conteúdo dos Diários Oficiais de Jaboatão dos Guararapes.
- Exibir o resumo da edição do dia logo abaixo da barra como **"Radar de Hoje"** quando nenhuma busca transversal estiver ativa, substituindo-o dinamicamente pelos resultados quando o usuário pesquisar.
- Unificar a experiência de pesquisa para que um único termo digitado na barra consulte os atos classificados localmente (`/api/search`) e as edições do portal oficial (`/api/portal-search`), mantendo a importação em 1 clique (`/api/editions/import`).
- Oferecer chips de navegação rápida (atalhos de 1 clique para temas recorrentes do DOM) e um cabeçalho de síntese nos resultados (quantidade de atos, órgãos envolvidos e soma de valores em `R$` encontrados na página).
- Sincronizar o estado da busca com query params (`/?q=...&category=...&onlyExtra=...`) para que links de pesquisa funcionem diretamente na Home e a rota `/busca` reutilize ou redirecione para a mesma experiência unificada.

**Non-Goals:**
- Não alterar o schema do banco de dados SQLite/Prisma nem o pipeline de scraping/classificação existente.
- Não remover a rota permanente de leitura de uma edição específica (`/edicoes/[id]`) nem a página de histórico/coleta avançada (`/historico`).

## Decisions

### 1. Componente Orquestrador `DomSearchNavigator` na Home (`/`)
- **Decisão:** Criar um componente client-side `DomSearchNavigator` (`src/components/DomSearchNavigator.tsx`) que recebe os dados pré-carregados da edição do dia (`EditionDashboardProps`) vindos do Server Component `src/app/page.tsx` (bem como parâmetros iniciais de busca `initialQuery`, `initialCategory`, `initialOnlyExtra` lidos de `searchParams`).
- **Racional:** Preserva o carregamento SSR instantâneo do "Radar de Hoje" ao abrir `/` sem busca ativa, ao mesmo tempo em que permite transição imediata no cliente quando o usuário digita/submete uma pesquisa ou clica em um chip de atalho.
- **Alternativas consideradas:**
  - *Redirecionar toda busca da Home para `/busca` via router.push:* descartado como fluxo primário porque quebra a sensação de "Radar de Hoje que dá lugar aos resultados na mesma tela" pedida pelo usuário. Ainda assim, a URL será atualizada (`window.history.replaceState` ou `router.replace`) e a rota `/busca` continuará funcionando para compatibilidade.

### 2. Pesquisa Unificada em Uma Única Barra (Local + Portal Oficial em Paralelo)
- **Decisão:** Quando o usuário submete uma pesquisa na barra principal:
  1. Dispara em paralelo a busca no banco local (`GET /api/search?q=...&category=...&onlyExtra=...&page=1`) e, quando houver termo textual ou ano selecionado, a consulta paginada ao portal oficial (`GET /api/portal-search?q=...&page=1`).
  2. Exibe um **Painel de Síntese do Termo Navegado** no topo dos resultados (total de atos locais encontrados, soma de valores monetários `R$` nos atos listados, secretarias identificadas e total de páginas no portal oficial).
  3. Apresenta os resultados em duas seções coordenadas com alternância rápida ou visão combinada: **Atos Classificados no Banco Local** (em destaque imediato) e **Edições no Portal Oficial (2015–2026)** (com badge *"Já resumida"* ou botão *"Importar e Resumir"* em 1 clique, e aviso automático caso o banco local tenha 0 resultados mas o portal oficial tenha edições).
- **Racional:** Elimina a fricção de digitar o termo duas vezes ou adivinhar se uma matéria antiga já está sincronizada no banco local ou só existe no portal oficial.

### 3. Chips Rápidos de Exploração ("Navegação sem digitar")
- **Decisão:** Abaixo do input principal da Omnibox, disponibilizar chips clicáveis que acionam buscas pré-configuradas com 1 clique:
  - *Nomeações* (`q="Nomear"`, `category="ATOS_DE_PESSOAL"`)
  - *Exonerações* (`q="Exonerar"`, `category="ATOS_DE_PESSOAL"`)
  - *Licitações e Pregões* (`q="Pregão"`, `category="CONTRATOS_EDITAIS_AVISOS"`)
  - *Contratos e Aditivos* (`q="Contrato"`, `category="CONTRATOS_EDITAIS_AVISOS"`)
  - *Créditos Suplementares* (`q="Crédito"`, `category="LEIS_E_ATOS_NORMATIVOS"`)
  - *Edições Extras* (`onlyExtra=true`)
- **Racional:** Permite usar a barra como navegador temático mesmo quando o cidadão ou analista não tem um nome específico em mente.

### 4. Relação entre o Filtro Interno da Edição e a Barra Principal
- **Decisão:** No modo **"Radar de Hoje"** (quando nenhuma busca global está ativa), o `EditionDashboard` continua exibindo um cabeçalho claro identificando *"Radar de Hoje — Resumo da Edição de [Data] (Nº [X])"*, mantendo seu filtro rápido de atos daquela edição específica, enquanto a Hero Omnibox no topo deixa explícito que pesquisa em **todos os Diários Oficiais (Banco Local + Portal 2015–2026)**.

## Risks / Trade-offs

- **[Latência variável do Portal Oficial (`diariooficial.jaboatao.pe.gov.br`)]** → A busca no banco local SQLite responde em poucos milissegundos, enquanto o portal oficial pode levar 1–3 segundos ou estar temporariamente indisponível. **Mitigação:** Executar `runLocalSearch` e `runPortalSearch` de forma independente (estados `localLoading` e `portalLoading` separados), renderizando os atos locais imediatamente enquanto o bloco do portal oficial exibe seu indicador próprio de carregamento ou erro isolado sem bloquear os resultados locais.
- **[Banco local inicialmente vazio em nova instalação]** → Mesmo se ainda não houver edições sincronizadas localmente (`data.empty`), a Hero Omnibox deve continuar visível no topo da Home para que o usuário já possa pesquisar diretamente no Portal Oficial (2015–2026) e importar edições com 1 clique, além do botão de coleta inicial no Radar de Hoje.
