import Link from "next/link";
import { prisma } from "@/lib/db";
import { SyncButton } from "@/components/SyncButton";
import { AdvancedSyncPanel } from "@/components/AdvancedSyncPanel";
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Scale,
  Users,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EDITION_TYPE_LABELS, EditionType, formatDateBR } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function safeParseArray(str: string): string[] {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [String(val)];
  } catch {
    return str ? [str] : [];
  }
}

function buildHistoricoHref(page: number, onlyExtra: boolean): string {
  const params = new URLSearchParams();
  if (onlyExtra) params.set("onlyExtra", "true");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/historico?${qs}` : "/historico";
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ onlyExtra?: string; page?: string }>;
}) {
  const params = await searchParams;
  const onlyExtra = params.onlyExtra === "true";
  const requestedPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const where = onlyExtra ? { isExtraOrSupplementary: true } : undefined;

  const [filteredCount, totalAll, totalExtra, recentLogs] = await Promise.all([
    prisma.edition.count({ where }),
    prisma.edition.count(),
    prisma.edition.count({ where: { isExtraOrSupplementary: true } }),
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const editions = await prisma.edition.findMany({
    where,
    orderBy: [{ publishedDateStr: "desc" }, { createdAt: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const fmtDateTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const startItem = filteredCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filteredCount, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Histórico de Edições & Monitor de Extras/Suplementares
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {totalAll} edição(ões) sincronizada(s), sendo{" "}
            <strong className="text-amber-700">
              {totalExtra} Extraordinária(s) / Suplementar(es)
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/historico"
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              !onlyExtra
                ? "bg-[#0037C1] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Todas ({totalAll})
          </Link>
          <Link
            href="/historico?onlyExtra=true"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              onlyExtra
                ? "bg-amber-500 text-white"
                : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Somente Extras / Suplementares ({totalExtra})
          </Link>
          <SyncButton pages={5} limit={30} label="Sincronizar Novas" variant="subtle" />
        </div>
      </div>

      {/* Painel de Coleta Paginada Avançada (Ano, Período, Faixa de Páginas, Termo) */}
      <AdvancedSyncPanel />

      {/* Painel de Saúde e Histórico de Sincronizações (SyncLog) */}
      {recentLogs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0037C1]" />
            <h2 className="text-sm font-bold text-slate-900">
              Últimas Sincronizações Automáticas / Manuais
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Páginas</th>
                  <th className="py-2 pr-4">Novas Edições</th>
                  <th className="py-2 pr-4">Extras Detectadas</th>
                  <th className="py-2">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-4">
                      {log.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Sucesso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                          <XCircle className="h-3 w-3" />
                          {log.status}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {fmtDateTime.format(log.startedAt)}
                    </td>
                    <td className="py-2 pr-4">{log.pagesScanned}</td>
                    <td className="py-2 pr-4 font-semibold">{log.newEditionsCount}</td>
                    <td className="py-2 pr-4 font-semibold text-amber-700">
                      {log.extraEditionsDetected}
                    </td>
                    <td className="max-w-xs truncate py-2 text-slate-500">
                      {log.errorMessage || "Coleta concluída sem alertas"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Barra de informação de paginação */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
        <span>
          Exibindo {startItem}–{endItem} de {filteredCount} edição(ões)
        </span>
        <span>
          Página {currentPage} de {totalPages}
        </span>
      </div>

      {editions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhuma edição encontrada para este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {editions.map((ed) => {
            const bullets = safeParseArray(ed.executiveSummary);
            return (
              <article
                key={ed.id}
                className={`rounded-2xl border bg-white p-5 shadow-2xs transition hover:shadow-xs ${
                  ed.isExtraOrSupplementary
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-[#0037C1]">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateBR(ed.publishedDateStr)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        Nº {ed.editionNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${
                          ed.isExtraOrSupplementary
                            ? "bg-amber-500 text-white"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {ed.isExtraOrSupplementary && (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {EDITION_TYPE_LABELS[ed.editionType as EditionType] ||
                          ed.editionType}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-900">
                      <Link
                        href={`/edicoes/${ed.id}`}
                        className="hover:text-[#0037C1] hover:underline"
                      >
                        {ed.title}
                      </Link>
                    </h2>

                    {ed.extraReason && (
                      <p className="text-xs font-medium text-amber-800">
                        {ed.extraReason}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Scale className="h-3.5 w-3.5 text-blue-600" />
                        <strong>{ed.totalNormative}</strong> Leis/Normativos
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-purple-600" />
                        <strong>{ed.totalPersonnel}</strong> Pessoal ({ed.totalAppointments} nom. /{" "}
                        {ed.totalDismissals} exon.)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        <strong>{ed.totalContracts}</strong> Contratos/Editais
                      </span>
                    </div>

                    {bullets.length > 0 && (
                      <ul className="space-y-1 pt-1 text-xs text-slate-600">
                        {bullets.slice(0, 3).map((b, i) => (
                          <li key={i} className="line-clamp-1">
                            • {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                    <Link
                      href={`/edicoes/${ed.id}`}
                      className="rounded-lg bg-[#0037C1] px-3.5 py-2 text-center text-xs font-semibold text-white hover:bg-[#002355]"
                    >
                      Abrir Resumo
                    </Link>
                    <a
                      href={ed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <span>Site Oficial</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Controles de paginação real */}
      {totalPages > 1 && (
        <nav
          aria-label="Paginação do histórico"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs"
        >
          {currentPage > 1 ? (
            <Link
              href={buildHistoricoHref(currentPage - 1, onlyExtra)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-300">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </span>
          )}

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - currentPage) <= 2
              )
              .map((p) => (
                <Link
                  key={p}
                  href={buildHistoricoHref(p, onlyExtra)}
                  className={`rounded-md px-2.5 py-1 font-semibold ${
                    p === currentPage
                      ? "bg-[#0037C1] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </Link>
              ))}
          </div>

          {currentPage < totalPages ? (
            <Link
              href={buildHistoricoHref(currentPage + 1, onlyExtra)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-300">
              Próxima
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
