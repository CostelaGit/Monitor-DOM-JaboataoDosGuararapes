"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Scale,
  Search,
  Sparkles,
  Users,
  Banknote,
  CheckCircle2,
  Paperclip,
  Copy,
  Check,
  Info,
} from "lucide-react";
import {
  ActCategory,
  EDITION_TYPE_LABELS,
  EditionType,
  formatCurrencyBRL,
  formatDateBR,
} from "@/lib/types";
import { ActDetailModal, ActViewItem } from "./ActDetailModal";
import { SyncButton } from "./SyncButton";

export interface EditionSummaryItem {
  id: string;
  url: string;
  publishedDateStr: string;
  editionNumber: string;
  romanYear: string;
  title: string;
  editionType: string;
  isExtraOrSupplementary: boolean;
  extraReason: string | null;
  executiveSummary: string[];
  aiSummary: string | null;
  totalActs: number;
  totalNormative: number;
  totalPersonnel: number;
  totalContracts: number;
  totalOthers: number;
  totalAppointments: number;
  totalDismissals: number;
  totalMonetaryValue: number;
}

export interface EditionDetailView extends EditionSummaryItem {
  acts: ActViewItem[];
  attachments: { id: string; label: string; url: string }[];
}

interface EditionDashboardProps {
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
  sameDaySiblings?: {
    id: string;
    publishedDateStr: string;
    editionNumber: string;
    editionType: string;
    isExtraOrSupplementary: boolean;
    title: string;
  }[];
  lastSyncDate: string | null;
}

type ActiveTab = "ALL" | ActCategory;

export function EditionDashboard({
  edition,
  allEditions,
  recentExtraEditions,
  sameDaySiblings = [],
  lastSyncDate,
}: EditionDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [localQuery, setLocalQuery] = useState<string>("");
  const [selectedAct, setSelectedAct] = useState<ActViewItem | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopySummary() {
    const typeLabel =
      EDITION_TYPE_LABELS[edition.editionType as EditionType] || edition.editionType;
    const header = `*DOM Jaboatão dos Guararapes — ${formatDateBR(edition.publishedDateStr)} (Nº ${edition.editionNumber} • ${typeLabel})*`;
    const bullets = edition.executiveSummary.map((line) => `• ${line}`).join("\n");
    const extraAi = edition.aiSummary ? `\n\n_${edition.aiSummary}_` : "";
    const text = `${header}\n\n${bullets}${extraAi}\n\nFonte oficial: ${edition.url}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback caso clipboard não esteja disponível
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const currentIdx = allEditions.findIndex((e) => e.id === edition.id);
  const newerEdition = currentIdx > 0 ? allEditions[currentIdx - 1] : null;
  const olderEdition =
    currentIdx >= 0 && currentIdx < allEditions.length - 1
      ? allEditions[currentIdx + 1]
      : null;

  const departments = useMemo(() => {
    const set = new Set<string>();
    edition.acts.forEach((a) => set.add(a.department));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [edition.acts]);

  const filteredActs = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    return edition.acts.filter((act) => {
      if (activeTab !== "ALL" && act.category !== activeTab) return false;
      if (selectedDept !== "ALL" && act.department !== selectedDept) return false;
      if (q) {
        const hay = `${act.title} ${act.summary} ${act.department} ${act.subType} ${act.actNumber || ""} ${act.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [edition.acts, activeTab, selectedDept, localQuery]);

  const showPersonnelTable =
    activeTab === "ATOS_DE_PESSOAL" &&
    filteredActs.some((a) => a.metadata?.personName || a.metadata?.action);

  return (
    <div className="space-y-6">
      {/* Banner de Edição Extraordinária / Suplementar da edição atual */}
      {edition.isExtraOrSupplementary && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-400/30 p-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase text-white">
                  {EDITION_TYPE_LABELS[edition.editionType as EditionType] ||
                    edition.editionType}
                </span>
                <span className="text-sm font-bold">
                  Atenção: esta é uma publicação fora da edição ordinária!
                </span>
              </div>
              {edition.extraReason && (
                <p className="mt-1 text-xs text-amber-900/90">
                  Motivo da detecção: {edition.extraReason}.
                </p>
              )}
            </div>
          </div>
          <a
            href={edition.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <span>Conferir no Portal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Alerta cruzado quando a mesma data possui outra edição (ex.: Ordinária + Extraordinária) */}
      {sameDaySiblings.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-amber-950 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold">
                Esta data ({formatDateBR(edition.publishedDateStr)}) possui outra publicação
                associada:
              </span>{" "}
              {sameDaySiblings.map((sib) => (
                <span key={sib.id} className="mr-2">
                  Nº {sib.editionNumber} (
                  {EDITION_TYPE_LABELS[sib.editionType as EditionType] || sib.editionType})
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sameDaySiblings.map((sib) => (
              <Link
                key={sib.id}
                href={`/edicoes/${sib.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Ver Nº {sib.editionNumber}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Faixa rápida de verificação de Edições Extras e Suplementares */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700">
            Status de Edições Extras / Suplementares:
          </span>
          {recentExtraEditions.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900">
                <AlertTriangle className="h-3 w-3" />
                {recentExtraEditions.length} detectada(s) no histórico coletado
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {recentExtraEditions.slice(0, 3).map((ex) => (
                  <Link
                    key={ex.id}
                    href={`/edicoes/${ex.id}`}
                    className={`rounded-md border px-2 py-0.5 font-medium transition ${
                      ex.id === edition.id
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    }`}
                  >
                    {formatDateBR(ex.publishedDateStr)} (Nº {ex.editionNumber})
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Nenhuma edição extra ou suplementar nas edições coletadas
            </span>
          )}
        </div>
        <Link
          href="/historico?onlyExtra=true"
          className="font-semibold text-[#0037C1] hover:underline"
        >
          Ver todas as extras →
        </Link>
      </div>

      {/* Cabeçalho da Edição + Seletor + Sincronização */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-[#0037C1]">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateBR(edition.publishedDateStr)}
            </span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              Edição Nº {edition.editionNumber}
              {edition.romanYear ? ` • Ano ${edition.romanYear}` : ""}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 font-semibold ${
                edition.isExtraOrSupplementary
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {EDITION_TYPE_LABELS[edition.editionType as EditionType] ||
                edition.editionType}
            </span>
            {lastSyncDate && (
              <span className="text-slate-400">
                Última coleta: {lastSyncDate}
              </span>
            )}
          </div>

          <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {edition.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50">
              <button
                type="button"
                disabled={!olderEdition}
                onClick={() => olderEdition && router.push(`/edicoes/${olderEdition.id}`)}
                className="inline-flex items-center gap-1 border-r border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                title="Edição anterior"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <select
                value={edition.id}
                onChange={(e) => router.push(`/edicoes/${e.target.value}`)}
                aria-label="Selecionar edição do Diário Oficial"
                className="max-w-[240px] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none sm:max-w-[320px]"
              >
                {allEditions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {formatDateBR(ed.publishedDateStr)} — Nº {ed.editionNumber}
                    {ed.isExtraOrSupplementary
                      ? ` [${ed.editionType === "SUPLEMENTAR" ? "SUPLEMENTAR" : "EXTRA"}]`
                      : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!newerEdition}
                onClick={() => newerEdition && router.push(`/edicoes/${newerEdition.id}`)}
                className="inline-flex items-center gap-1 border-l border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                title="Edição mais recente"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <a
              href={edition.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#0037C1] transition hover:bg-blue-100"
            >
              <span>Abrir Edição Oficial</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="shrink-0">
          <SyncButton pages={2} limit={15} label="Sincronizar Agora" />
        </div>
      </div>

      {/* Card Principal: RESUMO DA EDIÇÃO */}
      <section className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-white to-blue-50/50 p-6 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#0037C1] p-1.5 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Resumo Geral desta Edição
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {edition.totalActs} ato(s) analisado(s)
            </span>
            <button
              type="button"
              onClick={handleCopySummary}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                copied
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-[#0037C1]"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Resumo copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Resumo (WhatsApp)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {edition.aiSummary && (
          <p className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-sm leading-relaxed text-indigo-950">
            {edition.aiSummary}
          </p>
        )}

        <ul className="space-y-2 text-sm text-slate-700">
          {edition.executiveSummary.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0037C1]" />
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>

        {/* Anexos PDF da Edição */}
        {edition.attachments.length > 0 && (
          <div className="mt-4 border-t border-slate-200/80 pt-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Paperclip className="h-3.5 w-3.5" />
              Anexos PDF encontrados nesta edição ({edition.attachments.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {edition.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0037C1] hover:border-blue-300 hover:bg-blue-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-xs truncate">{att.label}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Cards de Indicadores (KPIs clicáveis por categoria) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("LEIS_E_ATOS_NORMATIVOS")}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            activeTab === "LEIS_E_ATOS_NORMATIVOS"
              ? "border-[#0037C1] bg-blue-50/70 ring-2 ring-[#0037C1]/20"
              : "border-slate-200 bg-white hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Leis e Atos Normativos
            </span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">
              {edition.totalNormative}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Leis, decretos, portarias normativas e resoluções
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ATOS_DE_PESSOAL")}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            activeTab === "ATOS_DE_PESSOAL"
              ? "border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20"
              : "border-slate-200 bg-white hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Atos de Pessoal
            </span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">
              {edition.totalPersonnel}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              <span className="font-semibold text-emerald-700">
                {edition.totalAppointments} nomeação(ões)
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-rose-700">
                {edition.totalDismissals} exoneração(ões)
              </span>
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CONTRATOS_EDITAIS_AVISOS")}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            activeTab === "CONTRATOS_EDITAIS_AVISOS"
              ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contratos, Editais e Avisos
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">
              {edition.totalContracts}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Licitações, dispensas, extratos, atas e avisos
            </p>
          </div>
        </button>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo & Valores
            </span>
            <div
              className={`rounded-lg p-2 ${
                edition.isExtraOrSupplementary
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-base font-bold text-slate-900">
              {edition.isExtraOrSupplementary
                ? EDITION_TYPE_LABELS[edition.editionType as EditionType]
                : "Edição Ordinária"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {edition.totalMonetaryValue > 0
                ? `Valores citados: ${formatCurrencyBRL(edition.totalMonetaryValue)}`
                : "Sem valores financeiros destacados"}
            </p>
          </div>
        </div>
      </section>

      {/* Abas de Categorias e Barra de Filtros */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <TabButton
              active={activeTab === "ALL"}
              onClick={() => setActiveTab("ALL")}
              label="Todos os Atos"
              count={edition.totalActs}
            />
            <TabButton
              active={activeTab === "LEIS_E_ATOS_NORMATIVOS"}
              onClick={() => setActiveTab("LEIS_E_ATOS_NORMATIVOS")}
              label="Leis e Atos Normativos"
              count={edition.totalNormative}
            />
            <TabButton
              active={activeTab === "ATOS_DE_PESSOAL"}
              onClick={() => setActiveTab("ATOS_DE_PESSOAL")}
              label="Atos de Pessoal"
              count={edition.totalPersonnel}
            />
            <TabButton
              active={activeTab === "CONTRATOS_EDITAIS_AVISOS"}
              onClick={() => setActiveTab("CONTRATOS_EDITAIS_AVISOS")}
              label="Contratos, Editais e Avisos"
              count={edition.totalContracts}
            />
            {edition.totalOthers > 0 && (
              <TabButton
                active={activeTab === "OUTROS"}
                onClick={() => setActiveTab("OUTROS")}
                label="Outros"
                count={edition.totalOthers}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Filtrar nesta edição por nome, decreto, contrato, empresa ou secretaria..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0037C1] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                aria-label="Filtrar por órgão ou secretaria"
                className="max-w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#0037C1] focus:bg-white focus:outline-none sm:max-w-[280px]"
              >
                <option value="ALL">Todos os Órgãos / Secretarias ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Atos */}
        {filteredActs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nenhum ato encontrado com os filtros selecionados nesta edição.
          </div>
        ) : showPersonnelTable ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Ação / Tipo</th>
                    <th className="px-4 py-3">Servidor / Assunto</th>
                    <th className="px-4 py-3">Cargo / Símbolo</th>
                    <th className="px-4 py-3">Órgão / Secretaria</th>
                    <th className="px-4 py-3 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActs.map((act) => {
                    const action = act.metadata?.action || act.subType;
                    const badgeColor =
                      action === "Nomeação"
                        ? "bg-emerald-100 text-emerald-800"
                        : action === "Exoneração"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-purple-100 text-purple-800";

                    return (
                      <tr key={act.id} className="hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}
                          >
                            {action}
                          </span>
                          {act.actNumber && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {act.actNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {act.metadata?.personName || act.title}
                          {act.metadata?.matricula && (
                            <p className="text-xs font-normal text-slate-500">
                              Matrícula: {act.metadata.matricula}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {act.metadata?.role ? (
                            <>
                              <span className="font-medium">{act.metadata.role}</span>
                              {act.metadata.symbol && (
                                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {act.metadata.symbol}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="line-clamp-2 text-slate-500">{act.summary}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {act.metadata?.targetDepartment || act.department}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAct(act)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#0037C1] hover:bg-blue-50"
                          >
                            Ver ato
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredActs.map((act) => (
              <ActCard key={act.id} act={act} onOpen={() => setSelectedAct(act)} />
            ))}
          </div>
        )}
      </section>

      <ActDetailModal
        act={selectedAct}
        editionUrl={edition.url}
        editionTitle={edition.title}
        onClose={() => setSelectedAct(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-[#0037C1] text-white shadow-2xs"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
          active ? "bg-white/20 text-white" : "bg-white text-slate-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ActCard({ act, onOpen }: { act: ActViewItem; onOpen: () => void }) {
  const categoryColors: Record<string, string> = {
    LEIS_E_ATOS_NORMATIVOS: "bg-blue-100 text-blue-800",
    ATOS_DE_PESSOAL: "bg-purple-100 text-purple-800",
    CONTRATOS_EDITAIS_AVISOS: "bg-emerald-100 text-emerald-800",
    OUTROS: "bg-slate-200 text-slate-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-blue-300 hover:shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                categoryColors[act.category] || categoryColors.OUTROS
              }`}
            >
              {act.subType}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              {act.department}
            </span>
            {act.monetaryValue && act.monetaryValue > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                <Banknote className="h-3 w-3" />
                {formatCurrencyBRL(act.monetaryValue)}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            {act.title}
          </h3>

          <p className="text-sm leading-relaxed text-slate-600">{act.summary}</p>

          {(act.metadata?.processNumber ||
            act.metadata?.contractor ||
            act.metadata?.validity) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
              {act.metadata.processNumber && (
                <span>
                  <strong>Processo:</strong> {act.metadata.processNumber}
                </span>
              )}
              {act.metadata.contractor && (
                <span>
                  <strong>Empresa/Contratada:</strong> {act.metadata.contractor}
                </span>
              )}
              {act.metadata.validity && (
                <span>
                  <strong>Vigência:</strong> {act.metadata.validity}
                </span>
              )}
            </div>
          )}

          {act.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1.5">
              {act.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/70 px-2 py-0.5 text-xs font-medium text-[#0037C1] hover:bg-blue-100"
                >
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[240px] truncate">{att.label}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#0037C1] transition hover:border-blue-300 hover:bg-blue-50"
        >
          Ver texto completo
        </button>
      </div>
    </article>
  );
}
