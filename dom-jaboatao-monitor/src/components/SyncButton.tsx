"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  pages?: number;
  limit?: number;
  label?: string;
  variant?: "primary" | "subtle";
}

export function SyncButton({
  pages = 2,
  limit = 20,
  label = "Sincronizar DOM",
  variant = "primary",
}: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, limit }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.errors?.[0] || data.error || "Erro ao sincronizar");
      }

      const extraMsg =
        data.extraEditionsDetected > 0
          ? ` (${data.extraEditionsDetected} extra/suplementar)`
          : "";
      setMessage({
        type: "ok",
        text:
          data.newEditionsCount > 0
            ? `${data.newEditionsCount} nova(s) edição(ões) coletada(s)${extraMsg}.`
            : "Portal verificado: nenhuma edição nova desde a última coleta.",
      });
      router.refresh();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Falha ao sincronizar",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-2 rounded-lg bg-[#0037C1] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#002355] disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Coletando edições..." : label}</span>
      </button>

      {message && (
        <div
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.type === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
