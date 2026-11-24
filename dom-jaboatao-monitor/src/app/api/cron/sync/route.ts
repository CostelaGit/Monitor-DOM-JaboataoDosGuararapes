import { NextRequest, NextResponse } from "next/server";
import { syncEditions } from "@/lib/syncService";

export const dynamic = "force-dynamic";

/**
 * Endpoint compatível com Vercel Cron (executa via GET).
 * Protegido por CRON_SECRET ou SYNC_SECRET quando definidos em produção.
 */
export async function GET(request: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET?.trim() || process.env.SYNC_SECRET?.trim();

  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const result = await syncEditions({
    pages: 1,
    limit: 12,
    forceResync: false,
  });

  return NextResponse.json(result, {
    status: result.status === "SUCCESS" ? 200 : 500,
  });
}
