import { prisma } from "./db";
import { fetchHtml } from "./scraper/fetcher";
import {
  buildPortalListUrl,
  normalizeEditionUrl,
  parseEditionListPage,
} from "./scraper/listParser";
import { parseEditionHtml } from "./scraper/editionParser";
import { hasExplicitExtraMarker } from "./scraper/extraDetector";
import { buildDeterministicSummary } from "./summarizer/deterministic";
import { generateOptionalAiSummary } from "./summarizer/llm";
import { EditionListItem } from "./types";

export type SyncMode = "incremental" | "pageRange" | "dateRange" | "year" | "search";

export interface SyncOptions {
  mode?: SyncMode;
  pages?: number; // alias legado para maxPages
  maxPages?: number;
  startPage?: number;
  endPage?: number;
  limit?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  year?: number;
  searchTerm?: string;
  stopOnExistingPage?: boolean;
  forceResync?: boolean;
}

export interface SyncResult {
  syncLogId: string;
  status: "SUCCESS" | "ERROR";
  mode: SyncMode;
  startPage: number;
  lastPageScanned: number;
  totalPortalPages: number;
  pagesScanned: number;
  discoveredCount: number;
  newEditionsCount: number;
  extraEditionsDetected: number;
  stoppedEarlyReason?: string;
  errors: string[];
}

export interface SingleImportResult {
  editionId: string;
  alreadyExisted: boolean;
  title: string;
  editionNumber: string;
  publishedDateStr: string;
  isExtraOrSupplementary: boolean;
  totalActs: number;
}

export async function syncEditions(options?: SyncOptions): Promise<SyncResult> {
  const mode: SyncMode = options?.mode
    ? options.mode
    : options?.searchTerm
      ? "search"
      : options?.year
        ? "year"
        : options?.dateFrom || options?.dateTo
          ? "dateRange"
          : options?.startPage || options?.endPage
            ? "pageRange"
            : "incremental";

  const startPage = Math.max(1, Math.floor(options?.startPage ?? 1));
  const rawMaxPages = options?.maxPages ?? options?.pages ?? (mode === "incremental" ? 5 : 15);
  const maxPages = Math.max(1, Math.min(rawMaxPages, 250));
  const endPage = options?.endPage
    ? Math.max(startPage, Math.min(options.endPage, 250))
    : startPage + maxPages - 1;

  const limit = Math.max(1, Math.min(options?.limit ?? 40, 300));
  const forceResync = options?.forceResync ?? false;
  const stopOnExistingPage =
    options?.stopOnExistingPage ?? (mode === "incremental" && !forceResync);
  const dateFrom = options?.dateFrom?.trim() || undefined;
  const dateTo = options?.dateTo?.trim() || undefined;
  const year = options?.year;
  const searchTerm = options?.searchTerm?.trim() || undefined;

  const log = await prisma.syncLog.create({
    data: {
      status: "RUNNING",
      pagesScanned: 0,
      newEditionsCount: 0,
      extraEditionsDetected: 0,
    },
  });

  const errors: string[] = [];
  let pagesScanned = 0;
  let lastPageScanned = startPage - 1;
  let totalPortalPages = startPage;
  let newEditionsCount = 0;
  let extraEditionsDetected = 0;
  let stoppedEarlyReason: string | undefined;

  try {
    const existingEditions = await prisma.edition.findMany({
      select: {
        id: true,
        url: true,
        slug: true,
        title: true,
        editionNumber: true,
        publishedDateStr: true,
      },
    });
    const existingUrlMap = new Map(existingEditions.map((e) => [e.url, e.id]));

    const discovered: EditionListItem[] = [];
    const seenUrls = new Set<string>();

    for (let page = startPage; page <= endPage; page++) {
      const listPath = buildPortalListUrl({
        page,
        year: mode === "year" ? year : undefined,
        searchTerm: mode === "search" ? searchTerm : undefined,
      });

      const listHtml = await fetchHtml(listPath);
      const parsed = parseEditionListPage(listHtml, page);
      pagesScanned++;
      lastPageScanned = page;
      if (parsed.maxPage > totalPortalPages) {
        totalPortalPages = parsed.maxPage;
      }

      if (parsed.items.length === 0) {
        stoppedEarlyReason = `Página ${page} sem edições listadas`;
        break;
      }

      let allExistingOnPage = true;
      let allOlderThanDateFrom = Boolean(dateFrom);

      for (const item of parsed.items) {
        if (!existingUrlMap.has(item.url)) {
          allExistingOnPage = false;
        }
        if (dateFrom && item.publishedDateStr >= dateFrom) {
          allOlderThanDateFrom = false;
        }

        // Aplica filtro de data quando mode === "dateRange" (ou quando dateFrom/dateTo foi passado)
        if (dateTo && item.publishedDateStr > dateTo) continue;
        if (dateFrom && item.publishedDateStr < dateFrom) continue;

        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          discovered.push(item);
        }
      }

      if (dateFrom && allOlderThanDateFrom) {
        stoppedEarlyReason = `Alcançado limite inferior de data (${dateFrom}) na página ${page}`;
        break;
      }

      if (stopOnExistingPage && allExistingOnPage) {
        stoppedEarlyReason = `Parada antecipada: todas as edições da página ${page} já estão sincronizadas`;
        break;
      }

      if (!parsed.hasNextPage || page >= parsed.maxPage) {
        break;
      }

      const pendingCount = discovered.filter(
        (item) => forceResync || !existingUrlMap.has(item.url)
      ).length;
      if (pendingCount >= limit) {
        stoppedEarlyReason = `Limite de ${limit} edição(ões) pendentes atingido na página ${page}`;
        break;
      }
    }

    // Agrupa candidatos por data (banco + recém-descobertos) para detecção de colisão sem falso positivo
    type DayCandidate = {
      url: string;
      slug: string;
      title: string;
      hasExplicit: boolean;
    };
    const byDate = new Map<string, Map<string, DayCandidate>>();
    const registerCandidate = (dateStr: string, cand: DayCandidate) => {
      if (!byDate.has(dateStr)) byDate.set(dateStr, new Map());
      byDate.get(dateStr)!.set(cand.url, cand);
    };

    for (const ex of existingEditions) {
      registerCandidate(ex.publishedDateStr, {
        url: ex.url,
        slug: ex.slug,
        title: ex.title,
        hasExplicit: hasExplicitExtraMarker({
          slug: ex.slug,
          title: ex.title,
          editionNumber: ex.editionNumber,
        }),
      });
    }
    for (const item of discovered) {
      registerCandidate(item.publishedDateStr, {
        url: item.url,
        slug: item.slug,
        title: item.cardTitle,
        hasExplicit: hasExplicitExtraMarker({
          slug: item.slug,
          title: item.cardTitle,
        }),
      });
    }

    const targets = discovered
      .filter((item) => forceResync || !existingUrlMap.has(item.url))
      .slice(0, limit);

    for (const item of targets) {
      try {
        const dayCandidates = Array.from(byDate.get(item.publishedDateStr)?.values() || []);
        const anyExplicitInDay = dayCandidates.some((c) => c.hasExplicit);
        let isUnmarkedSameDaySecondary = false;

        if (dayCandidates.length > 1 && !anyExplicitInDay) {
          const sorted = [...dayCandidates].sort((a, b) => a.slug.localeCompare(b.slug));
          isUnmarkedSameDaySecondary = sorted[0]?.url !== item.url;
        }

        const saved = await fetchAndPersistEdition({
          item,
          existingId: existingUrlMap.get(item.url),
          isUnmarkedSameDaySecondary,
        });

        newEditionsCount++;
        if (saved.isExtraOrSupplementary) {
          extraEditionsDetected++;
        }
      } catch (err) {
        errors.push(
          `Erro na edição ${item.slug}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: errors.length > 0 && newEditionsCount === 0 ? "ERROR" : "SUCCESS",
        pagesScanned,
        newEditionsCount,
        extraEditionsDetected,
        errorMessage: errors.length > 0 ? errors.join(" | ") : stoppedEarlyReason ?? null,
      },
    });

    return {
      syncLogId: log.id,
      status: "SUCCESS",
      mode,
      startPage,
      lastPageScanned,
      totalPortalPages,
      pagesScanned,
      discoveredCount: discovered.length,
      newEditionsCount,
      extraEditionsDetected,
      stoppedEarlyReason,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: "ERROR",
        pagesScanned,
        newEditionsCount,
        extraEditionsDetected,
        errorMessage: msg,
      },
    });

    return {
      syncLogId: log.id,
      status: "ERROR",
      mode,
      startPage,
      lastPageScanned,
      totalPortalPages,
      pagesScanned,
      discoveredCount: 0,
      newEditionsCount,
      extraEditionsDetected,
      errors: [msg],
    };
  }
}

/**
 * Importa e resume sob demanda uma única edição a partir de sua URL oficial
 * (usado no botão "Importar e Resumir" dos resultados paginados do Portal Oficial).
 */
export async function syncSingleEditionByUrl(
  rawUrl: string,
  options?: { forceResync?: boolean }
): Promise<SingleImportResult> {
  const normalized = normalizeEditionUrl(rawUrl);
  if (!normalized) {
    throw new Error("URL de edição inválida para o Diário Oficial de Jaboatão dos Guararapes.");
  }

  const existing = await prisma.edition.findUnique({
    where: { url: normalized.url },
    select: {
      id: true,
      title: true,
      editionNumber: true,
      publishedDateStr: true,
      isExtraOrSupplementary: true,
      totalActs: true,
    },
  });

  if (existing && !options?.forceResync) {
    return {
      editionId: existing.id,
      alreadyExisted: true,
      title: existing.title,
      editionNumber: existing.editionNumber,
      publishedDateStr: existing.publishedDateStr,
      isExtraOrSupplementary: existing.isExtraOrSupplementary,
      totalActs: existing.totalActs,
    };
  }

  const sameDayExisting = await prisma.edition.findMany({
    where: {
      publishedDateStr: normalized.publishedDateStr,
      url: { not: normalized.url },
    },
    select: { slug: true, title: true, editionNumber: true },
  });

  const anyExplicit =
    hasExplicitExtraMarker({ slug: normalized.slug }) ||
    sameDayExisting.some((s) =>
      hasExplicitExtraMarker({
        slug: s.slug,
        title: s.title,
        editionNumber: s.editionNumber,
      })
    );

  const isUnmarkedSameDaySecondary =
    sameDayExisting.length > 0 &&
    !anyExplicit &&
    sameDayExisting.some((s) => s.slug.localeCompare(normalized.slug) < 0);

  const saved = await fetchAndPersistEdition({
    item: {
      url: normalized.url,
      slug: normalized.slug,
      cardTitle: normalized.slug,
      publishedDateStr: normalized.publishedDateStr,
      publishedDate: normalized.publishedDate,
    },
    existingId: existing?.id,
    isUnmarkedSameDaySecondary,
  });

  return {
    editionId: saved.id,
    alreadyExisted: false,
    title: saved.title,
    editionNumber: saved.editionNumber,
    publishedDateStr: saved.publishedDateStr,
    isExtraOrSupplementary: saved.isExtraOrSupplementary,
    totalActs: saved.totalActs,
  };
}

async function fetchAndPersistEdition(params: {
  item: EditionListItem;
  existingId?: string;
  isUnmarkedSameDaySecondary: boolean;
}) {
  const { item, existingId, isUnmarkedSameDaySecondary } = params;
  const html = await fetchHtml(item.url);

  const parsedEdition = parseEditionHtml({
    url: item.url,
    slug: item.slug,
    publishedDateStr: item.publishedDateStr,
    publishedDate: item.publishedDate,
    html,
    isUnmarkedSameDaySecondary,
  });

  const metrics = buildDeterministicSummary(parsedEdition);
  const aiSummary = await generateOptionalAiSummary(parsedEdition);

  return prisma.$transaction(async (tx) => {
    if (existingId) {
      await tx.edition.delete({ where: { id: existingId } });
    }

    const createdEdition = await tx.edition.create({
      data: {
        url: parsedEdition.url,
        slug: parsedEdition.slug,
        publishedDate: parsedEdition.publishedDate,
        publishedDateStr: parsedEdition.publishedDateStr,
        editionNumber: parsedEdition.editionNumber,
        romanYear: parsedEdition.romanYear,
        title: parsedEdition.title,
        editionType: parsedEdition.editionType,
        isExtraOrSupplementary: parsedEdition.isExtraOrSupplementary,
        extraReason: parsedEdition.extraReason ?? null,
        executiveSummary: JSON.stringify(metrics.executiveSummary),
        aiSummary,
        rawText: parsedEdition.rawText,
        totalActs: metrics.totalActs,
        totalNormative: metrics.totalNormative,
        totalPersonnel: metrics.totalPersonnel,
        totalContracts: metrics.totalContracts,
        totalOthers: metrics.totalOthers,
        totalAppointments: metrics.totalAppointments,
        totalDismissals: metrics.totalDismissals,
        totalMonetaryValue: metrics.totalMonetaryValue,
      },
    });

    for (const act of parsedEdition.acts) {
      const createdAct = await tx.act.create({
        data: {
          editionId: createdEdition.id,
          externalId: act.externalId ?? null,
          sourceType: act.sourceType ?? null,
          category: act.category,
          subType: act.subType,
          department: act.department,
          actNumber: act.actNumber ?? null,
          title: act.title,
          summary: act.summary,
          content: act.content,
          monetaryValue: act.monetaryValue ?? null,
          metadataJson: JSON.stringify(act.metadata),
          orderIndex: act.orderIndex,
        },
      });

      if (act.attachments.length > 0) {
        await tx.attachment.createMany({
          data: act.attachments.map((att) => ({
            editionId: createdEdition.id,
            actId: createdAct.id,
            label: att.label,
            url: att.url,
          })),
        });
      }
    }

    return createdEdition;
  });
}
