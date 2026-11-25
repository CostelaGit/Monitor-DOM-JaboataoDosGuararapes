# Proposal

## Why

Atualmente a aplicação adota um modelo centrado na edição isolada do dia ("Edition-First"): a página inicial (`/`) exibe apenas o painel de uma única edição (cuja busca filtra somente os atos daquele dia em memória), enquanto a pesquisa transversal no histórico e no portal oficial (2015–2026) fica escondida na rota secundária `/busca` e dividida em duas abas desconectadas. Colocar uma grande barra de pesquisa como navegador principal no topo da Home — com o resumo da edição do dia logo abaixo funcionando como **"Radar de Hoje"** que dá lugar aos resultados quando o usuário pesquisa — transforma o sistema em um verdadeiro navegador de assuntos, pessoas, órgãos, contratos e edições dos Diários Oficiais de Jaboatão dos Guararapes.

## What Changes

- **Barra de Pesquisa Principal (Hero Omnibox Navigator) no topo da Home (`/`):**
  - Campo de pesquisa em destaque no topo da tela inicial com suporte a busca por texto livre (pessoas, empresas, decretos, leis, contratos, secretarias, número de edição ou data), filtros rápidos (categorias, somente edições extras, ano do portal) e chips de atalhos de exploração rápida (ex.: *Nomeações*, *Licitações e Contratos*, *Créditos Suplementares*, *Edições Extras*).
- **Transição dinâmica entre "Radar de Hoje" e "Resultados da Navegação":**
  - **Estado sem busca ativa (Visão de Pouso / Radar de Hoje):** logo abaixo da barra de pesquisa principal, exibe o painel completo da edição selecionada/mais recente (incluindo alertas de Edições Extras, resumo executivo copiável para WhatsApp, KPIs e atos da edição).
  - **Estado com busca ativa (Visão de Resultados do Navegador):** quando o usuário executa uma pesquisa ou seleciona um chip explorador na barra principal, a área abaixo da barra substitui o Radar de Hoje pelos resultados unificados sobre o tema pesquisado, com botão claro para limpar a busca e voltar ao Radar de Hoje.
- **Navegação Unificada (Banco Local + Portal Oficial 2015–2026):**
  - Ao pesquisar um termo, o navegador consulta simultaneamente os **Atos Classificados no Banco Local** (com resumo de impacto: quantidade de atos encontrados, somatório de valores financeiros em `R$` citados nos resultados da página e filtros por categoria/órgão) e as **Edições do Portal Oficial (2015–2026)** que mencionam o termo, permitindo importar e resumir qualquer edição não sincronizada com 1 clique sem sair da experiência de busca.
- **Integração com `/busca` e Cabeçalho Global:**
  - Suporte a parâmetros de URL (`/?q=...&category=...&onlyExtra=...`) para permitir links compartilháveis de pesquisa diretamente na Home e redirecionamento/integração fluida a partir da rota `/busca` e da navegação principal.

## Capabilities

### New Capabilities
- `search-navigator`: Experiência de pesquisa como navegador principal do DOM na página inicial, integrando a barra Hero Omnibox com chips rápidos, alternância automática entre o "Radar de Hoje" (resumo da edição do dia) e os resultados de pesquisa unificados (atos classificados localmente + busca paginada com importação em 1 clique no portal oficial 2015–2026).

### Modified Capabilities
<!-- Nenhuma capability existente teve seus requisitos alterados. -->

## Impact

- **Rotas e Páginas:**
  - `dom-jaboatao-monitor/src/app/page.tsx` (passa a renderizar o navegador de pesquisa no topo com o Radar de Hoje acoplado).
  - `dom-jaboatao-monitor/src/app/busca/page.tsx` e `dom-jaboatao-monitor/src/app/layout.tsx` (alinhamento da navegação para priorizar a experiência de pesquisa unificada).
- **Componentes UI:**
  - Novo componente de navegação/pesquisa unificada (ex.: `DomSearchNavigator.tsx`) integrando `EditionDashboard` como visão padrão ("Radar de Hoje") e o painel de resultados unificados (Local + Portal Oficial) quando houver busca ativa.
- **APIs existentes reutilizadas/aprimoradas:**
  - `/api/search` (busca paginada de atos locais, podendo retornar agregados/totais e filtro opcional por órgão/secretaria).
  - `/api/portal-search` e `/api/editions/import` (consulta ao portal oficial 2015–2026 e importação com 1 clique).
