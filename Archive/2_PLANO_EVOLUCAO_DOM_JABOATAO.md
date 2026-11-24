# Plano de Evolução e Consolidação — Monitor DOM Jaboatão dos Guararapes

Este documento compara o **plano original** (`PLANO_SISTEMA_DOM_JABOATAO.md`) com o **estado atual implementado** em `dom-jaboatao-monitor/`, incorporando os achados de uma auditoria real feita sobre os arquivos do projeto e sobre as **26 edições reais (612 atos e 71 anexos PDF)** já sincronizadas no banco SQLite.

---

## 1. Diagnóstico do Estado Atual (O que já está pronto)

| Módulo / Fase do Plano Original | Status Atual | Evidência no Projeto Atual |
| :--- | :---: | :--- |
| **Fase 1 — Setup e Coletor Base** | **Concluído** | Next.js 15, TypeScript, Tailwind v4, Prisma 6 + SQLite (`prisma/dev.db`), `fetcher.ts`, `listParser.ts`, `syncService.ts` e `scripts/sync-cli.ts`. |
| **Fase 2 — Parser, Detector de Extras e Classificador** | **Parcial (90%)** | `editionParser.ts` usa a estrutura semântica real (`.secretaria`, `.tipoPublicacao`, `.publicacao`), divide blocos `ATOS DO DIA` e indexa anexos PDF. **Faltam testes automatizados** e pequenos ajustes de precisão (ver Seção 2). |
| **Fase 3 — Motor de Resumo da Edição** | **Concluído** | `deterministic.ts` (offline, sem custo) + `llm.ts` (opcional via `GEMINI_API_KEY`) salvos no banco por edição. |
| **Fase 4 — Interface Web (Site)** | **Concluído (95%)** | Página principal (`/`), Histórico & Extras (`/historico`), Busca Global (`/busca`), KPIs clicáveis, tabela de Atos de Pessoal, modal de leitura integral (`ActDetailModal.tsx`) e botão `Sincronizar Agora`. Falta apenas a rota amigável `/edicoes/[id]` e painel de logs de coleta. |
| **Fase 5 — Automação, Validação e Deploy** | **Pendente (30%)** | `SyncLog` gravado no banco e `npm run build` validado. **Faltam** o agendador automático configurado (Windows Task Scheduler / Cron), testes automatizados e guia/arquivos de deploy em produção. |

### Métricas reais da auditoria no banco (`dev.db`)
- **Edições sincronizadas:** 26 edições reais (0 edições vazias / com 0 atos).
- **Atos extraídos:** 612 atos no total, sendo **99,0%** classificados nas 3 categorias principais e apenas **1,0%** (6 itens) em `OUTROS`.
- **Anexos PDF vinculados:** 71 arquivos externos (`septemcompliance.com`).
- **Build & Tipagem:** `tsc --noEmit` e `npm run build` passando sem erros.

---

## 2. Problemas Reais e Lacunas Identificadas na Auditoria

A inspeção dos 612 atos reais revelou **3 ajustes técnicos importantes** antes de avançar para novas funcionalidades:

### 2.1. Falso positivo na detecção de Edição Extra no mesmo dia
- **O que aconteceu:** No dia `17/10/2026`, foram publicadas duas edições: `Nº 196` (Ordinária) e `Nº 196-A` (Edição Extraordinária). Como a regra atual marca qualquer edição que compartilhe a mesma data (`hasSameDaySibling`), a edição ordinária `Nº 196` também foi marcada como `EXTRAORDINARIA`.
- **Correção planejada:** Quando houver múltiplas edições na mesma data e pelo menos uma delas já tiver marcador explícito (`extraordinária`, `suplementar`, `-A`, `-2`), **manter a edição principal como `ORDINARIA`** e apenas exibir um aviso informativo *"Esta data também possui Edição Extraordinária (Nº 196-A)"*. Só marcar por colisão de data quando nenhuma das edições do dia tiver marcador explícito (marcando apenas a segunda/posterior).

### 2.2. Refinamento de regras de classificação (`rules.ts`)
Na distribuição dos 612 atos reais por `sourceType`:
- **`Decreto` (1 caso em `CONTRATOS_EDITAIS_AVISOS`):** Um decreto caiu em Contratos por citar termos licitatórios. Regra: `sourceType === "Decreto"` deve ser sempre `LEIS_E_ATOS_NORMATIVOS`.
- **`Notificação` (14 casos em `LEIS_E_ATOS_NORMATIVOS`, 14 em `CONTRATOS`, 5 em `OUTROS`):** Notificações fiscais/urbanísticas (ex.: *Auto de Infração*, *Auto de Demolição*, *Secretaria Executiva da Receita*) acabaram indo para `LEIS_E_ATOS_NORMATIVOS` por citarem artigos de lei no início do texto. Regra: `sourceType === "Notificação"` deve ir para `CONTRATOS_EDITAIS_AVISOS` (como `Notificação / Aviso`) ou `OUTROS`, nunca para `LEIS_E_ATOS_NORMATIVOS`.
- **`OUTROS` (1 caso com título `"LICITAÇÕES E CONTRATOS"` sem `sourceType`):** Bloco de cabeçalho vazio ou mal delimitado deve ser ignorado ou associado corretamente à categoria de Contratos.

### 2.3. Itens do plano original ainda não implementados
1. **Testes automatizados** com snapshots HTML de edições reais (previsto na Fase 2).
2. **Agendamento automático de coleta** nos horários planejados (`08h, 12h, 16h e 20h`) para detectar automaticamente edições ordinárias e extras/suplementares (previsto na Fase 5).
3. **Visualização do `SyncLog` e saúde da coleta** na interface (exibir histórico de sincronizações e alertas caso alguma coleta falhe ou retorne 0 atos).
4. **Rota dedicada `/edicoes/[id]`** para links permanentes e compartilháveis de cada edição.

---

## 3. Plano de Ação — Próximas Etapas (Priorizado)

### Etapa 1 — Correções de Precisão e Qualidade de Dados (Prioridade Alta)
**Objetivo:** Corrigir os achados da auditoria e reprocessar as 26 edições com precisão máxima.
1. Atualizar `src/lib/scraper/extraDetector.ts` e `src/lib/syncService.ts` para distinguir a edição ordinária da edição extra quando ambas saem na mesma data (ex.: `196` vs. `196-A`).
2. Refinar `src/lib/classifier/rules.ts` para:
   - Garantir que `Decreto`, `Lei Ordinária`, `Lei Complementar` e `Resolução Normativa` sempre fiquem em `LEIS_E_ATOS_NORMATIVOS`.
   - Impedir que `Notificação` (autos de infração, demolição, receita) seja classificada como `LEIS_E_ATOS_NORMATIVOS`.
   - Filtrar blocos vazios/títulos soltos em `editionParser.ts`.
3. Rodar resincronização (`npm run sync -- --pages=3 --limit=26 --force`) e confirmar 0 falsos positivos de extra e melhora na classificação.

### Etapa 2 — Testes Automatizados de Regressão (Prioridade Alta)
**Objetivo:** Garantir que mudanças futuras no código ou no portal oficial não quebrem o parser.
1. Salvar fixtures HTML reais (anônimos/públicos do portal) em `tests/fixtures/` cobrindo:
   - 1 edição ordinária completa (ex.: `24/11/2026`);
   - 1 edição extraordinária com sufixo `-A` (ex.: `17/10/2026 Nº 196-A`);
   - 1 edição com múltiplos `ATOS DO DIA`, decretos, contratos e anexos PDF.
2. Criar suíte de testes (`npm test` usando `node --test` ou `vitest`) validando:
   - `parseEditionListPage`
   - `detectExtraOrSupplementary` (incluindo cenário de 2 edições no mesmo dia)
   - `parseEditionHtml` + `classifyAct` + `buildDeterministicSummary`

### Etapa 3 — Melhorias de UX e Rotas Faltantes (Prioridade Média)
**Objetivo:** Fechar 100% da interface prevista no plano original e melhorar a usabilidade diária.
1. Criar rota permanente `/edicoes/[id]/page.tsx` reutilizando `EditionDashboard` (permitindo compartilhar link direto de qualquer edição).
2. Adicionar alerta cruzado no painel: ao visualizar uma edição ordinária de uma data que também possui Edição Extraordinária/Suplementar, mostrar link direto para a edição extra do mesmo dia.
3. Adicionar botão **"Copiar Resumo (WhatsApp / Texto)"** no card de Resumo Geral da Edição, formatando os destaques do dia prontos para colar e enviar.
4. Criar seção/modal de **Status das Sincronizações (`SyncLog`)** no cabeçalho ou na página `/historico` mostrando últimas execuções, novas edições e eventuais erros.

### Etapa 4 — Automação de Coleta e Monitoramento Contínuo (Prioridade Média)
**Objetivo:** Manter o sistema sempre atualizado sem precisar clicar manualmente.
1. Criar script PowerShell (`scripts/register-windows-task.ps1`) para registrar tarefa agendada no **Agendador de Tarefas do Windows** executando `npm run sync -- --pages=1 --limit=10` às **08h, 12h, 16h e 20h**.
2. Adicionar suporte opcional a `vercel.json` (Cron Job chamando `/api/sync` com `SYNC_SECRET`) e `Dockerfile` para quem optar por hospedar online 24/7.
3. Documentar migração de SQLite para PostgreSQL (Neon/Supabase) no `README.md` para deploy em nuvem.

### Etapa 5 — Evoluções v2 (Opcional / Futuro)
**Objetivo:** Expandir o valor do monitor além do resumo diário.
1. **Monitor de Contratação Direta:** coletar também `https://diariooficial.jaboatao.pe.gov.br/contratacao-direta-recebendo-propostas` em uma aba dedicada.
2. **Alertas por Palavra-Chave e Edição Extra:** cadastro de termos monitorados (nome, matrícula, CNPJ, secretaria, bairro) com envio automático via Telegram Bot ou e-mail quando surgir correspondência ou Edição Extraordinária.
3. **Leitura dos Anexos PDF:** extração opcional de texto/resumo dos PDFs hospedados em `septemcompliance.com`.
4. **Exportação em PDF:** geração de boletim diário resumido em PDF para arquivamento.

---

## 4. Ordem Recomendada de Execução

1. **Etapa 1** (correção do falso positivo de `196` vs. `196-A` + ajuste de `Decreto` e `Notificação`) — *impacto imediato na confiabilidade dos dados*.
2. **Etapa 2** (testes automatizados com HTML real) — *protege o parser contra quebras*.
3. **Etapa 3** (rota `/edicoes/[id]`, botão copiar resumo, painel de `SyncLog` e aviso cruzado de extra no mesmo dia) — *fecha a experiência do usuário*.
4. **Etapa 4** (automação Windows Task Scheduler / Cron + preparo de deploy) — *coloca o sistema para rodar sozinho*.
5. **Etapa 5** (Contratação Direta + Alertas Telegram/E-mail) — *evolução v2 conforme necessidade*.
