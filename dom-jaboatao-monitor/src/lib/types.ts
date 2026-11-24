export type EditionType = "ORDINARIA" | "EXTRAORDINARIA" | "SUPLEMENTAR";

export type ActCategory =
  | "LEIS_E_ATOS_NORMATIVOS"
  | "ATOS_DE_PESSOAL"
  | "CONTRATOS_EDITAIS_AVISOS"
  | "OUTROS";

export const CATEGORY_LABELS: Record<ActCategory, string> = {
  LEIS_E_ATOS_NORMATIVOS: "Leis e Atos Normativos",
  ATOS_DE_PESSOAL: "Atos de Pessoal",
  CONTRATOS_EDITAIS_AVISOS: "Contratos, Editais e Avisos",
  OUTROS: "Outros Atos",
};

export const EDITION_TYPE_LABELS: Record<EditionType, string> = {
  ORDINARIA: "Ordinária",
  EXTRAORDINARIA: "Edição Extraordinária",
  SUPLEMENTAR: "Edição Suplementar",
};

export interface ActMetadata {
  ementa?: string;
  action?: string; // Nomeação, Exoneração, Designação, Aposentadoria, etc.
  personName?: string;
  role?: string;
  symbol?: string;
  matricula?: string;
  targetDepartment?: string;
  effectDate?: string;
  processNumber?: string;
  modality?: string;
  contractor?: string;
  object?: string;
  validity?: string;
}

export interface ParsedAttachment {
  label: string;
  url: string;
}

export interface ParsedAct {
  externalId?: string;
  sourceType?: string;
  category: ActCategory;
  subType: string;
  department: string;
  actNumber?: string;
  title: string;
  summary: string;
  content: string;
  monetaryValue?: number;
  metadata: ActMetadata;
  attachments: ParsedAttachment[];
  orderIndex: number;
}

export interface EditionListItem {
  url: string;
  slug: string;
  cardTitle: string;
  publishedDateStr: string; // YYYY-MM-DD
  publishedDate: Date;
}

export interface ParsedEdition {
  url: string;
  slug: string;
  publishedDate: Date;
  publishedDateStr: string;
  editionNumber: string;
  romanYear: string;
  title: string;
  editionType: EditionType;
  isExtraOrSupplementary: boolean;
  extraReason?: string;
  rawText: string;
  acts: ParsedAct[];
  attachments: ParsedAttachment[];
}

export function formatCurrencyBRL(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value) || value <= 0) {
    return "";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
