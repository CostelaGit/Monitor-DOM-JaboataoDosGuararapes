import { ActMetadata } from "../types";

export function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractMaxMonetaryValue(text: string): number | undefined {
  const regex = /R\$\s*([\d.]+,\d{2})/gi;
  let maxValue = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && parsed > maxValue) {
      maxValue = parsed;
    }
  }

  return maxValue > 0 ? maxValue : undefined;
}

export function extractActNumber(text: string): string | undefined {
  const patterns = [
    /\b(LEI\s+(?:COMPLEMENTAR\s+|MUNICIPAL\s+)?N[º°o.]*\s*[\d./-]+)/i,
    /\b(DECRETO\s+N[º°o.]*\s*[\d./-]+)/i,
    /\b(PORTARIA\s+(?:CONJUNTA\s+|INTERNA\s+)?N[º°o.]*\s*[\d./-]+)/i,
    /\b(INSTRU[ÇC][ÃA]O\s+NORMATIVA\s+N[º°o.]*\s*[\d./-]+)/i,
    /\b(RESOLU[ÇC][ÃA]O\s+N[º°o.]*\s*[\d./-]+)/i,
    /\b(ATO\s+N[º°o.]*\s*[\d\s./-]+\/\d{4})/i,
    /\b(CONTRATO\s+N[º°o.]*\s*[\d./-]+)/i,
    /\b(EDITAL\s+N[º°o.]*\s*[\d./-]+)/i,
    /\b(PROCESSO\s+LICITAT[ÓO]RIO\s+N[º°o.]*\s*[\w./-]+)/i,
    /\b(PREG[ÃA]O\s+(?:ELETR[ÔO]NICO\s+)?N[º°o.]*\s*[\w./-]+)/i,
    /\b(CONCORR[ÊE]NCIA\s+(?:P[ÚU]BLICA\s+)?N[º°o.]*\s*[\w./-]+)/i,
    /\b(DISPENSA\s+(?:DE\s+LICITA[ÇC][ÃA]O\s+)?N[º°o.]*\s*[\w./-]+)/i,
    /\b(INEXIGIBILIDADE\s+N[º°o.]*\s*[\w./-]+)/i,
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) {
      return m[1].replace(/\s+/g, " ").trim();
    }
  }

  return undefined;
}

export function extractMetadata(text: string, department: string): ActMetadata {
  const meta: ActMetadata = {};

  // Ementa (muito comum em Leis e Decretos)
  const ementaMatch = /Ementa\s*:\s*([^\n]+(?:\n(?!O\s+PREFEITO|CONSIDERANDO|Art\.)[^\n]+)?)/i.exec(
    text
  );
  if (ementaMatch) {
    meta.ementa = ementaMatch[1].replace(/\s+/g, " ").trim();
  }

  // Atos de Pessoal (Nomear, Exonerar, Designar, Tornar sem efeito, Aposentar, etc.)
  const personnelMatch =
    /\b(Nomear|Exonerar|Designar|Dispensar|Tornar\s+sem\s+efeito|Aposentar|Conceder\s+licen[çc]a|Ceder|Relotar|Transferir|Remover)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s.'-]{4,80}?)(?:,|\s+matr[íi]cula|\s+para\s+o\s+cargo|\s+do\s+cargo|\s+no\s+cargo|\s+CPF)/i.exec(
      text
    );

  if (personnelMatch) {
    const rawAction = personnelMatch[1].toLowerCase();
    if (rawAction.startsWith("nomear")) meta.action = "Nomeação";
    else if (rawAction.startsWith("exonerar")) meta.action = "Exoneração";
    else if (rawAction.startsWith("designar")) meta.action = "Designação";
    else if (rawAction.startsWith("dispensar")) meta.action = "Dispensa de Função";
    else if (rawAction.includes("sem efeito")) meta.action = "Tornar sem efeito";
    else if (rawAction.startsWith("aposentar")) meta.action = "Aposentadoria";
    else if (rawAction.includes("licen")) meta.action = "Licença";
    else meta.action = personnelMatch[1];

    meta.personName = personnelMatch[2].replace(/\s+/g, " ").trim();
  }

  // Matrícula
  const matriculaMatch = /matr[íi]cula\s*n[º°o.]*\s*([\d.\-/]+)/i.exec(text);
  if (matriculaMatch) {
    meta.matricula = matriculaMatch[1].trim();
  }

  // Cargo e Símbolo
  const roleMatch =
    /(?:cargo\s+(?:em\s+comiss[ãa]o\s+)?de|fun[çc][ãa]o\s+(?:gratificada\s+)?de)\s+([^,.;\n]{3,90})/i.exec(
      text
    );
  if (roleMatch) {
    meta.role = roleMatch[1].replace(/\s+/g, " ").trim();
  }

  const symbolMatch = /s[íi]mbolo\s+([A-Z0-9-]{2,15})/i.exec(text);
  if (symbolMatch) {
    meta.symbol = symbolMatch[1].trim();
  }

  // Secretaria de destino no ato de pessoal
  const targetDeptMatch =
    /(?:na|da|junto\s+[àa])\s+(SECRETARIA[^\n,.;]{4,95}|PROCURADORIA[^\n,.;]{4,80}|GABINETE[^\n,.;]{4,80}|CONTROLADORIA[^\n,.;]{4,80}|INSTITUTO[^\n,.;]{4,80})/i.exec(
      text
    );
  if (targetDeptMatch) {
    meta.targetDepartment = targetDeptMatch[1].replace(/\s+/g, " ").trim();
  } else if (department) {
    meta.targetDepartment = department;
  }

  // Efeito a partir de
  const effectMatch = /(?:com\s+efeito\s+a\s+partir\s+de|a\s+contar\s+de)\s+([^.;\n]{4,40})/i.exec(
    text
  );
  if (effectMatch) {
    meta.effectDate = effectMatch[1].replace(/\s+/g, " ").trim();
  }

  // Contratos / Licitações
  const processMatch =
    /(?:PROCESSO\s+(?:LICITAT[ÓO]RIO|ADMINISTRATIVO)\s*N[º°o.]*|PROC\.\s*N[º°o.]*)\s*([\w./-]+)/i.exec(
      text
    );
  if (processMatch) {
    meta.processNumber = processMatch[1].trim();
  }

  const modalityMatch =
    /\b(PREG[ÃA]O\s+ELETR[ÔO]NICO|CONCORR[ÊE]NCIA\s+P[ÚU]BLICA|DISPENSA\s+DE\s+LICITA[ÇC][ÃA]O|INEXIGIBILIDADE|CHAMAMENTO\s+P[ÚU]BLICO|ATA\s+DE\s+REGISTRO\s+DE\s+PRE[ÇC]OS|TOMADA\s+DE\s+PRE[ÇC]OS|CREDENCIAMENTO)(?:\s+N[º°o.]*\s*[\w./-]+)?/i.exec(
      text
    );
  if (modalityMatch) {
    meta.modality = modalityMatch[0].replace(/\s+/g, " ").trim();
  }

  const objectMatch = /OBJETO\s*:\s*([^\n]{8,320})/i.exec(text);
  if (objectMatch) {
    meta.object = objectMatch[1].replace(/\s+/g, " ").trim();
  }

  const contractorMatch =
    /(?:CONTRATAD[OA]|EMPRESA|FORNECEDOR|VENCEDOR(?:A)?|REGISTRADA)\s*:\s*([^\n]{4,160})/i.exec(
      text
    );
  if (contractorMatch) {
    meta.contractor = contractorMatch[1].replace(/\s+/g, " ").trim();
  }

  const validityMatch = /VIG[ÊE]NCIA\s*:\s*([^\n]{4,120})/i.exec(text);
  if (validityMatch) {
    meta.validity = validityMatch[1].replace(/\s+/g, " ").trim();
  }

  return meta;
}
