import { NextRequest, NextResponse } from "next/server";
import { fetchHtml } from "@/lib/scraper/fetcher";
import { buildPortalListUrl, parseEditionListPage } from "@/lib/scraper/listParser";
import { detectExtraOrSupplementary } from "@/lib/scraper/extraDetector";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  try {
    const portalPath = buildPortalListUrl({
      page,
      searchTerm: q || undefined,
      year: !q && year && !Number.isNaN(year) ? year : undefined,
    });

    const html = await fetchHtml(portalPath);
    const parsed = parseEditionListPage(html, page);

    // Cruza com o banco local para informar quais edições já foram importadas e resumidas
    const urls = parsed.items.map((i) => i.url);
    const localMatches =
      urls.length > 0
        ? await prisma.edition.findMany({
            where: { url: { in: urls } },
            select: {
              id: true,
              url: true,
              totalActs: true,
              editionNumber: true,
              editionType: true,
              isExtraOrSupplementary: true,
            },
          })
        : [];
    const localByUrl = new Map(localMatches.map((m) => [m.url, m]));

    const items = parsed.items.map((item) => {
      const local = localByUrl.get(item.url);
      const numMatch = /N[º°o.]*\s*(\d+(?:\s*-\s*[A-Za-z])?)/i.exec(item.cardTitle);
      const editionNumber =
        local?.editionNumber ||
        (numMatch?.[1] || "").replace(/\s+/g, "").toUpperCase();

      const extraInfo = local
        ? {
            editionType: local.editionType,
            isExtraOrSupplementary: local.isExtraOrSupplementary,
          }
        : detectExtraOrSupplementary({
            slug: item.slug,
            title: item.cardTitle,
            editionNumber,
          });

      return {
        url: item.url,
        slug: item.slug,
        cardTitle: item.cardTitle,
        publishedDateStr: item.publishedDateStr,
        editionNumber: editionNumber || "S/N",
        editionType: extraInfo.editionType,
        isExtraOrSupplementary: extraInfo.isExtraOrSupplementary,
        localEditionId: local?.id ?? null,
        localTotalActs: local?.totalActs ?? null,
      };
    });

    return NextResponse.json({
      query: q,
      year: !q && year && !Number.isNaN(year) ? year : null,
      portalPath,
      items,
      pagination: {
        currentPage: parsed.currentPage,
        maxPage: parsed.maxPage,
        hasNextPage: parsed.hasNextPage,
        hasPrevPage: parsed.currentPage > 1,
        nextPage: parsed.nextPage,
        prevPage: parsed.currentPage > 1 ? parsed.currentPage - 1 : null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro ao consultar paginação no portal oficial do DOM.",
      },
      { status: 502 }
    );
  }
}
