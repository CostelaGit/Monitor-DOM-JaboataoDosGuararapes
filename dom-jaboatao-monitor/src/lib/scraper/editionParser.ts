import * as cheerio from "cheerio";
import {
  ParsedAct,
  ParsedAttachment,
  ParsedEdition,
  ActMetadata,
  formatCurrencyBRL,
} from "../types";
import { detectExtraOrSupplementary } from "./extraDetector";
import {
  cleanText,
  extractActNumber,
  extractMaxMonetaryValue,
  extractMetadata,
} from "../classifier/metadataExtractor";
import { classifyAct } from "../classifier/rules";

export function parseEditionHtml(params: {
  url: string;
  slug: string;
  publishedDateStr: string;
  publishedDate: Date;
  html: string;
  isUnmarkedSameDaySecondary?: boolean;
}): ParsedEdition {
  const {
    url,
    slug,
    publishedDateStr,
    publishedDate,
    html,
    isUnmarkedSameDaySecondary,
  } = params;
  const $ = cheerio.load(html);

  // Extrai título oficial da edição (segundo h1, pois o primeiro é "DIÁRIO OFICIAL")
  let title = "";
  $("h1").each((_, el) => {
    const t = cleanText($(el).text());
    if (t && !/^DI[ÁA]RIO OFICIAL$/i.test(t) && /JABOAT[ÃA]O|N[º°o]/i.test(t) && !title) {
      title = t;
    }
  });
  if (!title) {
    title = cleanText($("h1").eq(1).text()) || slug;
  }

  // Extrai Ano Romano e Número da Edição a partir do título oficial (fallback: slug)
  const titleNumMatch = /N[º°o.]*\s*(\d+(?:\s*-\s*[A-Za-z])?)/i.exec(title);
  const slugNumMatch = /-no-(\d+(?:-[a-z])?)-/i.exec(slug);
  const editionNumber = (titleNumMatch?.[1] || slugNumMatch?.[1] || "S/N")
    .replace(/\s+/g, "")
    .toUpperCase();

  const romanMatch = /[–-]\s*([IVXLCDM]{2,8})\s*[–-]/i.exec(title);
  const romanYear = romanMatch ? romanMatch[1].toUpperCase() : "";

  const extraInfo = detectExtraOrSupplementary({
    slug,
    title,
    editionNumber,
    isUnmarkedSameDaySecondary,
  });

  const articleRoot = $(".article").first();
  const root = articleRoot.length > 0 ? articleRoot : $("main").first();

  const allAttachments: ParsedAttachment[] = [];
  const seenAttachmentUrls = new Set<string>();
  const acts: ParsedAct[] = [];
  let orderIndex = 0;

  const secretarias = root.find(".secretaria");

  if (secretarias.length > 0) {
    secretarias.each((_, secEl) => {
      const $sec = $(secEl);
      const department =
        cleanText($sec.attr("data-name") || $sec.find("> h3").first().text()) ||
        "ÓRGÃO NÃO IDENTIFICADO";

      const tipos = $sec.find(".tipoPublicacao");
      if (tipos.length > 0) {
        tipos.each((_, tipoEl) => {
          const $tipo = $(tipoEl);
          const sourceType = cleanText($tipo.attr("data-name") || "");
          const publicacoes = $tipo.find(".publicacao");

          if (publicacoes.length > 0) {
            publicacoes.each((_, pubEl) => {
              const $pub = $(pubEl);
              const externalId = cleanText($pub.attr("data-name") || "") || undefined;
              const extracted = processPublicationBlock($, $pub, {
                department,
                sourceType,
                externalId,
                startIndex: orderIndex,
              });
              for (const act of extracted) {
                acts.push(act);
                orderIndex++;
                for (const att of act.attachments) {
                  if (!seenAttachmentUrls.has(att.url)) {
                    seenAttachmentUrls.add(att.url);
                    allAttachments.push(att);
                  }
                }
              }
            });
          } else {
            const extracted = processPublicationBlock($, $tipo, {
              department,
              sourceType,
              startIndex: orderIndex,
            });
            for (const act of extracted) {
              acts.push(act);
              orderIndex++;
            }
          }
        });
      } else {
        const extracted = processPublicationBlock($, $sec, {
          department,
          sourceType: "",
          startIndex: orderIndex,
        });
        for (const act of extracted) {
          acts.push(act);
          orderIndex++;
        }
      }
    });
  } else {
    // Fallback caso alguma edição antiga não tenha as classes .secretaria/.publicacao
    const fallbackText = extractReadableText($, root);
    if (fallbackText.length > 20) {
      const metadata = extractMetadata(fallbackText, "PODER EXECUTIVO");
      const classification = classifyAct({
        department: "PODER EXECUTIVO",
        text: fallbackText,
        metadata,
      });
      const attachments = extractLinks($, root);
      acts.push({
        category: classification.category,
        subType: classification.subType,
        department: "PODER EXECUTIVO",
        actNumber: extractActNumber(fallbackText),
        title: buildActTitle(fallbackText, classification.subType, metadata),
        summary: buildActSummary(fallbackText, classification.subType, metadata),
        content: fallbackText,
        monetaryValue: extractMaxMonetaryValue(fallbackText),
        metadata,
        attachments,
        orderIndex: 0,
      });
      allAttachments.push(...attachments);
    }
  }

  const rawText = acts
    .map((a) => `[${a.department}] ${a.title}\n${a.content}`)
    .join("\n\n---\n\n");

  return {
    url,
    slug,
    publishedDate,
    publishedDateStr,
    editionNumber,
    romanYear,
    title,
    editionType: extraInfo.editionType,
    isExtraOrSupplementary: extraInfo.isExtraOrSupplementary,
    extraReason: extraInfo.extraReason,
    rawText,
    acts,
    attachments: allAttachments,
  };
}

function processPublicationBlock(
  $: cheerio.CheerioAPI,
  $block: cheerio.Cheerio<any>,
  ctx: {
    department: string;
    sourceType: string;
    externalId?: string;
    startIndex: number;
  }
): ParsedAct[] {
  const fullText = extractReadableText($, $block);
  // Ignora blocos vazios ou que contenham apenas o título repetido do órgão/seção
  if (fullText.length < 30) return [];
  const normalizedBlock = fullText.replace(/\s+/g, " ").trim().toUpperCase();
  const normalizedDept = ctx.department.replace(/\s+/g, " ").trim().toUpperCase();
  if (
    normalizedBlock === normalizedDept ||
    normalizedBlock === "LICITAÇÕES E CONTRATOS" ||
    normalizedBlock === "PODER EXECUTIVO"
  ) {
    return [];
  }

  const blockAttachments = extractLinks($, $block);

  // Divide blocos "ATOS DO DIA" que agrupam vários "Ato nº XXX/YYYY – Nomear/Exonerar..."
  const splitIndividualActs = trySplitAtosDoDia(fullText);
  if (splitIndividualActs.length > 1) {
    return splitIndividualActs.map((chunk, idx) =>
      buildParsedAct({
        text: chunk,
        department: ctx.department,
        sourceType: ctx.sourceType || "Ato",
        externalId: ctx.externalId ? `${ctx.externalId}-${idx + 1}` : undefined,
        attachments: idx === 0 ? blockAttachments : [],
        orderIndex: ctx.startIndex + idx,
      })
    );
  }

  return [
    buildParsedAct({
      text: fullText,
      department: ctx.department,
      sourceType: ctx.sourceType,
      externalId: ctx.externalId,
      attachments: blockAttachments,
      orderIndex: ctx.startIndex,
    }),
  ];
}

function trySplitAtosDoDia(text: string): string[] {
  // Procura múltiplas ocorrências de "Ato nº 1128/2026 – ..." (com espaços ocasionais nos números)
  const regex = /(?=\bAto\s+n[º°o.]*\s*\d[\d\s]*\/\s*\d{4}\s*[–—-])/gi;
  const matches = [...text.matchAll(regex)];
  if (matches.length < 2) return [];

  const chunks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const slice = cleanText(text.slice(start, end));
    if (slice.length > 20) {
      chunks.push(slice);
    }
  }

  return chunks;
}

function buildParsedAct(params: {
  text: string;
  department: string;
  sourceType: string;
  externalId?: string;
  attachments: ParsedAttachment[];
  orderIndex: number;
}): ParsedAct {
  const { text, department, sourceType, externalId, attachments, orderIndex } = params;
  const metadata = extractMetadata(text, department);
  const monetaryValue = extractMaxMonetaryValue(text);
  const classification = classifyAct({
    sourceType,
    department,
    text,
    metadata,
  });
  const actNumber = extractActNumber(text);
  const title = buildActTitle(text, classification.subType, metadata, actNumber);
  const summary = buildActSummary(text, classification.subType, metadata, monetaryValue);

  return {
    externalId,
    sourceType: sourceType || undefined,
    category: classification.category,
    subType: classification.subType,
    department,
    actNumber,
    title,
    summary,
    content: text,
    monetaryValue,
    metadata,
    attachments,
    orderIndex,
  };
}

function buildActTitle(
  text: string,
  subType: string,
  metadata: ActMetadata,
  actNumber?: string
): string {
  if (metadata.action && metadata.personName) {
    const prefix = actNumber ? `${actNumber} — ` : "";
    return `${prefix}${metadata.action}: ${metadata.personName}`;
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const firstLine = lines[0] || subType;
  if (firstLine.length <= 140) {
    return firstLine;
  }
  return `${firstLine.slice(0, 137).trim()}...`;
}

function buildActSummary(
  text: string,
  subType: string,
  metadata: ActMetadata,
  monetaryValue?: number
): string {
  const valueTag = monetaryValue ? ` (${formatCurrencyBRL(monetaryValue)})` : "";

  if (metadata.ementa) {
    return `${metadata.ementa}${valueTag}`;
  }

  if (metadata.action && metadata.personName) {
    const parts = [`${metadata.action} de ${metadata.personName}`];
    if (metadata.role) {
      parts.push(`para/do cargo de ${metadata.role}${metadata.symbol ? ` (${metadata.symbol})` : ""}`);
    }
    if (metadata.targetDepartment) {
      parts.push(`— ${metadata.targetDepartment}`);
    }
    if (metadata.effectDate) {
      parts.push(`(efeito: ${metadata.effectDate})`);
    }
    return parts.join(" ");
  }

  if (metadata.object) {
    const parts = [metadata.object];
    if (metadata.contractor) parts.push(`Contratada/Empresa: ${metadata.contractor}`);
    if (monetaryValue) parts.push(`Valor: ${formatCurrencyBRL(monetaryValue)}`);
    return parts.join(" • ");
  }

  // Fallback limpo: primeiras 2 linhas significativas
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10);

  const body = lines.slice(0, 3).join(" ");
  const truncated = body.length > 260 ? `${body.slice(0, 257).trim()}...` : body;
  return `${truncated || subType}${valueTag}`;
}

function extractReadableText($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
  const clone = $el.clone();
  clone.find("script, style, noscript").remove();
  clone.find("br").replaceWith("\n");
  clone.find("p, div, tr, li, h1, h2, h3, h4").each((_, node) => {
    $(node).append("\n");
  });
  clone.find("td, th").each((_, node) => {
    $(node).append(" ");
  });
  return cleanText(clone.text());
}

function extractLinks($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): ParsedAttachment[] {
  const result: ParsedAttachment[] = [];
  const seen = new Set<string>();

  $el.find("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href) return;
    if (
      /\.pdf(\?|$)/i.test(href) ||
      href.includes("septemcompliance.com/attachments")
    ) {
      if (seen.has(href)) return;
      seen.add(href);
      const label =
        cleanText($(a).text()) ||
        decodeURIComponent(href.split("/").pop() || "Anexo PDF").replace(/_/g, " ");
      result.push({ label, url: href });
    }
  });

  return result;
}
