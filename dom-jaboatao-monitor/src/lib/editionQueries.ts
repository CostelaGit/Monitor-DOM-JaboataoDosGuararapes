import { prisma } from "./db";
import type { EditionDetailView } from "@/components/EditionDashboard";

function safeParseArray(str: string): string[] {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [String(val)];
  } catch {
    return str ? [str] : [];
  }
}

function safeParseMeta(str: string | null) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export async function loadEditionDashboardData(requestedId?: string) {
  const [allEditions, recentExtraEditions, lastSync] = await Promise.all([
    prisma.edition.findMany({
      orderBy: [{ publishedDateStr: "desc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true,
        publishedDateStr: true,
        editionNumber: true,
        editionType: true,
        isExtraOrSupplementary: true,
        title: true,
      },
    }),
    prisma.edition.findMany({
      where: { isExtraOrSupplementary: true },
      orderBy: [{ publishedDateStr: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        publishedDateStr: true,
        editionNumber: true,
        editionType: true,
        title: true,
      },
    }),
    prisma.syncLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  if (allEditions.length === 0) {
    return {
      empty: true as const,
      allEditions,
      recentExtraEditions,
      lastSyncDate: null,
    };
  }

  const targetId = requestedId || allEditions[0].id;

  const currentEdition = await prisma.edition.findUnique({
    where: { id: targetId },
    include: {
      acts: {
        orderBy: { orderIndex: "asc" },
        include: { attachments: true },
      },
      attachments: true,
    },
  });

  if (!currentEdition) {
    return {
      empty: false as const,
      notFound: true as const,
      allEditions,
      recentExtraEditions,
      lastSyncDate: null,
    };
  }

  // Verifica se existem outras edições (ex.: Extraordinária/Suplementar) na mesma data
  const sameDaySiblings = await prisma.edition.findMany({
    where: {
      publishedDateStr: currentEdition.publishedDateStr,
      id: { not: currentEdition.id },
    },
    select: {
      id: true,
      publishedDateStr: true,
      editionNumber: true,
      editionType: true,
      isExtraOrSupplementary: true,
      title: true,
    },
  });

  const editionView: EditionDetailView = {
    id: currentEdition.id,
    url: currentEdition.url,
    publishedDateStr: currentEdition.publishedDateStr,
    editionNumber: currentEdition.editionNumber,
    romanYear: currentEdition.romanYear,
    title: currentEdition.title,
    editionType: currentEdition.editionType,
    isExtraOrSupplementary: currentEdition.isExtraOrSupplementary,
    extraReason: currentEdition.extraReason,
    executiveSummary: safeParseArray(currentEdition.executiveSummary),
    aiSummary: currentEdition.aiSummary,
    totalActs: currentEdition.totalActs,
    totalNormative: currentEdition.totalNormative,
    totalPersonnel: currentEdition.totalPersonnel,
    totalContracts: currentEdition.totalContracts,
    totalOthers: currentEdition.totalOthers,
    totalAppointments: currentEdition.totalAppointments,
    totalDismissals: currentEdition.totalDismissals,
    totalMonetaryValue: currentEdition.totalMonetaryValue,
    attachments: currentEdition.attachments,
    acts: currentEdition.acts.map((act) => ({
      id: act.id,
      category: act.category,
      subType: act.subType,
      department: act.department,
      actNumber: act.actNumber,
      title: act.title,
      summary: act.summary,
      content: act.content,
      monetaryValue: act.monetaryValue,
      metadata: safeParseMeta(act.metadataJson),
      attachments: act.attachments,
    })),
  };

  const lastSyncDate = lastSync?.finishedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(lastSync.finishedAt)
    : null;

  return {
    empty: false as const,
    notFound: false as const,
    edition: editionView,
    allEditions,
    recentExtraEditions,
    sameDaySiblings,
    lastSyncDate,
  };
}
