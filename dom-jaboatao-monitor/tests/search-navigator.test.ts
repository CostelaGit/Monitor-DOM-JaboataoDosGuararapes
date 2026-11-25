import test from "node:test";
import assert from "node:assert/strict";
import {
  SEARCH_NAVIGATOR_PRESETS,
  buildNavigatorUrlParams,
  computeSearchImpactSummary,
  hasActiveSearchCriteria,
  isPresetMatchingCriteria,
} from "../src/lib/searchNavigatorConfig";

test("hasActiveSearchCriteria identifica corretamente estado Radar de Hoje vs Pesquisa Ativa", () => {
  assert.equal(
    hasActiveSearchCriteria({ query: "   ", category: "", onlyExtra: false, year: "" }),
    false,
    "Sem critérios ativos deve exibir o Radar de Hoje"
  );

  assert.equal(
    hasActiveSearchCriteria({ query: "Educação", category: "", onlyExtra: false, year: "" }),
    true
  );
  assert.equal(
    hasActiveSearchCriteria({ query: "", category: "ATOS_DE_PESSOAL", onlyExtra: false, year: "" }),
    true
  );
  assert.equal(
    hasActiveSearchCriteria({ query: "", category: "", onlyExtra: true, year: "" }),
    true
  );
  assert.equal(
    hasActiveSearchCriteria({ query: "", category: "", onlyExtra: false, year: "2025" }),
    true
  );
});

test("SEARCH_NAVIGATOR_PRESETS cobre os atalhos principais e corresponde ao critério ativo", () => {
  assert.ok(SEARCH_NAVIGATOR_PRESETS.length >= 6);

  const nomeacoes = SEARCH_NAVIGATOR_PRESETS.find((p) => p.id === "nomeacoes");
  assert.ok(nomeacoes, "Deve existir o chip de Nomeações");
  assert.equal(
    isPresetMatchingCriteria(nomeacoes, {
      query: "nomear",
      category: "ATOS_DE_PESSOAL",
      onlyExtra: false,
      year: "",
    }),
    true
  );

  const extras = SEARCH_NAVIGATOR_PRESETS.find((p) => p.id === "extras");
  assert.ok(extras, "Deve existir o chip de Edições Extras");
  assert.equal(extras.criteria.onlyExtra, true);
});

test("buildNavigatorUrlParams serializa filtros de busca ou preserva editionId no modo Radar de Hoje", () => {
  const radarQs = buildNavigatorUrlParams(
    { query: "", category: "", onlyExtra: false, year: "" },
    "ed-123"
  );
  assert.equal(radarQs, "edition=ed-123");

  const searchQs = buildNavigatorUrlParams(
    {
      query: "Pregão",
      category: "CONTRATOS_EDITAIS_AVISOS",
      onlyExtra: true,
      year: "",
    },
    "ed-123"
  );
  const parsed = new URLSearchParams(searchQs);
  assert.equal(parsed.get("q"), "Pregão");
  assert.equal(parsed.get("category"), "CONTRATOS_EDITAIS_AVISOS");
  assert.equal(parsed.get("onlyExtra"), "true");
  assert.equal(parsed.get("edition"), null);
});

test("computeSearchImpactSummary agrega valores financeiros, órgãos e categorias da página", () => {
  const summary = computeSearchImpactSummary(
    [
      {
        category: "CONTRATOS_EDITAIS_AVISOS",
        department: "Secretaria Municipal de Educação",
        monetaryValue: 150000.5,
      },
      {
        category: "LEIS_E_ATOS_NORMATIVOS",
        department: "Gabinete do Prefeito",
        monetaryValue: 50000,
      },
      {
        category: "ATOS_DE_PESSOAL",
        department: "Secretaria Municipal de Educação",
        monetaryValue: null,
      },
    ],
    42,
    12,
    85
  );

  assert.equal(summary.totalLocalActs, 42);
  assert.equal(summary.pageActsCount, 3);
  assert.equal(summary.pageMonetarySum, 200000.5);
  assert.equal(summary.actsWithMonetaryCount, 2);
  assert.deepEqual(summary.distinctDepartments, [
    "Secretaria Municipal de Educação",
    "Gabinete do Prefeito",
  ]);
  assert.equal(summary.categoryBreakdown.CONTRATOS_EDITAIS_AVISOS, 1);
  assert.equal(summary.categoryBreakdown.LEIS_E_ATOS_NORMATIVOS, 1);
  assert.equal(summary.categoryBreakdown.ATOS_DE_PESSOAL, 1);
  assert.equal(summary.portalPageItemsCount, 12);
  assert.equal(summary.portalMaxPage, 85);
});
