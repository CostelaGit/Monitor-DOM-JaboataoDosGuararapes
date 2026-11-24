import { EditionType } from "../types";

export interface ExtraDetectionResult {
  editionType: EditionType;
  isExtraOrSupplementary: boolean;
  extraReason?: string;
}

/**
 * Verifica se a edição possui marcador explícito de Extraordinária ou Suplementar
 * (independentemente de existir outra edição na mesma data).
 */
export function hasExplicitExtraMarker(params: {
  slug: string;
  title?: string;
  editionNumber?: string;
}): boolean {
  const slugLower = params.slug.toLowerCase();
  const titleLower = (params.title || "").toLowerCase();
  const num = (params.editionNumber || "").trim();

  if (
    /suplement/.test(titleLower) ||
    /suplement/.test(slugLower) ||
    /caderno[\s-]+extra/.test(titleLower)
  ) {
    return true;
  }

  if (
    /extraordin[aá]ri/.test(titleLower) ||
    /extraordinari/.test(slugLower) ||
    /edi[cç][aã]o[\s-]+extra\b/.test(titleLower) ||
    /edicao-extra\b/.test(slugLower)
  ) {
    return true;
  }

  if (/^\d+\s*[-/]\s*[A-Za-z]$/.test(num) || /-no-\d+-[a-z]-/.test(slugLower)) {
    return true;
  }

  if (/-jaboatao-dos-guararapes-\d+$/.test(slugLower)) {
    return true;
  }

  return false;
}

export function detectExtraOrSupplementary(params: {
  slug: string;
  title: string;
  editionNumber: string;
  /**
   * Verdadeiro apenas quando existem múltiplas edições na mesma data,
   * NENHUMA delas tem marcador explícito e esta é a publicação secundária/adicional.
   */
  isUnmarkedSameDaySecondary?: boolean;
}): ExtraDetectionResult {
  const { slug, title, editionNumber, isUnmarkedSameDaySecondary } = params;
  const slugLower = slug.toLowerCase();
  const titleLower = title.toLowerCase();

  // 1. Checa Suplementar explicitamente
  if (
    /suplement/.test(titleLower) ||
    /suplement/.test(slugLower) ||
    /caderno[\s-]+extra/.test(titleLower)
  ) {
    return {
      editionType: "SUPLEMENTAR",
      isExtraOrSupplementary: true,
      extraReason: "Identificada como Edição Suplementar no título ou endereço oficial",
    };
  }

  // 2. Checa Extraordinária / Extra explicitamente no título ou slug
  if (
    /extraordin[aá]ri/.test(titleLower) ||
    /extraordinari/.test(slugLower) ||
    /edi[cç][aã]o[\s-]+extra\b/.test(titleLower) ||
    /edicao-extra\b/.test(slugLower)
  ) {
    return {
      editionType: "EXTRAORDINARIA",
      isExtraOrSupplementary: true,
      extraReason: "Identificada como Edição Extraordinária no título ou endereço oficial",
    };
  }

  // 3. Checa sufixo alfabético na numeração (ex.: 196-A, 210-B)
  if (/^\d+\s*[-/]\s*[A-Za-z]$/.test(editionNumber.trim()) || /-no-\d+-[a-z]-/.test(slugLower)) {
    return {
      editionType: "EXTRAORDINARIA",
      isExtraOrSupplementary: true,
      extraReason: `Numeração complementar detectada (Nº ${editionNumber})`,
    };
  }

  // 4. Checa sufixo numérico no slug indicando segunda publicação da mesma edição (ex.: -jaboatao-dos-guararapes-2)
  if (/-jaboatao-dos-guararapes-\d+$/.test(slugLower)) {
    return {
      editionType: "SUPLEMENTAR",
      isExtraOrSupplementary: true,
      extraReason: "Publicação adicional detectada para a mesma edição/data (sufixo numérico no endereço)",
    };
  }

  // 5. Fallback de colisão de data: apenas quando há 2+ edições no mesmo dia sem marcador explícito
  if (isUnmarkedSameDaySecondary) {
    return {
      editionType: "EXTRAORDINARIA",
      isExtraOrSupplementary: true,
      extraReason: "Publicação adicional na mesma data sem marcador explícito",
    };
  }

  return {
    editionType: "ORDINARIA",
    isExtraOrSupplementary: false,
  };
}
