# Tasks

## 1. Navegador de Pesquisa Unificado (`DomSearchNavigator`)

- [x] 1.1 Criar o componente `dom-jaboatao-monitor/src/components/DomSearchNavigator.tsx` com a barra Hero Omnibox no topo (input de termo livre, seletor de categoria, filtro de edições extras, seletor opcional de ano do portal e chips rápidos de exploração como Nomeações, Exonerações, Licitações e Pregões, Contratos e Aditivos, Créditos Suplementares e Edições Extras) e verificar que `npm run typecheck` passa sem erros.
- [x] 1.2 Implementar no `DomSearchNavigator.tsx` a alternância dinâmica entre o estado padrão sem busca ativa ("Radar de Hoje", renderizando o `EditionDashboard` ou estado de coleta inicial) e o estado com pesquisa ativa (painel de síntese do termo pesquisado + resultados unificados do Banco Local via `/api/search` e do Portal Oficial 2015–2026 via `/api/portal-search` com importação em 1 clique via `/api/editions/import` e botão "Voltar ao Radar de Hoje"), verificando a compilação com `npm run typecheck`.

## 2. Integração na Home (`/`), Rota `/busca` e Navegação Principal

- [x] 2.1 Atualizar `dom-jaboatao-monitor/src/app/page.tsx` para ler query params de pesquisa (`q`, `category`, `onlyExtra`, `year`, `edition`) e renderizar `DomSearchNavigator` no topo com o `EditionDashboard` acoplado como "Radar de Hoje" (inclusive quando o banco local estiver vazio), e verificar com `npm run typecheck`.
- [x] 2.2 Alinhar `dom-jaboatao-monitor/src/app/layout.tsx` e `dom-jaboatao-monitor/src/app/busca/page.tsx` com a nova experiência Search-First (destacando o Navegador/Pesquisa na navegação e reutilizando a experiência unificada) e atualizar a seção de funcionalidades nos arquivos `README.md` e `dom-jaboatao-monitor/README.md`, verificando com `npm run typecheck`.

## 3. Testes e Verificação de Integração

- [x] 3.1 Adicionar testes automatizados para a lógica de presets/chips e estado de busca do navegador em `dom-jaboatao-monitor/tests/` e verificar que toda a suíte passa executando `npm test` e `npm run build` dentro de `dom-jaboatao-monitor`.
