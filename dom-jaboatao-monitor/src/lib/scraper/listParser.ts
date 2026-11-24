import * as cheerio from "cheerio";
import { DOM_BASE_URL } from "./fetcher";
import { EditionListItem } from "../types";

export const EDITION_PATH_REGEX = /^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/?#]+)\/?$/;

export interface ParsedListPage {
  items: EditionListItem[];
  currentPage: number;
  maxPage: number;
  hasNextPage: boolean;
  nextPage: number | null;
}

export function normalizeEditionUrl(rawHref: string): {
  url: string;
  slug: string;
  publishedDateStr: string;
  publishedDate: Date;
} | null {
  const trimmed = rawHref.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (trimmed.startsWith("http")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname.includes("jaboatao.pe.gov.br")) return null;
      pathname = parsed.pathname;
    } catch {
      return null;
    }
  } else {
    // Remove querystring (?searchTerm=...) e hash (#...) de links relativos
    pathname = trimmed.split(/[?#]/)[0];
  }

  const match = EDITION_PATH_REGEX.exec(pathname);
  if (!match) return null;

  const [, year, month, day, slug] = match;
  const normalizedPath = `/${year}/${month}/${day}/${slug}`;
  const publishedDateStr = `${year}-${month}-${day}`;

  return {
    url: `${DOM_BASE_URL}${normalizedPath}`,
    slug,
    publishedDateStr,
    publishedDate: new Date(`${publishedDateStr}T12:00:00.000Z`),
  };
}

export function buildPortalListUrl(params: {
  page: number;
  year?: number;
  searchTerm?: string;
}): string {
  const page = Math.max(1, Math.floor(params.page || 1));

  if (params.searchTerm && params.searchTerm.trim()) {
    return `/?search=${encodeURIComponent(params.searchTerm.trim())}&page=${page}`;
  }

  if (params.year && Number.isInteger(params.year) && params.year >= 2015 && params.year <= 2100) {
    return `/category/diario-oficial-${params.year}?page=${page}`;
  }

  return `/?page=${page}`;
}

export function parseEditionListPage(html: string, requestedPage = 1): ParsedListPage {
  const $ = cheerio.load(html);
  const seenUrls = new Set<string>();
  const items: EditionListItem[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const normalized = normalizeEditionUrl(href);
    if (!normalized) return;

    if (seenUrls.has(normalized.url)) return;
    seenUrls.add(normalized.url);

    const cardTitle =
      $(el).find("h2, h1, h3").first().text().replace(/\s+/g, " ").trim() ||
      $(el).text().replace(/\s+/g, " ").trim() ||
      normalized.slug;

    items.push({
      url: normalized.url,
      slug: normalized.slug,
      cardTitle,
      publishedDateStr: normalized.publishedDateStr,
      publishedDate: normalized.publishedDate,
    });
  });

  const currentPage = Math.max(1, Math.floor(requestedPage));
  let maxPage = currentPage;
  let hasNextLink = false;

  $('a[href*="page="]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
    const m = /[?&]page=(\d+)/.exec(href);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) {
        if (n > maxPage) maxPage = n;
        if (n > currentPage || text === "próxima" || text === "proxima") {
          if (n > currentPage) hasNextLink = true;
        }
      }
    }
  });

  const hasNextPage = hasNextLink || currentPage < maxPage;

  return {
    items,
    currentPage,
    maxPage,
    hasNextPage,
    nextPage: hasNextPage ? currentPage + 1 : null,
  };
}
