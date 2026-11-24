import { ParsedEdition, formatCurrencyBRL, EDITION_TYPE_LABELS } from "../types";

export interface EditionMetricsAndSummary {
  executiveSummary: string[];
  totalActs: number;
  totalNormative: number;
  totalPersonnel: number;
  totalContracts: number;
  totalOthers: number;
  totalAppointments: number;
  totalDismissals: number;
  totalMonetaryValue: number;
}

export function buildDeterministicSummary(edition: ParsedEdition): EditionMetricsAndSummary {
  const normative = edition.acts.filter((a) => a.category === "LEIS_E_ATOS_NORMATIVOS");
  const personnel = edition.acts.filter((a) => a.category === "ATOS_DE_PESSOAL");
  const contracts = edition.acts.filter((a) => a.category === "CONTRATOS_EDITAIS_AVISOS");
  const others = edition.acts.filter((a) => a.category === "OUTROS");

  const appointments = personnel.filter(
    (a) => a.metadata.action === "Nomeação" || a.subType === "Nomeação"
  );
  const dismissals = personnel.filter(
    (a) => a.metadata.action === "Exoneração" || a.subType === "Exoneração"
  );

  const totalMonetaryValue = edition.acts.reduce(
    (acc, act) => acc + (act.monetaryValue && act.monetaryValue > 0 ? act.monetaryValue : 0),
    0
  );

  const bullets: string[] = [];

  if (edition.isExtraOrSupplementary) {
    bullets.push(
      `Atenção: ${EDITION_TYPE_LABELS[edition.editionType]} detectada${
        edition.extraReason ? ` (${edition.extraReason})` : ""
      }.`
    );
  }

  // 1. Leis e Atos Normativos
  if (normative.length > 0) {
    const subTypeCounts = countBy(normative.map((a) => a.subType));
    const breakdown = formatCountMap(subTypeCounts);
    const highlight = normative[0];
    const highlightNote = highlight.metadata.ementa
      ? ` — destaque: "${truncate(highlight.metadata.ementa, 110)}"`
      : highlight.title
        ? ` — destaque: ${truncate(highlight.title, 95)}`
        : "";
    bullets.push(
      `Leis e Atos Normativos: ${normative.length} publicação(ões) (${breakdown})${highlightNote}.`
    );
  } else {
    bullets.push("Leis e Atos Normativos: nenhuma lei, decreto ou ato normativo identificado nesta edição.");
  }

  // 2. Atos de Pessoal
  if (personnel.length > 0) {
    const parts: string[] = [];
    if (appointments.length > 0) parts.push(`${appointments.length} nomeação(ões)`);
    if (dismissals.length > 0) parts.push(`${dismissals.length} exoneração(ões)`);
    const otherPersonnel = personnel.length - appointments.length - dismissals.length;
    if (otherPersonnel > 0) parts.push(`${otherPersonnel} outro(s) ato(s)/portaria(s)`);

    const topDepts = Object.entries(
      countBy(personnel.map((a) => a.metadata.targetDepartment || a.department))
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([d]) => d);

    const deptSuffix = topDepts.length > 0 ? ` — órgãos em destaque: ${topDepts.join(", ")}` : "";
    bullets.push(`Atos de Pessoal: ${personnel.length} ato(s) (${parts.join(", ")})${deptSuffix}.`);
  } else {
    bullets.push("Atos de Pessoal: nenhuma movimentação de pessoal registrada nesta edição.");
  }

  // 3. Contratos, Editais e Avisos
  if (contracts.length > 0) {
    const subTypeCounts = countBy(contracts.map((a) => a.subType));
    const breakdown = formatCountMap(subTypeCounts);
    const contractTotal = contracts.reduce((sum, a) => sum + (a.monetaryValue || 0), 0);
    const valueNote =
      contractTotal > 0 ? ` — valores identificados somam ${formatCurrencyBRL(contractTotal)}` : "";
    bullets.push(
      `Contratos, Editais e Avisos: ${contracts.length} publicação(ões) (${breakdown})${valueNote}.`
    );
  } else {
    bullets.push("Contratos, Editais e Avisos: sem extratos, licitações ou editais nesta edição.");
  }

  // 4. Anexos PDF ou Outros
  if (edition.attachments.length > 0) {
    bullets.push(
      `Documentos anexos: ${edition.attachments.length} arquivo(s) PDF externo(s) vinculados a esta edição.`
    );
  } else if (others.length > 0) {
    bullets.push(`Outras publicações diversas: ${others.length} item(ns) adicional(is).`);
  }

  return {
    executiveSummary: bullets,
    totalActs: edition.acts.length,
    totalNormative: normative.length,
    totalPersonnel: personnel.length,
    totalContracts: contracts.length,
    totalOthers: others.length,
    totalAppointments: appointments.length,
    totalDismissals: dismissals.length,
    totalMonetaryValue,
  };
}

function countBy(items: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const key = item || "Outros";
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function formatCountMap(map: Record<string, number>): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => `${count} ${label}`)
    .join(", ");
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 3).trim()}...`;
}
