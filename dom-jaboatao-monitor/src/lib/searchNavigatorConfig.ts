import { ActCategory } from "./types";

export interface SearchNavigatorCriteria {
  query: string;
  category: string;
  onlyExtra: boolean;
  year: string;
}

export interface SearchNavigatorPreset {
  id: string;
  label: string;
  description: string;
  criteria: SearchNavigatorCriteria;
}

export const SEARCH_NAVIGATOR_PRESETS: SearchNavigatorPreset[] = [
  {
    id: "nomeacoes",
    label: "Nomeações",
    description: "Portarias de nomeação e designação de servidores",
    criteria: {
      query: "Nomear",
      category: "ATOS_DE_PESSOAL",
      onlyExtra: false,
      year: "",
    },
  },
  {
    id: "exoneracoes",
    label: "Exonerações",
    description: "Atos de exoneração e dispensa de cargos",
    criteria: {
      query: "Exonerar",
      category: "ATOS_DE_PESSOAL",
      onlyExtra: false,
      year: "",
    },
  },
  {
    id: "licitacoes",
    label: "Licitações e Pregões",
    description: "Avisos de licitação, pregões eletrônicos e concorrências",
    criteria: {
      query: "Pregão",
      category: "CONTRATOS_EDITAIS_AVISOS",
      onlyExtra: false,
      year: "",
    },
  },
  {
    id: "contratos",
    label: "Contratos e Aditivos",
    description: "Extratos de contratos, termos aditivos e atas",
    criteria: {
      query: "Contrato",
      category: "CONTRATOS_EDITAIS_AVISOS",
      onlyExtra: false,
      year: "",
    },
  },
  {
    id: "creditos",
    label: "Créditos Suplementares",
    description: "Decretos de abertura de crédito adicional suplementar",
    criteria: {
      query: "Crédito",
      category: "LEIS_E_ATOS_NORMATIVOS",
      onlyExtra: false,
      year: "",
    },
  },
  {
    id: "extras",
    label: "Edições Extras",
    description: "Atos publicados em edições extraordinárias ou suplementares",
    criteria: {
      query: "",
      category: "",
      onlyExtra: true,
      year: "",
    },
  },
];

export function hasActiveSearchCriteria(criteria: Partial<SearchNavigatorCriteria>): boolean {
  return Boolean(
    (criteria.query && criteria.query.trim().length > 0) ||
      (criteria.category && criteria.category.trim().length > 0) ||
      criteria.onlyExtra === true ||
      (criteria.year && criteria.year.trim().length > 0)
  );
}

export function isPresetMatchingCriteria(
  preset: SearchNavigatorPreset,
  criteria: SearchNavigatorCriteria
): boolean {
  return (
    preset.criteria.query.trim().toLowerCase() === criteria.query.trim().toLowerCase() &&
    preset.criteria.category === criteria.category &&
    preset.criteria.onlyExtra === criteria.onlyExtra &&
    preset.criteria.year === criteria.year
  );
}

export function buildNavigatorUrlParams(
  criteria: Partial<SearchNavigatorCriteria>,
  editionId?: string
): string {
  const params = new URLSearchParams();
  if (criteria.query?.trim()) params.set("q", criteria.query.trim());
  if (criteria.category?.trim()) params.set("category", criteria.category.trim());
  if (criteria.onlyExtra) params.set("onlyExtra", "true");
  if (criteria.year?.trim()) params.set("year", criteria.year.trim());
  if (!hasActiveSearchCriteria(criteria) && editionId?.trim()) {
    params.set("edition", editionId.trim());
  }
  return params.toString();
}

export interface SearchImpactInputItem {
  category: string;
  department: string;
  monetaryValue?: number | null;
}

export interface SearchImpactSummary {
  totalLocalActs: number;
  pageActsCount: number;
  pageMonetarySum: number;
  actsWithMonetaryCount: number;
  distinctDepartments: string[];
  categoryBreakdown: Record<ActCategory, number>;
  portalPageItemsCount: number;
  portalMaxPage: number;
}

export function computeSearchImpactSummary(
  items: SearchImpactInputItem[],
  totalLocalActs: number,
  portalPageItemsCount = 0,
  portalMaxPage = 1
): SearchImpactSummary {
  let pageMonetarySum = 0;
  let actsWithMonetaryCount = 0;
  const deptSet = new Set<string>();
  const categoryBreakdown: Record<ActCategory, number> = {
    LEIS_E_ATOS_NORMATIVOS: 0,
    ATOS_DE_PESSOAL: 0,
    CONTRATOS_EDITAIS_AVISOS: 0,
    OUTROS: 0,
  };

  for (const item of items) {
    if (item.department?.trim()) {
      deptSet.add(item.department.trim());
    }
    if (item.monetaryValue && item.monetaryValue > 0) {
      pageMonetarySum += item.monetaryValue;
      actsWithMonetaryCount += 1;
    }
    const cat = (item.category as ActCategory) || "OUTROS";
    if (cat in categoryBreakdown) {
      categoryBreakdown[cat] += 1;
    } else {
      categoryBreakdown.OUTROS += 1;
    }
  }

  return {
    totalLocalActs,
    pageActsCount: items.length,
    pageMonetarySum,
    actsWithMonetaryCount,
    distinctDepartments: Array.from(deptSet),
    categoryBreakdown,
    portalPageItemsCount,
    portalMaxPage,
  };
}
