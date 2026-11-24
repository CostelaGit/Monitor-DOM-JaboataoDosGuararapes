import { NextRequest, NextResponse } from "next/server";
import { SingleImportResult, syncSingleEditionByUrl } from "@/lib/syncService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { url?: string; urls?: string[]; forceResync?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  const targetUrls = Array.from(
    new Set(
      [
        ...(body.url ? [body.url] : []),
        ...(Array.isArray(body.urls) ? body.urls : []),
      ]
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
    )
  ).slice(0, 12);

  if (targetUrls.length === 0) {
    return NextResponse.json(
      { error: "Informe ao menos uma URL de edição do DOM para importar." },
      { status: 400 }
    );
  }

  const imported: SingleImportResult[] = [];
  const errors: string[] = [];

  for (const url of targetUrls) {
    try {
      const res = await syncSingleEditionByUrl(url, {
        forceResync: body.forceResync ?? false,
      });
      imported.push(res);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json(
    {
      imported,
      errors,
    },
    { status: imported.length > 0 || errors.length === 0 ? 200 : 400 }
  );
}
