import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const department = searchParams.get("department") || undefined;

  const edition = await prisma.edition.findUnique({
    where: { id },
    include: {
      acts: {
        where: {
          ...(category ? { category } : {}),
          ...(department ? { department } : {}),
        },
        orderBy: { orderIndex: "asc" },
        include: { attachments: true },
      },
      attachments: true,
    },
  });

  if (!edition) {
    return NextResponse.json({ error: "Edição não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    ...edition,
    executiveSummary: safeParseArray(edition.executiveSummary),
    acts: edition.acts.map((act) => ({
      ...act,
      metadata: safeParseObject(act.metadataJson),
    })),
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

function safeParseObject(jsonStr: string | null): Record<string, unknown> {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}
