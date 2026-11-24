import { notFound } from "next/navigation";
import { loadEditionDashboardData } from "@/lib/editionQueries";
import { EditionDashboard } from "@/components/EditionDashboard";

export const dynamic = "force-dynamic";

export default async function EditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadEditionDashboardData(id);

  if (data.empty || data.notFound) {
    notFound();
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
