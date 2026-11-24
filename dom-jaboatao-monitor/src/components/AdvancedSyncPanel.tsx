"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type PanelMode = "incremental" | "dateRange" | "year" | "pageRange" | "search";

export function AdvancedSyncPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("dateRange");
  const [dateFrom, setDateFrom] = useState("2026-10-01");
  const [dateTo, setDateTo] = useState("2026-11-24");
  const [year, setYear] = useState("2026");
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("5");
  const [searchTerm, setSearchTerm] = useState("");
  const [maxPages, setMaxPages] = useState("5");
  const [limit, setLimit] = useState("30");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
    detail?: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const payload: Record<string, unknown> = {
      mode,
      limit: Math.max(1, Math.min(200, Number(limit) || 30)),
    };

    if (mode === "incremental") {
      payload.maxPages = Math.max(1, Math.min(20, Number(maxPages) || 5));
      payload.stopOnExistingPage = true;
    } else if (mode === "dateRange") {
      payload.dateFrom = dateFrom || undefined;
      payload.dateTo = dateTo || undefined;
      payload.maxPages = Math.max(1, Math.min(50, Number(maxPages) || 15));
    } else if (mode === "year") {
      payload.year = Number(year) || 2026;
      payload.maxPages = Math.max(1, Math.min(30, Number(maxPages) || 10));
    } else if (mode === "pageRange") {
      payload.startPage = Math.max(1, Number(startPage) || 1);
      payload.endPage = Math.max(Number(startPage) || 1, Number(endPage) || 5);
    } else if (mode === "search") {
      payload.searchTerm = searchTerm.trim();
      payload.maxPages = Math.max(1, Math.min(15, Number(maxPages) || 3));
    }

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.errors?.[0] || data.error || "Erro na sincronização paginada");
      }

      setFeedback({
        ok: true,
        text: `Coleta concluída: ${data.pagesScanned} página(s) percorrida(s) (até pág. ${data.lastPageScanned} de ${data.totalPortalPages}), ${data.newEditionsCount} nova(s) edição(ões) importada(s), ${data.extraEditionsDetected} extra(s)/suplementar(es).`,
        detail: data.stoppedEarlyReason,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Falha na coleta paginada",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-slate-50/70"
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-50 p-1.5 text-[#0037C1]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Coleta Paginada Avançada do Portal (Ano, Período, Faixa de Páginas ou Termo)
            </h2>
            <p className="text-xs text-slate-500">
              Navegue automaticamente pela paginação de 2015–2026 do portal oficial para importar
              edições específicas.
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 border-t border-slate-100 px-5 py-4"
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["dateRange", "Por Período (Datas)"],
                ["year", "Por Ano (Categoria)"],
                ["pageRange", "Por Faixa de Páginas"],
                ["search", "Por Termo no Portal"],
                ["incremental", "Incremental (Parada Antecipada)"],
              ] as [PanelMode, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === key
                    ? "bg-[#0037C1] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mode === "dateRange" && (
              <>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Data inicial</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Data final</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Máx. páginas a percorrer</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {mode === "year" && (
              <>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Ano oficial</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Máx. páginas do ano</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {mode === "pageRange" && (
              <>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Página inicial (1..234)</span>
                  <input
                    type="number"
                    min={1}
                    max={250}
                    value={startPage}
                    onChange={(e) => setStartPage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Página final</span>
                  <input
                    type="number"
                    min={1}
                    max={250}
                    value={endPage}
                    onChange={(e) => setEndPage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {mode === "search" && (
              <>
                <label className="space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
                  <span>Termo de busca no portal oficial</span>
                  <input
                    type="text"
                    required
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ex.: pregão, concurso, saúde, pavimentação..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Máx. páginas da busca</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}

            {mode === "incremental" && (
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Máx. páginas até parar</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            )}

            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Limite de novas edições</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">
              Edições já salvas no banco são puladas automaticamente para evitar requisições
              desnecessárias.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0037C1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#002355] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Percorrendo páginas e coletando..." : "Executar Coleta Paginada"}</span>
            </button>
          </div>

          {feedback && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                feedback.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <div className="flex items-start gap-2">
                {feedback.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{feedback.text}</p>
                  {feedback.detail && <p className="mt-0.5 opacity-85">{feedback.detail}</p>}
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
