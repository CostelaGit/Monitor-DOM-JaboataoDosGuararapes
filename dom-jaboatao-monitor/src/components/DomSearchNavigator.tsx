"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Download,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Newspaper,
  Radar,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  ActCategory,
  CATEGORY_LABELS,
  EDITION_TYPE_LABELS,
  EditionType,
  formatCurrencyBRL,
  formatDateBR,
} from "@/lib/types";
import {
  SEARCH_NAVIGATOR_PRESETS,
  SearchNavigatorCriteria,
  SearchNavigatorPreset,
  buildNavigatorUrlParams,
  computeSearchImpactSummary,
  hasActiveSearchCriteria,
  isPresetMatchingCriteria,
} from "@/lib/searchNavigatorConfig";
import { ActDetailModal, ActViewItem } from "./ActDetailModal";
import { EditionDashboard, EditionDetailView } from "./EditionDashboard";
import { SyncButton } from "./SyncButton";

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

export interface RadarDashboardData {
  edition: EditionDetailView;
  allEditions: {
    id: string;
    publishedDateStr: string;
    editionNumber: string;
    editionType: string;
    isExtraOrSupplementary: boolean;
    title: string;
  }[];
  recentExtraEditions: {
    id: string;
    publishedDateStr: string;
    editionNumber: string;
    editionType: string;
    title: string;
  }[];
  sameDaySiblings: {
    id: string;
    publishedDateStr: string;
    editionNumber: string;
    editionType: string;
    isExtraOrSupplementary: boolean;
    title: string;
  }[];
  lastSyncDate: string | null;
}

interface DomSearchNavigatorProps {
  radarData?: RadarDashboardData | null;
  initialCriteria?: Partial<SearchNavigatorCriteria>;
  forceSearchView?: boolean;
  basePath?: string;
}

type ResultTabMode = "unified" | "local" | "portal";

const PORTAL_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

export function DomSearchNavigator({
  radarData = null,
  initialCriteria,
  forceSearchView = false,
  basePath = "/",
}: DomSearchNavigatorProps) {
  const router = useRouter();

  // Estado dos inputs na barra principal (Omnibox)
  const [query, setQuery] = useState(initialCriteria?.query || "");
  const [category, setCategory] = useState(initialCriteria?.category || "");
  const [onlyExtra, setOnlyExtra] = useState(Boolean(initialCriteria?.onlyExtra));
  const [year, setYear] = useState(initialCriteria?.year || "");

  // Critério efetivamente submetido/ativo no navegador
  const [activeCriteria, setActiveCriteria] = useState<SearchNavigatorCriteria>({
    query: initialCriteria?.query || "",
    category: initialCriteria?.category || "",
    onlyExtra: Boolean(initialCriteria?.onlyExtra),
    year: initialCriteria?.year || "",
  });

  const [hasSubmittedSearch, setHasSubmittedSearch] = useState<boolean>(() =>
    hasActiveSearchCriteria(initialCriteria || {})
  );
  const [resultTab, setResultTab] = useState<ResultTabMode>("unified");

  // Estado Busca Local (/api/search)
  const [localLoading, setLocalLoading] = useState(false);
  const [localResults, setLocalResults] = useState<LocalSearchResultItem[]>([]);
  const [localPagination, setLocalPagination] = useState<LocalPagination | null>(null);
  const [selectedAct, setSelectedAct] = useState<LocalSearchResultItem | null>(null);

  // Estado Busca no Portal Oficial (/api/portal-search)
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalItems, setPortalItems] = useState<PortalSearchItem[]>([]);
  const [portalPagination, setPortalPagination] = useState<PortalPagination | null>(null);
  const [jumpPage, setJumpPage] = useState("1");
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  const isSearchModeActive =
    hasSubmittedSearch && hasActiveSearchCriteria(activeCriteria);

  const syncUrlParams = useCallback(
    (criteria: SearchNavigatorCriteria) => {
      if (typeof window === "undefined") return;
      const qs = buildNavigatorUrlParams(criteria, radarData?.edition.id);
      const nextUrl = qs ? `${basePath}?${qs}` : basePath;
      window.history.replaceState(null, "", nextUrl);
    },
    [basePath, radarData?.edition.id]
  );

  const runLocalSearch = useCallback(
    async (criteria: SearchNavigatorCriteria, targetPage = 1) => {
      if (!criteria.query.trim() && !criteria.category && !criteria.onlyExtra) {
        setLocalResults([]);
        setLocalPagination(null);
        return;
      }

      setLocalLoading(true);
      try {
        const params = new URLSearchParams();
        if (criteria.query.trim()) params.set("q", criteria.query.trim());
        if (criteria.category) params.set("category", criteria.category);
        if (criteria.onlyExtra) params.set("onlyExtra", "true");
        params.set("page", String(targetPage));
        params.set("pageSize", "15");

        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();
        setLocalResults(data.results || []);
        setLocalPagination(data.pagination || null);
      } finally {
        setLocalLoading(false);
      }
    },
    []
  );

  const runPortalSearch = useCallback(
    async (criteria: SearchNavigatorCriteria, targetPage = 1) => {
      setPortalLoading(true);
      setPortalError(null);
      try {
        const params = new URLSearchParams();
        if (criteria.query.trim()) params.set("q", criteria.query.trim());
        if (!criteria.query.trim() && criteria.year) params.set("year", criteria.year);
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
    },
    []
  );

  const executeUnifiedNavigation = useCallback(
    async (criteria: SearchNavigatorCriteria) => {
      setActiveCriteria(criteria);
      if (!hasActiveSearchCriteria(criteria)) {
        setHasSubmittedSearch(false);
        syncUrlParams(criteria);
        return;
      }

      setHasSubmittedSearch(true);
      syncUrlParams(criteria);

      // Se o usuário selecionou apenas um ano do portal sem termo/categoria local, foca na visão do portal
      if (!criteria.query.trim() && !criteria.category && !criteria.onlyExtra && criteria.year) {
        setResultTab("portal");
      }

      await Promise.all([
        runLocalSearch(criteria, 1),
        runPortalSearch(criteria, 1),
      ]);
    },
    [runLocalSearch, runPortalSearch, syncUrlParams]
  );

  useEffect(() => {
    if (hasActiveSearchCriteria(initialCriteria || {})) {
      const init: SearchNavigatorCriteria = {
        query: initialCriteria?.query || "",
        category: initialCriteria?.category || "",
        onlyExtra: Boolean(initialCriteria?.onlyExtra),
        year: initialCriteria?.year || "",
      };
      void executeUnifiedNavigation(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    await executeUnifiedNavigation({
      query,
      category,
      onlyExtra,
      year,
    });
  }

  async function handlePresetClick(preset: SearchNavigatorPreset) {
    if (isSearchModeActive && isPresetMatchingCriteria(preset, activeCriteria)) {
      handleResetToRadar();
      return;
    }

    setQuery(preset.criteria.query);
    setCategory(preset.criteria.category);
    setOnlyExtra(preset.criteria.onlyExtra);
    setYear(preset.criteria.year);
    await executeUnifiedNavigation(preset.criteria);
  }

  function handleResetToRadar() {
    const emptyCriteria: SearchNavigatorCriteria = {
      query: "",
      category: "",
      onlyExtra: false,
      year: "",
    };
    setQuery("");
    setCategory("");
    setOnlyExtra(false);
    setYear("");
    setActiveCriteria(emptyCriteria);
    setHasSubmittedSearch(false);
    setLocalResults([]);
    setLocalPagination(null);
    setPortalItems([]);
    setPortalPagination(null);
    setPortalError(null);
    syncUrlParams(emptyCriteria);
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
      } else {
        await runLocalSearch(activeCriteria, localPagination?.page || 1);
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

      await Promise.all([
        runLocalSearch(activeCriteria, 1),
        portalPagination
          ? runPortalSearch(activeCriteria, portalPagination.currentPage)
          : Promise.resolve(),
      ]);
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Erro ao importar página");
    } finally {
      setBatchImporting(false);
    }
  }

  const impactSummary = useMemo(
    () =>
      computeSearchImpactSummary(
        localResults,
        localPagination?.total ?? localResults.length,
        portalItems.length,
        portalPagination?.maxPage ?? 1
      ),
    [localResults, localPagination?.total, portalItems.length, portalPagination?.maxPage]
  );

  return (
    <div className="space-y-6">
      {/* HERO OMNIBOX: Barra de Pesquisa como Navegador Principal do DOM */}
      <section
        aria-label="Navegador de Pesquisa do Diário Oficial"
        className="relative overflow-hidden rounded-3xl border border-blue-900/20 bg-gradient-to-br from-[#002355] via-[#0037C1] to-[#0046EB] p-5 text-white shadow-md sm:p-7"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FDC300] text-[#002355] shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-yellow-300">
                Navegador Inteligente do DOM • 2015–2026
              </span>
              <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-2xl">
                O que você procura no Diário Oficial de Jaboatão?
              </h1>
            </div>
          </div>

          {isSearchModeActive && !forceSearchView && (
            <button
              type="button"
              onClick={handleResetToRadar}
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/25 sm:self-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar ao Radar de Hoje</span>
            </button>
          )}
        </div>

        <form onSubmit={handleFormSubmit} className="mt-4 space-y-3">
          {/* Barra Omnibox Principal */}
          <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-2 text-slate-900 shadow-lg sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0037C1]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquise servidor, empresa, lei, decreto, pregão, secretaria, data ou nº da edição..."
                aria-label="Pesquisar nos Diários Oficiais de Jaboatão dos Guararapes"
                className="w-full rounded-xl bg-transparent py-3 pl-11 pr-9 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  title="Limpar texto"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filtrar por categoria de ato"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-[#0037C1] focus:bg-white focus:outline-none sm:w-auto"
              >
                <option value="">Todas as Categorias</option>
                <option value="LEIS_E_ATOS_NORMATIVOS">Leis e Atos Normativos</option>
                <option value="ATOS_DE_PESSOAL">Atos de Pessoal</option>
                <option value="CONTRATOS_EDITAIS_AVISOS">Contratos, Editais e Avisos</option>
                <option value="OUTROS">Outros Atos</option>
              </select>

              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label="Navegar por ano no portal oficial"
                title="Filtra edições por ano no Portal Oficial (2015–2026)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-[#0037C1] focus:bg-white focus:outline-none sm:w-auto"
              >
                <option value="">Portal: Todos os Anos</option>
                {PORTAL_YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    Portal: Ano {y}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={localLoading || portalLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FDC300] px-5 py-3 text-sm font-extrabold text-[#002355] shadow-xs transition hover:bg-yellow-400 disabled:opacity-60 sm:w-auto"
              >
                {localLoading || portalLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Navegando...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Explorar DOM</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Linha de Chips Rápidos de Exploração + Filtro de Edições Extras */}
          <div className="flex flex-col gap-2.5 pt-1 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-blue-100">
                Navegação rápida:
              </span>
              {SEARCH_NAVIGATOR_PRESETS.map((preset) => {
                const active =
                  isSearchModeActive && isPresetMatchingCriteria(preset, activeCriteria);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    title={preset.description}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-[#FDC300] text-[#002355] shadow-xs"
                        : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-200 transition hover:bg-white/15 lg:self-auto">
              <input
                type="checkbox"
                checked={onlyExtra}
                onChange={(e) => setOnlyExtra(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/40 text-[#FDC300]"
              />
              <span>Somente Edições Extras / Suplementares</span>
            </label>
          </div>
        </form>
      </section>

      {/* ÁREA DINÂMICA: Resultados da Pesquisa Unificada OU Radar de Hoje */}
      {isSearchModeActive ? (
        <section aria-label="Resultados da Pesquisa no DOM" className="space-y-5">
          {/* Painel de Síntese do Termo Navegado */}
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0037C1]">
                    <Compass className="h-3.5 w-3.5" />
                    Exploração Ativa
                  </span>
                  {activeCriteria.query && (
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                      Termo: &ldquo;{activeCriteria.query}&rdquo;
                    </span>
                  )}
                  {activeCriteria.category && (
                    <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                      {CATEGORY_LABELS[activeCriteria.category as ActCategory] ||
                        activeCriteria.category}
                    </span>
                  )}
                  {activeCriteria.onlyExtra && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="h-3 w-3" />
                      Somente Extras/Suplementares
                    </span>
                  )}
                  {activeCriteria.year && (
                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                      Ano no Portal: {activeCriteria.year}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Resultados combinados do banco local de atos classificados e da busca ao vivo no
                  portal oficial (2015–2026).
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetToRadar}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#0037C1] sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpar Pesquisa e Ver Radar de Hoje</span>
              </button>
            </div>

            {/* KPIs de Impacto da Busca */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Atos Classificados (Banco Local)</span>
                  <Database className="h-4 w-4 text-[#0037C1]" />
                </div>
                <p className="mt-1.5 text-2xl font-extrabold text-slate-900">
                  {localLoading ? "..." : impactSummary.totalLocalActs}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {impactSummary.distinctDepartments.length > 0
                    ? `${impactSummary.distinctDepartments.length} órgão(s)/secretaria(s) nesta página`
                    : "Atos destrinchados nas edições coletadas"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Valores Citados nesta Página</span>
                  <Banknote className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-1.5 text-xl font-extrabold text-emerald-800">
                  {impactSummary.pageMonetarySum > 0
                    ? formatCurrencyBRL(impactSummary.pageMonetarySum)
                    : "R$ 0,00"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {impactSummary.actsWithMonetaryCount > 0
                    ? `Soma de ${impactSummary.actsWithMonetaryCount} ato(s) com valor financeiro`
                    : "Nenhum valor monetário explícito nos atos listados"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Edições no Portal Oficial (2015–2026)</span>
                  <Globe className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="mt-1.5 text-2xl font-extrabold text-slate-900">
                  {portalLoading
                    ? "..."
                    : `${impactSummary.portalPageItemsCount} edição(ões)`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {portalPagination
                    ? `Página ${portalPagination.currentPage} de ${portalPagination.maxPage} no site oficial`
                    : "Importe e resuma qualquer edição com 1 clique"}
                </p>
              </div>
            </div>

            {/* Alternador de Visão dos Resultados */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setResultTab("unified")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  resultTab === "unified"
                    ? "bg-[#0037C1] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Visão Unificada (Local + Portal)</span>
              </button>
              <button
                type="button"
                onClick={() => setResultTab("local")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  resultTab === "local"
                    ? "bg-[#0037C1] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>
                  Atos no Banco Local ({localPagination?.total ?? localResults.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setResultTab("portal")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  resultTab === "portal"
                    ? "bg-[#0037C1] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>
                  Portal Oficial 2015–2026 ({portalItems.length} nesta pág.)
                </span>
              </button>
            </div>
          </div>

          {/* BLOCO 1: Atos Classificados no Banco Local */}
          {(resultTab === "unified" || resultTab === "local") && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Database className="h-4 w-4 text-[#0037C1]" />
                  <span>Atos Classificados no Banco Local</span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#0037C1]">
                    {localPagination?.total ?? localResults.length}
                  </span>
                </h2>
                {localPagination && localPagination.totalPages > 1 && (
                  <span className="text-xs font-semibold text-slate-500">
                    Página {localPagination.page} de {localPagination.totalPages}
                  </span>
                )}
              </div>

              {localLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin text-[#0037C1]" />
                  <span>Pesquisando nos atos classificados localmente...</span>
                </div>
              ) : localResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">
                    Nenhum ato classificado encontrado no banco local para este filtro.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Confira logo abaixo as edições encontradas diretamente no{" "}
                    <strong>Portal Oficial (2015–2026)</strong> e clique em{" "}
                    <strong>Importar e Resumir</strong> para destrinchar os atos!
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
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
                                {CATEGORY_LABELS[item.category as ActCategory] ||
                                  item.category}{" "}
                                · {item.subType}
                              </span>
                              {item.monetaryValue && item.monetaryValue > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                                  <Banknote className="h-3 w-3" />
                                  {formatCurrencyBRL(item.monetaryValue)}
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                              {item.title}
                            </h3>

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
                  </div>

                  {localPagination && localPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
                      <button
                        type="button"
                        disabled={!localPagination.hasPrevPage || localLoading}
                        onClick={() =>
                          runLocalSearch(activeCriteria, localPagination.page - 1)
                        }
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
                        onClick={() =>
                          runLocalSearch(activeCriteria, localPagination.page + 1)
                        }
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

          {/* BLOCO 2: Edições Encontradas no Portal Oficial (2015–2026) */}
          {(resultTab === "unified" || resultTab === "portal") && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Globe className="h-4 w-4 text-indigo-600" />
                    <span>Edições no Portal Oficial (2015–2026)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pesquisa ao vivo em <strong>diariooficial.jaboatao.pe.gov.br</strong>.
                    Importe e gere o resumo de qualquer edição antiga ou recente com 1 clique.
                  </p>
                </div>
              </div>

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
                          Math.min(
                            portalPagination.maxPage,
                            parseInt(jumpPage, 10) || 1
                          )
                        );
                        void runPortalSearch(activeCriteria, p);
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

              {portalLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span>Consultando páginas do portal oficial do DOM...</span>
                </div>
              ) : portalItems.length === 0 && !portalError ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Nenhuma edição retornada pelo portal oficial para esta consulta.
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
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Já resumida ({item.localTotalActs ?? 0} atos)
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                                  Ainda não importada
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                              {item.cardTitle}
                            </h3>
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

              {portalPagination &&
                (portalPagination.hasPrevPage || portalPagination.hasNextPage) && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
                    <button
                      type="button"
                      disabled={!portalPagination.hasPrevPage || portalLoading}
                      onClick={() =>
                        portalPagination.prevPage &&
                        runPortalSearch(activeCriteria, portalPagination.prevPage)
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
                        portalPagination.nextPage &&
                        runPortalSearch(activeCriteria, portalPagination.nextPage)
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
        </section>
      ) : (
        /* ESTADO PADRÃO (Sem busca ativa): RADAR DE HOJE */
        <section aria-label="Radar de Hoje — Edição em Destaque" className="space-y-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-blue-200/80 bg-white px-5 py-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0037C1]">
                <Radar className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0037C1]">
                    Radar de Hoje
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Resumo da Edição do Dia
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Acompanhe abaixo o resumo da edição atual ou use a barra de pesquisa acima para
                  navegar por qualquer assunto nos Diários Oficiais.
                </p>
              </div>
            </div>

            {radarData && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Sparkles className="h-3.5 w-3.5 text-[#0037C1]" />
                {formatDateBR(radarData.edition.publishedDateStr)} • Edição Nº{" "}
                {radarData.edition.editionNumber}
              </span>
            )}
          </div>

          {radarData ? (
            <EditionDashboard
              edition={radarData.edition}
              allEditions={radarData.allEditions}
              recentExtraEditions={radarData.recentExtraEditions}
              sameDaySiblings={radarData.sameDaySiblings}
              lastSyncDate={radarData.lastSyncDate}
            />
          ) : (
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0037C1]">
                <Newspaper className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Nenhuma edição sincronizada no Radar de Hoje ainda
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Você já pode pesquisar qualquer termo na barra acima para consultar diretamente o{" "}
                <strong>Portal Oficial (2015–2026)</strong>, ou clicar abaixo para coletar e
                resumir as edições mais recentes.
              </p>
              <div className="mt-6 flex justify-center">
                <SyncButton pages={3} limit={24} label="Coletar Edições Agora" />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
