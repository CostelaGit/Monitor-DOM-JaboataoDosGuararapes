import { NextRequest, NextResponse } from "next/server";
import { syncEditions, SyncOptions } from "@/lib/syncService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const totalEditions = await prisma.edition.count();
  const totalExtras = await prisma.edition.count({
    where: { isExtraOrSupplementary: true },
  });

  return NextResponse.json({
    totalEditions,
    totalExtras,
    recentLogs: logs,
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  let body: SyncOptions = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio é permitido
  }

  const result = await syncEditions({
    mode: body.mode,
    pages: body.pages,
    maxPages: body.maxPages,
    startPage: body.startPage,
    endPage: body.endPage,
    limit: body.limit ?? 30,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    year: body.year,
    searchTerm: body.searchTerm,
    stopOnExistingPage: body.stopOnExistingPage,
    forceResync: body.forceResync ?? false,
  });

  return NextResponse.json(result, {
    status: result.status === "SUCCESS" ? 200 : 500,
  });
}
