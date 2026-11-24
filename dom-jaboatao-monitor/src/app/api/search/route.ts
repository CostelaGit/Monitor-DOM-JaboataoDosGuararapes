import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const onlyExtra = searchParams.get("onlyExtra") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20)
  );

  if (!q && !category && !onlyExtra) {
    return NextResponse.json({
      results: [],
      total: 0,
      pagination: {
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  }

  const where = {
    ...(category ? { category } : {}),
    ...(onlyExtra ? { edition: { isExtraOrSupplementary: true } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { content: { contains: q } },
            { department: { contains: q } },
            { actNumber: { contains: q } },
            { subType: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, acts] = await Promise.all([
    prisma.act.count({ where }),
    prisma.act.findMany({
      where,
      orderBy: [{ edition: { publishedDateStr: "desc" } }, { orderIndex: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        edition: {
          select: {
            id: true,
            title: true,
            url: true,
            publishedDateStr: true,
            editionNumber: true,
            editionType: true,
            isExtraOrSupplementary: true,
          },
        },
        attachments: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    total,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    results: acts.map((act) => ({
      ...act,
      metadata: act.metadataJson ? JSON.parse(act.metadataJson) : {},
    })),
  });
}
