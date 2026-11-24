import { loadEditionDashboardData } from "@/lib/editionQueries";
import { EditionDashboard } from "@/components/EditionDashboard";
import { SyncButton } from "@/components/SyncButton";
import { Newspaper } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const params = await searchParams;
  const data = await loadEditionDashboardData(params.edition);

  if (data.empty) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0037C1]">
          <Newspaper className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          Nenhuma edição do DOM coletada ainda
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Clique no botão abaixo para acessar automaticamente{" "}
          <strong>diariooficial.jaboatao.pe.gov.br</strong>, coletar as edições mais
          recentes, verificar Edições Extras/Suplementares e gerar o resumo de cada edição.
        </p>
        <div className="mt-6 flex justify-center">
          <SyncButton pages={3} limit={24} label="Coletar Edições Agora" />
        </div>
      </div>
    );
  }

  if (data.notFound) {
    // Fallback para a edição mais recente se o query param ?edition= for inválido
    const latest = await loadEditionDashboardData();
    if (latest.empty || latest.notFound) return null;
    return (
      <EditionDashboard
        edition={latest.edition}
        allEditions={latest.allEditions}
        recentExtraEditions={latest.recentExtraEditions}
        sameDaySiblings={latest.sameDaySiblings}
        lastSyncDate={latest.lastSyncDate}
      />
    );
  }

  return (
    <EditionDashboard
      edition={data.edition}
      allEditions={data.allEditions}
      recentExtraEditions={data.recentExtraEditions}
      sameDaySiblings={data.sameDaySiblings}
      lastSyncDate={data.lastSyncDate}
    />
  );
}
