"use client";

import { X, ExternalLink, FileText, Building2, Tag, Banknote } from "lucide-react";
import {
  ActCategory,
  ActMetadata,
  CATEGORY_LABELS,
  formatCurrencyBRL,
} from "@/lib/types";

export interface ActViewItem {
  id: string;
  category: string;
  subType: string;
  department: string;
  actNumber: string | null;
  title: string;
  summary: string;
  content: string;
  monetaryValue: number | null;
  metadata: ActMetadata;
  attachments: { id: string; label: string; url: string }[];
}

interface ActDetailModalProps {
  act: ActViewItem | null;
  editionUrl: string;
  editionTitle: string;
  onClose: () => void;
}

export function ActDetailModal({
  act,
  editionUrl,
  editionTitle,
  onClose,
}: ActDetailModalProps) {
  if (!act) return null;

  const categoryLabel =
    CATEGORY_LABELS[act.category as ActCategory] || act.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 font-semibold text-blue-800">
                <Tag className="h-3 w-3" />
                {categoryLabel}
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-medium text-slate-700">
                {act.subType}
              </span>
              {act.monetaryValue && act.monetaryValue > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                  <Banknote className="h-3 w-3" />
                  {formatCurrencyBRL(act.monetaryValue)}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">
              {act.title}
            </h3>
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {act.department}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Resumo do Ato
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">
              {act.summary}
            </p>
          </div>

          {act.attachments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Anexos PDF Vinculados
              </p>
              <div className="flex flex-wrap gap-2">
                {act.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0037C1] hover:bg-blue-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-xs truncate">{att.label}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Texto Integral Extraído ({editionTitle})
            </p>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-700">
              {act.content}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <a
            href={editionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0037C1] hover:underline"
          >
            <span>Abrir publicação oficial no portal da Prefeitura</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
