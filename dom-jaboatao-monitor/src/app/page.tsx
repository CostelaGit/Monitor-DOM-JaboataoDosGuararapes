import { loadEditionDashboardData } from "@/lib/editionQueries";
import { DomSearchNavigator, RadarDashboardData } from "@/components/DomSearchNavigator";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    edition?: string;
    q?: string;
    category?: string;
    onlyExtra?: string;
    year?: string;
  }>;
}) {
  const params = await searchParams;
  let data = await loadEditionDashboardData(params.edition);

  if (data.notFound) {
    // Fallback para a edição mais recente se o query param ?edition= for inválido
    data = await loadEditionDashboardData();
  }

  const radarData: RadarDashboardData | null =
    !data.empty && !data.notFound
      ? {
          edition: data.edition,
          allEditions: data.allEditions,
          recentExtraEditions: data.recentExtraEditions,
          sameDaySiblings: data.sameDaySiblings,
          lastSyncDate: data.lastSyncDate,
        }
      : null;

  return (
    <DomSearchNavigator
      radarData={radarData}
      initialCriteria={{
        query: params.q || "",
        category: params.category || "",
        onlyExtra: params.onlyExtra === "true",
        year: params.year || "",
      }}
      basePath="/"
    />
  );
}
