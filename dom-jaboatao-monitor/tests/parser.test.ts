import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPortalListUrl,
  normalizeEditionUrl,
  parseEditionListPage,
} from "../src/lib/scraper/listParser";
import {
  detectExtraOrSupplementary,
  hasExplicitExtraMarker,
} from "../src/lib/scraper/extraDetector";
import { parseEditionHtml } from "../src/lib/scraper/editionParser";
import { classifyAct } from "../src/lib/classifier/rules";
import { buildDeterministicSummary } from "../src/lib/summarizer/deterministic";

const fixturesDir = path.join(process.cwd(), "tests", "fixtures");

describe("listParser — listagem oficial, busca e paginação por ano do DOM", () => {
  it("extrai edições e metadados de paginação da home real do portal", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "home-page-1.html"), "utf8");
    const parsed = parseEditionListPage(html, 1);

    assert.ok(parsed.items.length >= 10, `Esperado >= 10 edições, obtido ${parsed.items.length}`);
    assert.equal(parsed.currentPage, 1);
    assert.ok(parsed.maxPage >= 100, `Esperado maxPage >= 100, obtido ${parsed.maxPage}`);
    assert.equal(parsed.hasNextPage, true);
    assert.equal(parsed.nextPage, 2);
    assert.match(parsed.items[0].publishedDateStr, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(parsed.items[0].url.startsWith("https://diariooficial.jaboatao.pe.gov.br/"));
  });

  it("normaliza links com ?searchTerm=... e pagina resultados da busca oficial do portal", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "search-pregao-page-1.html"), "utf8");
    const parsed = parseEditionListPage(html, 1);

    assert.ok(parsed.items.length >= 10, `Esperado >= 10 resultados, obtido ${parsed.items.length}`);
    assert.equal(parsed.hasNextPage, true);
    assert.equal(parsed.nextPage, 2);
    // Garante que ?searchTerm= foi removido da URL canônica
    assert.equal(parsed.items[0].url.includes("?"), false);
    assert.equal(parsed.items[0].slug.includes("?"), false);
  });

  it("extrai listagem paginada por categoria anual (2026)", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "category-2026-page-1.html"), "utf8");
    const parsed = parseEditionListPage(html, 1);

    assert.ok(parsed.items.length >= 10);
    assert.ok(parsed.maxPage >= 10, `Esperado maxPage >= 10 para 2026, obtido ${parsed.maxPage}`);
    assert.equal(parsed.hasNextPage, true);
    assert.equal(parsed.items[0].publishedDateStr.startsWith("2026-"), true);
  });

  it("constrói URLs paginadas corretas e normaliza URLs de edição", () => {
    assert.equal(buildPortalListUrl({ page: 3 }), "/?page=3");
    assert.equal(buildPortalListUrl({ page: 2, year: 2026 }), "/category/diario-oficial-2026?page=2");
    assert.equal(
      buildPortalListUrl({ page: 2, searchTerm: "pregão eletrônico" }),
      "/?search=preg%C3%A3o%20eletr%C3%B4nico&page=2"
    );

    const norm = normalizeEditionUrl(
      "/2026/11/18/18-de-novembro-de-2026-xxxiv-no-217-jaboatao-dos-guararapes?searchTerm=pregao"
    );
    assert.ok(norm);
    assert.equal(
      norm.url,
      "https://diariooficial.jaboatao.pe.gov.br/2026/11/18/18-de-novembro-de-2026-xxxiv-no-217-jaboatao-dos-guararapes"
    );
  });
});

describe("extraDetector — detecção precisa de Edições Extras e Suplementares", () => {
  it("mantém a edição ordinária 196 como ORDINARIA mesmo havendo 196-A no mesmo dia", () => {
    const hasExplicit196 = hasExplicitExtraMarker({
      slug: "17-de-outubro-de-2026-xxxiv-no-196-jaboatao-dos-guararapes",
      title: "17 DE OUTUBRO DE 2026 – XXXV – Nº 196 – JABOATÃO DOS GUARARAPES",
      editionNumber: "196",
    });
    assert.equal(hasExplicit196, false);

    const res196 = detectExtraOrSupplementary({
      slug: "17-de-outubro-de-2026-xxxiv-no-196-jaboatao-dos-guararapes",
      title: "17 DE OUTUBRO DE 2026 – XXXV – Nº 196 – JABOATÃO DOS GUARARAPES",
      editionNumber: "196",
      isUnmarkedSameDaySecondary: false,
    });
    assert.equal(res196.editionType, "ORDINARIA");
    assert.equal(res196.isExtraOrSupplementary, false);
  });

  it("detecta Edição Extraordinária pelo título, slug e sufixo -A", () => {
    const res196A = detectExtraOrSupplementary({
      slug: "17-de-outubro-de-2026-xxxiv-no-196-a-jaboatao-dos-guararapes-edicao-extraordinaria",
      title: "17 DE OUTUBRO DE 2026 - XXXV – Nº 196-A – JABOATÃO DOS GUARARAPES (Edição Extraordinária)",
      editionNumber: "196-A",
    });
    assert.equal(res196A.editionType, "EXTRAORDINARIA");
    assert.equal(res196A.isExtraOrSupplementary, true);
  });

  it("detecta Edição Suplementar por sufixo numérico -2 ou termo suplementar", () => {
    const resSup = detectExtraOrSupplementary({
      slug: "07-de-outubro-de-2026-xxxiv-no-188-jaboatao-dos-guararapes-2",
      title: "07 DE OUTUBRO DE 2026 – XXXV – Nº 188 – JABOATÃO DOS GUARARAPES",
      editionNumber: "188",
    });
    assert.equal(resSup.editionType, "SUPLEMENTAR");
    assert.equal(resSup.isExtraOrSupplementary, true);
  });
});

describe("classifyAct — regressão de classificação nas 3 categorias", () => {
  it("classifica Decreto sempre como LEIS_E_ATOS_NORMATIVOS mesmo citando licitação/contrato", () => {
    const res = classifyAct({
      sourceType: "Decreto",
      department: "GABINETE DO PREFEITO",
      text: "DECRETO Nº 310/2026. Regulamenta procedimentos de licitação e contratos administrativos no município.",
      metadata: {},
    });
    assert.equal(res.category, "LEIS_E_ATOS_NORMATIVOS");
  });

  it("nunca classifica Notificação fiscal/urbanística como LEIS_E_ATOS_NORMATIVOS", () => {
    const res = classifyAct({
      sourceType: "Notificação",
      department: "SECRETARIA EXECUTIVA DA RECEITA",
      text: "AUTO DE INFRAÇÃO com fundamento na Lei Municipal nº 155/1991. Fica notificado o contribuinte...",
      metadata: {},
    });
    assert.equal(res.category, "CONTRATOS_EDITAIS_AVISOS");
    assert.match(res.subType, /Notificação/);
  });

  it("classifica Portaria de fiscalização de contrato em CONTRATOS_EDITAIS_AVISOS", () => {
    const res = classifyAct({
      sourceType: "Portaria",
      department: "SECRETARIA EXECUTIVA DE GESTÃO CORPORATIVA",
      text: "PORTARIA Nº 320165. Designa Fiscal Administrativo e Fiscal Técnico para acompanhamento e fiscalização do contrato.",
      metadata: {},
    });
    assert.equal(res.category, "CONTRATOS_EDITAIS_AVISOS");
  });
});

describe("editionParser & summarizer — fixtures HTML reais", () => {
  it("extrai atos, anexos PDF, valores e resumo da edição ordinária 24/11/2026", () => {
    const html = fs.readFileSync(
      path.join(fixturesDir, "edition-ordinary-2026-11-24.html"),
      "utf8"
    );
    const parsed = parseEditionHtml({
      url: "https://diariooficial.jaboatao.pe.gov.br/2026/11/24/24-de-novembro-de-2026-xxxiv-no-221-jaboatao-dos-guararapes",
      slug: "24-de-novembro-de-2026-xxxiv-no-221-jaboatao-dos-guararapes",
      publishedDateStr: "2026-11-24",
      publishedDate: new Date("2026-11-24T12:00:00.000Z"),
      html,
    });

    // Título interno mostra Nº 220 (mesmo com slug no-221)
    assert.equal(parsed.editionNumber, "220");
    assert.equal(parsed.editionType, "ORDINARIA");
    assert.equal(parsed.isExtraOrSupplementary, false);
    assert.ok(parsed.acts.length >= 10, `Esperado >= 10 atos, obtido ${parsed.acts.length}`);
    assert.ok(parsed.attachments.length >= 1, "Esperado ao menos 1 anexo PDF");

    const summary = buildDeterministicSummary(parsed);
    assert.ok(summary.totalNormative >= 1, "Esperado ao menos 1 Decreto/Normativo");
    assert.ok(summary.totalPersonnel >= 5, "Esperado múltiplos Atos de Pessoal separados");
    assert.ok(summary.totalContracts >= 1, "Esperado ao menos 1 Contrato/Aviso");
    assert.ok(summary.executiveSummary.length >= 3);
  });

  it("extrai e sinaliza corretamente a edição extraordinária 17/10/2026 Nº 196-A", () => {
    const html = fs.readFileSync(
      path.join(fixturesDir, "edition-extra-2026-10-17.html"),
      "utf8"
    );
    const parsed = parseEditionHtml({
      url: "https://diariooficial.jaboatao.pe.gov.br/2026/10/17/17-de-outubro-de-2026-xxxiv-no-196-a-jaboatao-dos-guararapes-edicao-extraordinaria",
      slug: "17-de-outubro-de-2026-xxxiv-no-196-a-jaboatao-dos-guararapes-edicao-extraordinaria",
      publishedDateStr: "2026-10-17",
      publishedDate: new Date("2026-10-17T12:00:00.000Z"),
      html,
    });

    assert.equal(parsed.editionNumber, "196-A");
    assert.equal(parsed.editionType, "EXTRAORDINARIA");
    assert.equal(parsed.isExtraOrSupplementary, true);
    assert.ok(parsed.acts.length >= 1);

    const summary = buildDeterministicSummary(parsed);
    assert.match(summary.executiveSummary[0], /Edição Extraordinária/i);
  });
});
