# Monitor DOM — Jaboatão dos Guararapes

Aplicação web que coleta, classifica e resume automaticamente as edições do **Diário Oficial do Município (DOM) de Jaboatão dos Guararapes** ([diariooficial.jaboatao.pe.gov.br](https://diariooficial.jaboatao.pe.gov.br/)).

## Funcionalidades

- **Coleta automática** das edições diretamente do portal oficial (listagem paginada + página interna completa da edição).
- **Detecção precisa de Edições Extras e Suplementares** (por título, slug, numeração com letra como `196-A`, sufixo numérico `-2` e fallback de colisão de data sem gerar falso positivo na edição ordinária do mesmo dia), com banner de alerta, aviso cruzado entre edições da mesma data e filtro dedicado.
- **Classificação automática nas categorias prioritárias:**
  - **Leis e Atos Normativos** (leis, decretos, resoluções, instruções normativas, portarias normativas)
  - **Atos de Pessoal** (com contagem de nomeações/exonerações e tabela estruturada)
  - **Contratos, Editais e Avisos** (licitações, extratos, dispensas, notificações e links de anexos PDF externos)
- **Resumo Geral da Edição** exibido diretamente no topo do site (modo determinístico offline + suporte opcional a IA via `GEMINI_API_KEY`) com botão **Copiar Resumo (WhatsApp)**.
- **Rotas permanentes (`/edicoes/[id]`), Histórico & Logs de Sincronização (`/historico`) e Busca Global (`/busca`)**.

## Como executar localmente

```powershell
cd dom-jaboatao-monitor
npm install
copy .env.example .env
npx prisma generate
npx prisma db push
# (ou simplesmente: npm run db:setup)
npm run sync
npm run dev
```

Acesse `http://localhost:3000`.

## Scripts úteis

- `npm run dev` — inicia o servidor de desenvolvimento
- `npm run build` — gera build de produção
- `npm run start` — executa o servidor em produção
- `npm test` — executa os testes automatizados de regressão com fixtures HTML reais
- `npm run sync` — sincroniza novas edições do DOM via terminal (`--pages=3 --limit=26 --force`)
- `npm run db:setup` — cria `.env` (se ausente), gera o Prisma Client e inicializa o banco SQLite
- `npm run db:push` — aplica alterações do schema Prisma no banco

## Automação da coleta (08h, 12h, 16h e 20h)

### No Windows (Agendador de Tarefas)
Para ativar a sincronização automática 4 vezes ao dia (capturando edições ordinárias e extras/suplementares):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1
```

Para remover o agendamento:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-windows-task.ps1
```

### Em produção (Vercel Cron ou Docker + PostgreSQL)
- **Vercel Cron:** o arquivo `vercel.json` já agenda chamadas automáticas para `/api/cron/sync` às `11h, 15h, 19h e 23h UTC` (`08h, 12h, 16h e 20h` no horário de Recife/Brasília). Configure `CRON_SECRET` (ou `SYNC_SECRET`) nas variáveis de ambiente.
- **Docker:** execute `docker build -t dom-jaboatao . && docker run -p 3000:3000 dom-jaboatao`.
- **PostgreSQL em produção:** em `prisma/schema.prisma`, altere `provider = "sqlite"` para `provider = "postgresql"`, defina `DATABASE_URL` para seu banco (Neon/Supabase/RDS) e rode `npx prisma db push`.
