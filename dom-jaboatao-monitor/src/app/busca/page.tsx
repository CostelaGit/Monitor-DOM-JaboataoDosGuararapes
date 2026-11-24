"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Banknote,
  Globe,
  Database,
  Download,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  ActCategory,
  CATEGORY_LABELS,
  EDITION_TYPE_LABELS,
  EditionType,
  formatCurrencyBRL,
  formatDateBR,
} from "@/lib/types";
import { ActDetailModal, ActViewItem } from "@/components/ActDetailModal";

interface LocalSearchResultItem extends ActViewItem {
  edition: {
    id: string;
    title: string;
    url: string;
    publishedDateStr: string;
    editionNumber: string;
    editionType: string;
    isExtraOrSupplementary: boolean;
  };
}

interface PortalSearchItem {
  url: string;
  slug: string;
  cardTitle: string;
  publishedDateStr: string;
  editionNumber: string;
  editionType: string;
  isExtraOrSupplementary: boolean;
  localEditionId: string | null;
  localTotalActs: number | null;
}

interface LocalPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PortalPagination {
  currentPage: number;
  maxPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export default function BuscaPage() {
  const router = useRouter();
  const [searchScope, setSearchScope] = useState<"local" | "portal">("local");

  // Estado Busca Local
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [onlyExtra, setOnlyExtra] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localSearched, setLocalSearched] = useState(false);
  const [localResults, setLocalResults] = useState<LocalSearchResultItem[]>([]);
  const [localPagination, setLocalPagination] = useState<LocalPagination | null>(null);
  const [selectedAct, setSelectedAct] = useState<LocalSearchResultItem | null>(null);

  // Estado Busca Paginada no Portal Oficial
  const [portalQuery, setPortalQuery] = useState("");
  const [portalYear, setPortalYear] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalSearched, setPortalSearched] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalItems, setPortalItems] = useState<PortalSearchItem[]>([]);
  const [portalPagination, setPortalPagination] = useState<PortalPagination | null>(null);
  const [jumpPage, setJumpPage] = useState("1");
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  async function runLocalSearch(targetPage = 1) {
    setLocalLoading(true);
    setLocalSearched(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (onlyExtra) params.set("onlyExtra", "true");
      params.set("page", String(targetPage));
      params.set("pageSize", "20");

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setLocalResults(data.results || []);
      setLocalPagination(data.pagination || null);
    } finally {
      setLocalLoading(false);
    }
  }

  async function handleLocalSubmit(e: FormEvent) {
    e.preventDefault();
    await runLocalSearch(1);
  }

  async function runPortalSearch(targetPage = 1) {
    setPortalLoading(true);
    setPortalSearched(true);
    setPortalError(null);
    try {
      const params = new URLSearchParams();
      if (portalQuery.trim()) params.set("q", portalQuery.trim());
      if (!portalQuery.trim() && portalYear) params.set("year", portalYear);
      params.set("page", String(targetPage));

      const res = await fetch(`/api/portal-search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar portal oficial");
      }
      setPortalItems(data.items || []);
      setPortalPagination(data.pagination || null);
      setJumpPage(String(data.pagination?.currentPage || targetPage));
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Erro ao buscar no portal");
      setPortalItems([]);
    } finally {
      setPortalLoading(false);
    }
  }

  async function handlePortalSubmit(e: FormEvent) {
    e.preventDefault();
    await runPortalSearch(1);
  }

  async function handleImportSingle(url: string, openAfter: boolean) {
    setImportingUrl(url);
    try {
      const res = await fetch("/api/editions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      const first = data.imported?.[0];
      if (!res.ok || !first) {
        throw new Error(data.errors?.[0] || data.error || "Falha ao importar edição");
      }

      setPortalItems((prev) =>
        prev.map((item) =>
          item.url === url
            ? {
                ...item,
                localEditionId: first.editionId,
                localTotalActs: first.totalActs,
                isExtraOrSupplementary: first.isExtraOrSupplementary,
              }
            : item
        )
      );

      if (openAfter) {
        router.push(`/edicoes/${first.editionId}`);
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Erro ao importar edição");
    } finally {
      setImportingUrl(null);
    }
  }

  async function handleImportCurrentPortalPage() {
    const unsynced = portalItems.filter((i) => !i.localEditionId).map((i) => i.url);
    if (unsynced.length === 0) return;

    setBatchImporting(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/editions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: unsynced }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro na importação da página");
      }

      // Recarrega a página atual da busca para atualizar todos os badges "Já resumida"
      if (portalPagination) {
        await runPortalSearch(portalPagination.currentPage);
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Erro ao importar página");
    } finally {
      setBatchImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Busca no Diário Oficial (Local e Portal Paginado)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pesquise nos atos já classificados no banco local ou navegue diretamente pela
              paginação oficial de 2015–2026 em <strong>diariooficial.jaboatao.pe.gov.br</strong>.
            </p>
          </div>
        </div>

        {/* Alternador de modo de busca */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => setSearchScope("local")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
              searchScope === "local"
                ? "bg-[#0037C1] text-white shadow-2xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Banco Local (Atos Classificados)</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchScope("portal")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
              searchScope === "portal"
                ? "bg-[#0037C1] text-white shadow-2xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Procurar no Portal Oficial (2015–2026 • Paginado)</span>
          </button>
        </div>

        {/* Formulário Busca Local */}
        {searchScope === "local" ? (
          <form onSubmit={handleLocalSubmit} className="mt-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex.: Crédito Adicional, Nomear, Concorrência, Educação..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-[#0037C1] focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-[#0037C1] focus:bg-white focus:outline-none"
              >
                <option value="">Todas as Categorias</option>
                <option value="LEIS_E_ATOS_NORMATIVOS">Leis e Atos Normativos</option>
                <option value="ATOS_DE_PESSOAL">Atos de Pessoal</option>
                <option value="CONTRATOS_EDITAIS_AVISOS">Contratos, Editais e Avisos</option>
                <option value="OUTROS">Outros</option>
              </select>

              <button
                type="submit"
                disabled={localLoading}
                className="rounded-lg bg-[#0037C1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002355] disabled:opacity-60"
              >
                {localLoading ? "Buscando..." : "Pesquisar"}
              </button>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={onlyExtra}
                onChange={(e) => setOnlyExtra(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0037C1]"
              />
              Buscar apenas em Edições Extras e Suplementares
            </label>
          </form>
        ) : (
          /* Formulário Busca Paginada no Portal Oficial */
          <form onSubmit={handlePortalSubmit} className="mt-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={portalQuery}
                  onChange={(e) => setPortalQuery(e.target.value)}
                  placeholder="Termo no portal (ex.: pregão, nomeação, decreto) ou deixe vazio para navegar por ano/páginas"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-[#0037C1] focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={portalYear}
                onChange={(e) => setPortalYear(e.target.value)}
                disabled={Boolean(portalQuery.trim())}
                title="Filtro por ano disponível quando o termo de busca estiver vazio"
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-[#0037C1] focus:bg-white focus:outline-none disabled:opacity-50"
              >
                <option value="">Todos os anos (2015–2026)</option>
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map(
                  (y) => (
                    <option key={y} value={y}>
                      Ano {y}
                    </option>
                  )
                )}
              </select>

              <button
                type="submit"
                disabled={portalLoading}
                className="rounded-lg bg-[#0037C1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002355] disabled:opacity-60"
              >
                {portalLoading ? "Consultando portal..." : "Procurar no Portal"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Consulta ao vivo as páginas do site oficial e permite importar + gerar o resumo de
              qualquer edição encontrada com 1 clique.
            </p>
          </form>
        )}
      </div>

      {/* Resultados — Busca Local Paginada */}
      {searchScope === "local" && localSearched && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span>
              {localPagination?.total ?? localResults.length} resultado(s) encontrado(s)
              {localPagination && localPagination.totalPages > 1
                ? ` — Página ${localPagination.page} de ${localPagination.totalPages}`
                : ""}
            </span>
          </div>

          {localResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Nenhum ato encontrado no banco local. Experimente a aba{" "}
              <button
                type="button"
                onClick={() => {
                  setPortalQuery(query);
                  setSearchScope("portal");
                }}
                className="font-semibold text-[#0037C1] hover:underline"
              >
                Procurar no Portal Oficial (2015–2026)
              </button>
              !
            </div>
          ) : (
            <>
              {localResults.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-blue-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link
                          href={`/edicoes/${item.edition.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-[#0037C1] hover:underline"
                        >
                          <Calendar className="h-3 w-3" />
                          {formatDateBR(item.edition.publishedDateStr)} (Nº{" "}
                          {item.edition.editionNumber})
                        </Link>
                        {item.edition.isExtraOrSupplementary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                            <AlertTriangle className="h-3 w-3" />
                            Extra/Suplementar
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {CATEGORY_LABELS[item.category as ActCategory] || item.category} ·{" "}
                          {item.subType}
                        </span>
                        {item.monetaryValue && item.monetaryValue > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                            <Banknote className="h-3 w-3" />
                            {formatCurrencyBRL(item.monetaryValue)}
                          </span>
                        )}
                      </div>

                      <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                        {item.title}
                      </h2>

                      <p className="text-sm text-slate-600">{item.summary}</p>

                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3.5 w-3.5" />
                        {item.department}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAct(item)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#0037C1] hover:bg-blue-50"
                      >
                        Ler completo
                      </button>
                      <a
                        href={item.edition.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        title="Abrir no portal oficial"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}

              {localPagination && localPagination.totalPages > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
                  <button
                    type="button"
                    disabled={!localPagination.hasPrevPage || localLoading}
                    onClick={() => runLocalSearch(localPagination.page - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="font-semibold text-slate-600">
                    Página {localPagination.page} de {localPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!localPagination.hasNextPage || localLoading}
                    onClick={() => runLocalSearch(localPagination.page + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resultados — Busca Paginada no Portal Oficial */}
      {searchScope === "portal" && portalSearched && (
        <div className="space-y-4">
          {portalError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {portalError}
            </div>
          )}

          {portalPagination && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                <span className="font-bold text-slate-900">
                  Página {portalPagination.currentPage} de {portalPagination.maxPage}
                </span>
                <span>•</span>
                <span>{portalItems.length} edição(ões) nesta página do portal</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {portalItems.some((i) => !i.localEditionId) && (
                  <button
                    type="button"
                    disabled={batchImporting}
                    onClick={handleImportCurrentPortalPage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-[#0037C1] hover:bg-blue-100 disabled:opacity-60"
                  >
                    {batchImporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {batchImporting
                        ? "Importando página..."
                        : "Importar todas desta página"}
                    </span>
                  </button>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const p = Math.max(
                      1,
                      Math.min(portalPagination.maxPage, parseInt(jumpPage, 10) || 1)
                    );
                    runPortalSearch(p);
                  }}
                  className="inline-flex items-center gap-1"
                >
                  <span className="text-slate-500">Ir pág.:</span>
                  <input
                    type="number"
                    min={1}
                    max={portalPagination.maxPage}
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-xs"
                  />
                  <button
                    type="submit"
                    disabled={portalLoading}
                    className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Ir
                  </button>
                </form>
              </div>
            </div>
          )}

          {portalItems.length === 0 && !portalLoading && !portalError ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Nenhuma edição encontrada nesta página do portal oficial.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {portalItems.map((item) => {
                const isImporting = importingUrl === item.url;
                return (
                  <article
                    key={item.url}
                    className={`rounded-2xl border bg-white p-4 shadow-2xs transition hover:border-blue-300 ${
                      item.isExtraOrSupplementary
                        ? "border-amber-300 bg-amber-50/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-[#0037C1]">
                            <Calendar className="h-3 w-3" />
                            {formatDateBR(item.publishedDateStr)}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            Nº {item.editionNumber}
                          </span>
                          {item.isExtraOrSupplementary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-semibold text-white">
                              <AlertTriangle className="h-3 w-3" />
                              {EDITION_TYPE_LABELS[item.editionType as EditionType] ||
                                "Extra/Suplementar"}
                            </span>
                          )}
                          {item.localEditionId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Já resumida ({item.localTotalActs ?? 0} atos)
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                              Ainda não importada
                            </span>
                          )}
                        </div>

                        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                          {item.cardTitle}
                        </h2>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {item.localEditionId ? (
                          <Link
                            href={`/edicoes/${item.localEditionId}`}
                            className="rounded-lg bg-[#0037C1] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#002355]"
                          >
                            Abrir Resumo
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled={isImporting || batchImporting}
                            onClick={() => handleImportSingle(item.url, true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {isImporting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {isImporting ? "Importando..." : "Importar e Resumir"}
                            </span>
                          </button>
                        )}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>Site Oficial</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {portalPagination && (portalPagination.hasPrevPage || portalPagination.hasNextPage) && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
              <button
                type="button"
                disabled={!portalPagination.hasPrevPage || portalLoading}
                onClick={() =>
                  portalPagination.prevPage && runPortalSearch(portalPagination.prevPage)
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Página Anterior
              </button>

              <span className="font-semibold text-slate-600">
                Página {portalPagination.currentPage} de {portalPagination.maxPage}
              </span>

              <button
                type="button"
                disabled={!portalPagination.hasNextPage || portalLoading}
                onClick={() =>
                  portalPagination.nextPage && runPortalSearch(portalPagination.nextPage)
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima Página
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <ActDetailModal
        act={selectedAct}
        editionUrl={selectedAct?.edition.url || ""}
        editionTitle={selectedAct?.edition.title || ""}
        onClose={() => setSelectedAct(null)}
      />
    </div>
  );
}
