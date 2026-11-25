# search-navigator Specification

## Purpose

Define o comportamento do navegador de pesquisa principal do Diário Oficial do Município de Jaboatão dos Guararapes, integrando a barra de busca em destaque no topo da página inicial com chips rápidos, alternância automática entre o "Radar de Hoje" (resumo da edição do dia) e a visão unificada de resultados (atos classificados no banco local e edições paginadas do portal oficial 2015–2026).

## Requirements

### Requirement: Barra de pesquisa como navegador principal no topo da página inicial
O sistema SHALL exibir uma barra de pesquisa principal no topo da página inicial (`/`) que permita ao usuário pesquisar termos livres (nomes, cargos, empresas, leis, decretos, contratos, secretarias, datas ou números de edição), selecionar filtros (categoria de ato e filtro de edições extras/suplementares) e acionar chips de atalho para consultas frequentes no DOM.

#### Scenario: Exibição da barra de pesquisa e chips rápidos ao acessar a página inicial
- **WHEN** o usuário acessa a página inicial (`/`)
- **THEN** o sistema exibe no topo a barra de pesquisa principal com campo de texto, filtros de categoria e edições extras, além de chips clicáveis de exploração rápida (como Nomeações, Licitações e Contratos, Créditos Suplementares e Edições Extras)

#### Scenario: Acionamento de chip de exploração rápida
- **WHEN** o usuário clica em um chip de exploração rápida abaixo da barra de pesquisa principal
- **THEN** o sistema preenche os critérios correspondentes na barra de pesquisa e executa imediatamente a navegação pelos resultados

### Requirement: Alternância dinâmica entre o Radar de Hoje e os resultados da pesquisa
O sistema SHALL exibir o painel resumido da edição selecionada ou mais recente ("Radar de Hoje") logo abaixo da barra de pesquisa quando não houver busca ativa, e SHALL substituir essa área pelos resultados da pesquisa quando o usuário submeter uma consulta ou filtro na barra principal.

#### Scenario: Estado padrão sem busca ativa exibe o Radar de Hoje
- **WHEN** o usuário está na página inicial (`/`) sem termo de busca ou filtro global ativo na barra principal
- **THEN** o sistema exibe logo abaixo da barra a seção "Radar de Hoje" contendo o resumo executivo da edição do dia (ou edição selecionada), alertas de edições extras, indicadores por categoria e listagem de atos daquela edição

#### Scenario: Pesquisa ativa substitui o Radar de Hoje pelos resultados
- **WHEN** o usuário submete um termo ou filtro na barra de pesquisa principal
- **THEN** o sistema oculta a seção "Radar de Hoje", exibe o painel de resultados da pesquisa com um cabeçalho de síntese da busca e apresenta uma ação visível ("Voltar ao Radar de Hoje" / "Limpar pesquisa") para restaurar a visão da edição do dia

#### Scenario: Limpeza da pesquisa restaura o Radar de Hoje
- **WHEN** o usuário clica na ação para limpar a pesquisa ou voltar ao Radar de Hoje
- **THEN** o sistema limpa os critérios ativos da barra principal e volta a exibir o "Radar de Hoje" abaixo da barra

### Requirement: Resultados unificados entre Banco Local e Portal Oficial com importação em 1 clique
Quando uma pesquisa estiver ativa no navegador principal, o sistema SHALL apresentar de forma integrada os atos já classificados no banco local (com resumo de impacto da busca, incluindo total de atos encontrados e soma dos valores financeiros citados na página) e a consulta paginada às edições do portal oficial (2015–2026), permitindo importar e resumir qualquer edição oficial ainda não sincronizada com 1 clique.

#### Scenario: Pesquisa retorna atos classificados localmente e edições do portal oficial
- **WHEN** o usuário pesquisa por um termo na barra principal (ex.: "Educação" ou "Pregão")
- **THEN** o sistema consulta os atos classificados no banco local e as edições correspondentes no portal oficial, permitindo navegar pelos atos locais (com leitura completa em modal) e pelas edições do portal oficial na mesma experiência de busca

#### Scenario: Importação e resumo em 1 clique a partir dos resultados do portal oficial
- **WHEN** o usuário visualiza nos resultados do portal oficial uma edição ainda não importada localmente e aciona "Importar e Resumir"
- **THEN** o sistema coleta, classifica e resume a edição do portal oficial e permite abrir imediatamente seu resumo estruturado
