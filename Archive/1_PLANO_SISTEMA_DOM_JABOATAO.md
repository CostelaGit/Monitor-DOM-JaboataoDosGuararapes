# Plano de Projeto: Monitor e Resumidor do Diário Oficial de Jaboatão dos Guararapes (DOM)

## 1. Visão Geral e Objetivo

Construir uma aplicação web capaz de coletar automaticamente as edições do **Diário Oficial do Município (DOM) de Jaboatão dos Guararapes** a partir do portal oficial ([https://diariooficial.jaboatao.pe.gov.br/](https://diariooficial.jaboatao.pe.gov.br/)), analisar o conteúdo publicado, identificar **Edições Extras e Suplementares**, classificar os atos nas categorias prioritárias e **exibir em um site um resumo claro e organizado do que saiu em cada edição**.

### Principais entregas funcionais
- **Leis e Atos Normativos:** leis municipais, leis complementares, decretos, instruções normativas e resoluções.
- **Atos de Pessoal:** nomeações, exonerações, designações (fiscais/gestores), portarias de pessoal, convocações, aposentadorias e licenças.
- **Contratos, Editais e Avisos:** extratos de contratos, aditivos, atas de registro de preços, avisos de licitação, resultados de julgamento, dispensas, inexigibilidades e editais.
- **Detecção de Edições Extras e Suplementares:** identificação automática e destaque visual imediato quando o município publicar edição extraordinária, suplementar ou múltipla no mesmo dia.
- **Resumo da Edição na Página:** painel resumido exibindo o panorama geral da edição (estatísticas + principais destaques + itens filtráveis por categoria e órgão), sempre com link para a íntegra no portal oficial.

---

## 2. Análise Técnica da Fonte Oficial

Em inspeção técnica direta ao portal `https://diariooficial.jaboatao.pe.gov.br/`, foram identificados os seguintes aspectos que viabilizam uma coleta rápida e confiável:

1. **Conteúdo em HTML renderizado no servidor (Next.js SSR):**
   - A página inicial lista as edições com paginação em `/?page=1`, `/?page=2`, etc. (12 edições por página).
   - Cada edição possui uma página própria no padrão:
     `/{ANO}/{MES}/{DIA}/{dia}-de-{mes}-de-{ano}-{ano-romano}-no-{numero}-jaboatao-dos-guararapes`
   - O texto integral da edição é entregue diretamente no HTML da página (não está preso em PDF escaneado), dispensando OCR para o corpo principal e permitindo extração rápida e precisa.
2. **Anexos externos em PDF:**
   - Algumas publicações (como atas de licitação e termos de referência) contêm links para PDFs hospedados em domínios auxiliares (`jaboatao.septemcompliance.com` e `sgijaboatao.septemcompliance.com`), que podem ser indexados como anexos do ato correspondente.
3. **Padrão real de Edições Extras e Suplementares:**
   - Exemplos observados no portal:
     - `/2026/10/25/25-de-outubro-de-2026-xxxiv-no-202-jaboatao-dos-guararapes-edicao-extraordinaria`
     - `/2026/10/17/17-de-outubro-de-2026-xxxiv-no-196-a-jaboatao-dos-guararapes-edicao-extraordinaria` (título `<h1>`: `... Nº 196-A – JABOATÃO DOS GUARARAPES (Edição Extraordinária)`)
     - `/2026/10/06/07-de-outubro-de-2026-xxxiv-no-188-jaboatao-dos-guararapes-2` (edição adicional com sufixo numérico)
4. **Estrutura interna dos atos:**
   - As publicações são divididas por cabeçalhos de órgão/secretaria em caixa alta (ex.: `GABINETE DO PREFEITO`, `SECRETARIA EXECUTIVA DE GESTÃO CORPORATIVA`, `SECRETARIA EXECUTIVA DE CONTRATAÇÕES PÚBLICAS`, `COMISSÃO ESPECIAL DE LICITAÇÃO`) seguidos dos atos individuais (`DECRETO Nº ...`, `ATOS DO DIA ...`, `Ato nº ... – Exonerar / Nomear`, `PORTARIA Nº ...`, `AVISO DE ...`, `PROCESSO LICITATÓRIO Nº ...`).
5. **Peculiaridade a tratar no parser:**
   - Em alguns casos o número da edição no slug da URL pode divergir do número oficial exibido no título `<h1>` da página (ex.: URL com `no-221` e título interno `Nº 220`). Portanto, o sistema deve usar a **URL canônica como identificador único**, mas extrair os metadados oficiais (número, ano romano, data e tipo de edição) do conteúdo da própria página (`<h1>`).
6. **Fonte complementar opcional:**
   - O portal também expõe a rota `/contratacao-direta-recebendo-propostas`, útil como complemento à seção de Contratos, Editais e Avisos.

---

## 3. Arquitetura do Sistema e Stack Recomendada

### Stack Principal Recomendada (Projeto Unificado)
Para facilitar desenvolvimento, manutenção e hospedagem em um único repositório:

- **Framework Web + API:** **Next.js (App Router) com TypeScript**
- **Estilização e UI:** **Tailwind CSS** + componentes acessíveis (shadcn/ui ou Lucide Icons)
- **Coleta e Parsing HTML:** `fetch` nativo + **Cheerio** (parse rápido de DOM HTML)
- **Banco de Dados:** **SQLite** com **Prisma ORM** (ideal para início rápido local, com migração trivial para **PostgreSQL** em produção)
- **Sumarização:** **Abordagem Híbrida**
  - *Nível 1 (Determinístico / Sem custo de API):* extração estruturada de ementas, números de atos, nomes, cargos, valores (`R$`), objetos de contrato e contadores por categoria.
  - *Nível 2 (Opcional com IA):* geração de um parágrafo de "Resumo Executivo do Dia" em linguagem natural usando API de LLM (ex.: Gemini API), com fallback automático para o resumo determinístico caso não haja chave configurada.
- **Agendamento:** `node-cron` (em servidor próprio/local) ou Cron Jobs da plataforma de deploy (ex.: Vercel Cron / GitHub Actions).

### Fluxo Geral da Arquitetura

```text
[Portal DOM Jaboatão]
   (diariooficial.jaboatao.pe.gov.br)
            │
            ▼ (1. Coletor HTTP / Scraper com cache e rate-limit)
[Módulo de Descoberta e Extração]
   - Lista novas edições (/?page=1..N)
   - Baixa HTML da edição
   - Detecta se é Ordinária, Extraordinária ou Suplementar
            │
            ▼ (2. Segmentador e Classificador)
[Motor de Análise de Atos]
   - Divide o texto por Órgão/Secretaria e por Ato
   - Classifica em:
       • Leis e Atos Normativos
       • Atos de Pessoal
       • Contratos, Editais e Avisos
       • Outros Atos (para não perder nada)
   - Extrai metadados (número, ementa, valores, nomes, links PDF)
            │
            ▼ (3. Gerador de Resumo)
[Sumarizador da Edição]
   - Gera síntese geral + destaques por categoria + métricas
            │
            ▼ (4. Persistência)
[Banco de Dados (SQLite / PostgreSQL)]
            │
            ▼ (5. API REST + Frontend Web)
[Site / Painel do Usuário]
   - Resumo da edição selecionada
   - Alerta de Edições Extras / Suplementares
   - Abas por categoria, busca, filtros e link oficial
```

---

## 4. Pipeline Detalhado de Extração, Classificação e Resumo

### 4.1. Descoberta e Coleta
1. Acessar `https://diariooficial.jaboatao.pe.gov.br/?page=1` (e páginas seguintes na carga inicial histórica, configurável — ex.: últimos 30 dias).
2. Extrair todos os links de edições (`^/\d{4}/\d{2}/\d{2}/.+`).
3. Verificar no banco quais URLs já foram processadas (evitando requisições repetidas).
4. Para cada nova edição, baixar o HTML com `User-Agent` identificado e intervalo educado entre requisições (ex.: 1 segundo) para não sobrecarregar o site da prefeitura.

### 4.2. Detecção de Edições Extras e Suplementares
Uma edição será marcada como **Extraordinária** ou **Suplementar** se atender a qualquer um dos critérios abaixo:
1. **Slug da URL:** contém termos como `extra`, `extraordinaria`, `suplementar`, `suplemento`, ou sufixos de edição adicional (`-a-`, `-b-`, `-2`).
2. **Título oficial (`<h1>`) ou cabeçalho:** contém `Edição Extraordinária`, `Edição Extra`, `Suplementar`, `Suplemento`, `Caderno Extra` ou número com letra (`Nº 196-A`).
3. **Colisão de data:** existência de mais de uma edição publicada na mesma data (`YYYY-MM-DD`). Nesse caso, a segunda (ou posterior) recebe alerta visual indicando publicação adicional no mesmo dia.

### 4.3. Segmentação por Órgão e Ato
- Limpar navegação, cabeçalho global, rodapé e scripts do HTML, isolando apenas o container principal da publicação.
- Percorrer os blocos de parágrafos/títulos:
  - Identificar mudanças de **Órgão/Secretaria** (linhas em caixa alta como `GABINETE DO PREFEITO`, `SECRETARIA MUNICIPAL DE ...`, `SECRETARIA EXECUTIVA DE ...`, `PROCURADORIA GERAL ...`, `COMISSÃO ESPECIAL DE LICITAÇÃO`, `INSTITUTO DE PREVIDÊNCIA ...`).
  - Delimitar início de cada **Ato** por padrões de abertura: `LEI Nº`, `LEI COMPLEMENTAR`, `DECRETO Nº`, `PORTARIA Nº`, `ATOS DO DIA`, `Ato nº`, `INSTRUÇÃO NORMATIVA`, `RESOLUÇÃO`, `EXTRATO DE CONTRATO`, `EXTRATO DE ADITIVO`, `AVISO DE`, `EDITAL`, `ATA DE REGISTRO`, `TERMO DE`, `RATIFICAÇÃO`, `HOMOLOGAÇÃO`, `CHAMAMENTO PÚBLICO`.

### 4.4. Regras de Classificação nas 3 Categorias Principais

| Categoria | Padrões e Palavras-Chave de Identificação | Metadados Extraídos |
| :--- | :--- | :--- |
| **1. Leis e Atos Normativos** | `LEI MUNICIPAL`, `LEI COMPLEMENTAR`, `LEI Nº`, `DECRETO Nº`, `INSTRUÇÃO NORMATIVA`, `RESOLUÇÃO`, `MEDIDA`, abertura de crédito suplementar, regulamentações | Tipo, número, data, órgão emissor, **ementa**, valor (quando crédito orçamentário) |
| **2. Atos de Pessoal** | `ATOS DO DIA`, `Ato nº ... Exonerar`, `Nomear`, `Designar`, `Tornar sem efeito`, `Exoneração`, `Nomeação`, `Aposentadoria`, `Licença`, `Cessão`, `Progressão`, `Concurso`, `Seleção Simplificada`, `Portaria` com designação de fiscal/gestor ou servidor/matrícula | Ação (`Nomeação`, `Exoneração`, `Designação`, etc.), nome do servidor, cargo/símbolo (`CAT`, `CAA`), secretaria, matrícula, data de efeito |
| **3. Contratos, Editais e Avisos** | `CONTRATO`, `EXTRATO`, `ADITIVO`, `LICITAÇÃO`, `PROCESSO LICITATÓRIO`, `PREGÃO`, `CONCORRÊNCIA`, `DISPENSA`, `INEXIGIBILIDADE`, `ATA DE REGISTRO DE PREÇOS`, `EDITAL`, `AVISO DE`, `HOMOLOGAÇÃO`, `ADJUDICAÇÃO`, `CONVOCAÇÃO`, `CHAMAMENTO` | Modalidade/processo, contratado/vencedor, objeto, valor (`R$`), vigência, links de anexos PDF |
| **Outros (Fallback)** | Qualquer ato não enquadrado acima (ex.: comunicados diversos, pautas) | Mantido acessível na aba "Outros" para garantir 100% de cobertura da edição |

### 4.5. Geração do Resumo da Edição
Para cada edição processada, gerar e salvar no banco:
- **Resumo Executivo (3 a 6 tópicos objetivos):** síntese rápida do que há de mais relevante naquela edição (ex.: *"Foram publicados 2 decretos (incluindo crédito suplementar de R$ 350 mil para a PGM), 14 atos de pessoal (8 nomeações e 6 exonerações) e 3 avisos de licitação/contratos."*).
- **Resumo Individual por Ato:** 1 a 2 frases destacando ementa, objeto ou ação principal, evitando que o usuário precise ler blocos jurídicos extensos para saber do que se trata.
- **Métricas da Edição:** totais por categoria, total de nomeações vs. exonerações, soma aproximada de valores financeiros identificados em decretos/contratos e flag de edição extra/suplementar.

---

## 5. Modelagem de Dados

Esquema conceitual das tabelas principais (Prisma / SQLite ou PostgreSQL):

- **`Edition` (Edições)**
  - `id` (UUID / autoincrement)
  - `url` (String, único — link oficial no portal)
  - `publishedDate` (Date — data da edição)
  - `editionNumber` (String — ex.: `"220"`, `"196-A"`)
  - `romanYear` (String — ex.: `"XXXV"`)
  - `title` (String — título oficial do `<h1>`)
  - `editionType` (Enum: `ORDINARIA`, `EXTRAORDINARIA`, `SUPLEMENTAR`)
  - `isExtraOrSupplementary` (Boolean — índice rápido para alertas)
  - `executiveSummary` (Text — resumo geral exibido no topo da página)
  - `rawText` (Text — texto limpo completo para busca full-text)
  - `totalNormative`, `totalPersonnel`, `totalContracts`, `totalOthers` (Int)
  - `createdAt`, `updatedAt` (DateTime)

- **`Act` (Atos extraídos da edição)**
  - `id`
  - `editionId` (FK -> `Edition`)
  - `category` (Enum: `LEIS_E_ATOS_NORMATIVOS`, `ATOS_DE_PESSOAL`, `CONTRATOS_EDITAIS_AVISOS`, `OUTROS`)
  - `subType` (String — ex.: `"Decreto"`, `"Nomeação"`, `"Exoneração"`, `"Aviso de Licitação"`, `"Extrato de Contrato"`)
  - `department` (String — órgão/secretaria emissora)
  - `actNumber` (String, opcional)
  - `title` (String)
  - `summary` (Text — resumo curto do ato)
  - `content` (Text — texto integral do ato)
  - `monetaryValue` (Decimal, opcional — valor em reais extraído)
  - `metadataJson` (JSON — nomes, cargos, nº processo, datas, etc.)

- **`Attachment` (Anexos PDF vinculados)**
  - `id`
  - `editionId` (FK -> `Edition`)
  - `actId` (FK opcional -> `Act`)
  - `label` (String)
  - `url` (String — ex.: link do `septemcompliance.com`)

- **`SyncLog` (Histórico de sincronizações)**
  - `id`, `startedAt`, `finishedAt`, `status`, `newEditionsCount`, `extraEditionsDetected`, `errorMessage`

---

## 6. Design da Interface Web (Site)

O site será focado em **leitura rápida (escaneabilidade)**, permitindo entender uma edição completa em menos de 30 segundos.

### Estrutura Visual da Página Principal

```text
+-------------------------------------------------------------------------+
| [Logo] Monitor DOM — Jaboatão dos Guararapes     [Buscar...] [Atualizar]|
+-------------------------------------------------------------------------+
| [!] ALERTA: Edição Extraordinária detectada em 17/10/2026 (Nº 196-A)    |
|     [Ver Edição Extra]                                                  |
+-------------------------------------------------------------------------+
| Seletor de Edição: [< Anterior]  [24/11/2026 - Nº 220 (Ordinária) v]    |
| [Abrir Edição Oficial no Site da Prefeitura ↗]                          |
+-------------------------------------------------------------------------+
| RESUMO DA EDIÇÃO                                                        |
| • 1 Decreto de abertura de crédito adicional suplementar (R$ 350 mil)   |
| • 12 Atos de Pessoal (7 nomeações, 4 exonerações, 1 portaria de gestão) |
| • 2 Avisos de Licitação / Contratos (Concorrência Pública nº 016/2025)  |
+-------------------------------------------------------------------------+
| [Leis e Atos (1)] [Atos de Pessoal (12)] [Contratos e Editais (2)]      |
| Filtros: [Todas as Secretarias v]  [Só Extra/Suplementar]               |
+-------------------------------------------------------------------------+
| LISTA DE ITENS RESUMIDOS DA ABA ATIVA                                   |
| ┌─────────────────────────────────────────────────────────────────────┐ |
| │ [DECRETO Nº 333/2026]  •  Gabinete do Prefeito          R$ 350.000  │ |
| │ Resumo: Abertura de Crédito Adicional Suplementar em favor da PGM   │ |
| │ para encargos com precatórios e RPVs.                               │ |
| │ [Ver texto completo]                                                │ |
| └─────────────────────────────────────────────────────────────────────┘ |
+-------------------------------------------------------------------------+
```

### Funcionalidades-chave da Interface
1. **Indicador de Edições Extras e Suplementares:**
   - Banner de alerta no topo sempre que houver edição extra/suplementar recente ou na data selecionada.
   - Selo colorido (badge `EXTRAORDINÁRIA` / `SUPLEMENTAR`) no seletor de edições e no histórico.
   - Filtro rápido no histórico para listar apenas edições extras e suplementares.
2. **Cards de Resumo Rápido:**
   - Contadores clicáveis para cada uma das 3 categorias principais.
   - Resumo em tópicos do que mudou/aconteceu naquela edição.
3. **Seção dedicada a Atos de Pessoal:**
   - Sub-resumo automático exibindo contagem de **Nomeações**, **Exonerações** e **Designações/Portarias**, com tabela limpa contendo Nome, Ação, Cargo e Secretaria.
4. **Seção dedicada a Contratos, Editais e Avisos:**
   - Destaque para número do processo licitatório, modalidade, objeto, valor (quando presente) e botões para abrir anexos PDF.
5. **Busca Global e Histórico:**
   - Pesquisa por nome de pessoa, empresa, número de decreto/lei, secretaria ou palavra-chave em todas as edições já coletadas.
6. **Botão "Sincronizar Agora" + Status da Última Coleta:**
   - Permite atualizar sob demanda direto pelo site, além da coleta automática agendada.

---

## 7. Estrutura de Pastas Sugerida para o Projeto

```text
dom-jaboatao-monitor/
├── prisma/
│   └── schema.prisma              # Modelagem do banco de dados
├── src/
│   ├── app/
│   │   ├── page.tsx               # Página principal (Resumo da edição mais recente)
│   │   ├── edicoes/
│   │   │   └── [id]/page.tsx      # Visualização de uma edição específica
│   │   ├── historico/page.tsx     # Lista de edições + filtro Extra/Suplementar
│   │   ├── busca/page.tsx         # Busca global entre edições
│   │   └── api/
│   │       ├── sync/route.ts      # Dispara coleta de novas edições
│   │       ├── editions/route.ts  # Lista edições e status de extras
│   │       └── editions/[id]/route.ts
│   ├── lib/
│   │   ├── scraper/
│   │   │   ├── fetcher.ts         # Cliente HTTP com retry e rate-limit
│   │   │   ├── listParser.ts      # Extrai links e paginação da home do DOM
│   │   │   ├── editionParser.ts   # Limpa HTML e segmenta órgãos/atos
│   │   │   └── extraDetector.ts   # Detecta edições extras e suplementares
│   │   ├── classifier/
│   │   │   ├── rules.ts           # Regras das 3 categorias principais
│   │   │   └── metadataExtractor.ts # Extrai valores, nomes, ementas, processos
│   │   ├── summarizer/
│   │   │   ├── deterministic.ts   # Resumo estruturado sem dependência externa
│   │   │   └── llm.ts             # Resumo enriquecido opcional via IA
│   │   └── db.ts                  # Cliente Prisma
│   └── components/
│       ├── ExtraEditionBanner.tsx
│       ├── EditionSummaryCard.tsx
│       ├── CategoryTabs.tsx
│       ├── PersonnelTable.tsx
│       ├── ActDetailModal.tsx
│       └── EditionSelector.tsx
├── scripts/
│   └── sync-cli.ts                # Script para rodar coleta via linha de comando / cron
├── .env.example
└── package.json
```

---

## 8. Fases de Implementação (Roadmap)

### Fase 1 — Setup e Coletor Base
- Inicializar projeto Next.js + TypeScript + Tailwind + Prisma (SQLite).
- Implementar `fetcher.ts` e `listParser.ts` para ler as edições de `https://diariooficial.jaboatao.pe.gov.br/`.
- Criar persistência básica das edições e script de teste para coletar as últimas 15 edições.
- **Critério de aceite:** banco populado com edições reais sem duplicidade.

### Fase 2 — Parser, Detector de Extras e Classificador
- Implementar `extraDetector.ts` validando com edições reais (incluindo `no-196-a-jaboatao-dos-guararapes-edicao-extraordinaria` e `no-202-...-edicao-extraordinaria`).
- Implementar `editionParser.ts` para separar órgãos, atos individuais e anexos PDF.
- Implementar `rules.ts` e `metadataExtractor.ts` para classificar corretamente:
  1. Leis e Atos Normativos
  2. Atos de Pessoal
  3. Contratos, Editais e Avisos
- Criar testes automatizados usando HTML salvo de 3 a 5 edições reais do DOM.
- **Critério de aceite:** >90% dos atos classificados corretamente nas categorias esperadas e 100% das edições extras detectadas.

### Fase 3 — Motor de Resumo da Edição
- Implementar sumarização determinística (tópicos de destaque + métricas + resumo por ato).
- Adicionar integração opcional via variável de ambiente (`LLM_API_KEY`) para resumo executivo em linguagem natural com cache no banco (gerado apenas uma vez por edição).
- **Critério de aceite:** toda edição salva possui um resumo legível pronto para exibição instantânea.

### Fase 4 — Interface Web (Site)
- Construir a página principal com seletor de edição, alerta de Edição Extra/Suplementar, card de Resumo da Edição e abas das 3 categorias.
- Implementar tabela especializada para Atos de Pessoal e cards ricos para Leis e Contratos/Editais.
- Implementar modal de visualização do texto integral do ato + link para a edição oficial.
- Implementar página de histórico (com filtro rápido de Extras/Suplementares) e busca global.
- **Critério de aceite:** interface responsiva (desktop e celular), rápida e intuitiva.

### Fase 5 — Automação, Validação e Deploy
- Configurar sincronização automática em horários estratégicos (ex.: 08h, 12h, 16h e 20h, para capturar tanto edições ordinárias da manhã quanto edições extras/suplementares publicadas à tarde/noite).
- Adicionar logs de execução (`SyncLog`) e tratamento de falhas de rede/alterações de layout.
- Preparar guia de execução local e deploy (Vercel / VPS / Docker).

---

## 9. Cuidados Técnicos, Riscos e Evoluções Futuras

### Boas práticas e mitigação de riscos
- **Resiliência a mudanças no site oficial:** concentrar os seletores HTML em um único arquivo (`editionParser.ts`) e registrar alertas no `SyncLog` caso alguma edição retorne 0 atos extraídos.
- **Coleta respeitosa:** nunca fazer requisições em paralelo agressivo ao portal da prefeitura; respeitar cache local e baixar cada edição apenas uma vez (rechecando apenas a listagem da página 1 para detectar novas publicações).
- **Fidelidade jurídica:** exibir aviso informando que o sistema é um resumo automatizado de apoio e manter sempre o link direto para a publicação oficial em `diariooficial.jaboatao.pe.gov.br`.

### Possíveis evoluções futuras (v2)
- Monitoramento integrado da página de **Contratação Direta** (`/contratacao-direta-recebendo-propostas`).
- **Alertas automáticos** por e-mail, Telegram ou WhatsApp quando sair Edição Extra/Suplementar ou quando determinada palavra-chave (nome, CPF/matrícula, CNPJ, bairro ou secretaria) aparecer no DOM.
- Exportação do resumo diário em PDF ou formato pronto para envio em grupos.
- Extração de texto dos anexos PDF vinculados (`septemcompliance.com`).
