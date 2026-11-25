import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Newspaper, History, Search, ExternalLink } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitor DOM — Navegador do Diário Oficial de Jaboatão dos Guararapes",
  description:
    "Navegador inteligente e resumo automatizado do Diário Oficial do Município de Jaboatão dos Guararapes: pesquise atos, leis, nomeações, contratos, editais e edições extras (2015–2026).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-blue-900/20 bg-[#0037C1] text-white shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDC300] text-[#002355] shadow-sm transition-transform group-hover:scale-105">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight sm:text-lg">
                    Monitor DOM Jaboatão
                  </span>
                  <span className="hidden rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-yellow-200 sm:inline">
                    Navegador &amp; Radar
                  </span>
                </div>
                <p className="text-xs text-blue-100">
                  Diário Oficial do Município de Jaboatão dos Guararapes
                </p>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/15 hover:text-white"
              >
                <Compass className="h-4 w-4" />
                <span>Pesquisa &amp; Radar</span>
              </Link>
              <Link
                href="/historico"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/15 hover:text-white"
              >
                <History className="h-4 w-4" />
                <span>Histórico &amp; Extras</span>
              </Link>
              <Link
                href="/busca"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/15 hover:text-white"
              >
                <Search className="h-4 w-4" />
                <span>Buscar</span>
              </Link>
              <a
                href="https://diariooficial.jaboatao.pe.gov.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 md:flex"
              >
                <span>Portal Oficial</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </nav>
          </div>
          <div className="h-1 w-full bg-gradient-to-r from-[#FDC300] via-[#00853E] to-[#FDC300]" />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-12 border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <p>
              <strong>Aviso:</strong> Este painel apresenta resumos automatizados para consulta
              rápida. Para fins legais, consulte sempre a publicação oficial integral.
            </p>
            <a
              href="https://diariooficial.jaboatao.pe.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#0037C1] hover:underline"
            >
              diariooficial.jaboatao.pe.gov.br
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
