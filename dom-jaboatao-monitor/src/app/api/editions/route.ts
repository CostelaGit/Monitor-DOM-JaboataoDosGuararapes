import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const onlyExtra = searchParams.get("onlyExtra") === "true";
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "20", 10) || 20)
  );

  const where: Record<string, unknown> = {};
  if (onlyExtra) {
    where.isExtraOrSupplementary = true;
  }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { editionNumber: { contains: q } },
      { publishedDateStr: { contains: q } },
      { rawText: { contains: q } },
    ];
  }

  const [editions, filteredTotal, totalEditions, totalExtras, lastSync] = await Promise.all([
    prisma.edition.findMany({
      where,
      orderBy: [{ publishedDateStr: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        url: true,
        slug: true,
        publishedDateStr: true,
        editionNumber: true,
        romanYear: true,
        title: true,
        editionType: true,
        isExtraOrSupplementary: true,
        extraReason: true,
        executiveSummary: true,
        totalActs: true,
        totalNormative: true,
        totalPersonnel: true,
        totalContracts: true,
        totalOthers: true,
        totalAppointments: true,
        totalDismissals: true,
        totalMonetaryValue: true,
      },
    }),
    prisma.edition.count({ where }),
    prisma.edition.count(),
    prisma.edition.count({ where: { isExtraOrSupplementary: true } }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  return NextResponse.json({
    editions: editions.map((ed) => ({
      ...ed,
      executiveSummary: safeParseArray(ed.executiveSummary),
    })),
    pagination: {
      page,
      pageSize,
      total: filteredTotal,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    stats: {
      totalEditions,
      totalExtras,
      lastSync,
    },
  });
}

function safeParseArray(jsonStr: string): string[] {
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return jsonStr ? [jsonStr] : [];
  }
}
