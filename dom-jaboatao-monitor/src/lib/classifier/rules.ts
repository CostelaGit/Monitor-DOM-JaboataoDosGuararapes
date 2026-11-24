import { ActCategory, ActMetadata } from "../types";

export interface ClassificationResult {
  category: ActCategory;
  subType: string;
}

export function classifyAct(params: {
  sourceType?: string;
  department: string;
  text: string;
  metadata: ActMetadata;
}): ClassificationResult {
  const source = (params.sourceType || "").trim().toLowerCase();
  const dept = (params.department || "").trim().toLowerCase();
  const text = params.text;
  const textLower = text.toLowerCase();
  const head = text.slice(0, 500).toLowerCase();

  // 0. Notificações oficiais (checar antes de heurísticas de texto para não confundir citação de leis)
  if (source === "notificação" || source === "notificacao") {
    if (/auto\s+de\s+infra[çc][ãa]o|auto\s+de\s+demoli[çc][ãa]o|embargo/i.test(text)) {
      return {
        category: "CONTRATOS_EDITAIS_AVISOS",
        subType: "Notificação / Auto de Infração",
      };
    }
    if (/tributo|receita|iptu|iss|itbi|lan[çc]amento/i.test(text)) {
      return {
        category: "CONTRATOS_EDITAIS_AVISOS",
        subType: "Notificação Tributária",
      };
    }
    return {
      category: "CONTRATOS_EDITAIS_AVISOS",
      subType: "Notificação / Aviso",
    };
  }

  // 0.5. Tipos oficiais normativos inequívocos (sempre Leis e Atos Normativos)
  if (source === "decreto" || /^\s*decreto\s+n[º°o.]*/im.test(head)) {
    const isCredit = /cr[ée]dito\s+adicional|suplementa[çc][ãa]o/i.test(text);
    return {
      category: "LEIS_E_ATOS_NORMATIVOS",
      subType: isCredit ? "Decreto (Crédito Suplementar)" : "Decreto",
    };
  }

  if (
    source.includes("lei") ||
    /^\s*lei\s+(?:complementar|municipal|ordin[áa]ria)?\s*n[º°o.]*/im.test(head)
  ) {
    return {
      category: "LEIS_E_ATOS_NORMATIVOS",
      subType: /lei\s+complementar/i.test(source + " " + head)
        ? "Lei Complementar"
        : "Lei Municipal",
    };
  }

  if (source.includes("resolu") || /^\s*resolu[çc][ãa]o\b/im.test(head)) {
    return {
      category: "LEIS_E_ATOS_NORMATIVOS",
      subType: "Resolução",
    };
  }

  if (source.includes("instru") || /^\s*instru[çc][ãa]o\s+normativa/im.test(head)) {
    return {
      category: "LEIS_E_ATOS_NORMATIVOS",
      subType: "Instrução Normativa",
    };
  }

  // 1. Contratos, Editais e Avisos (prioridade alta quando é da seção Licitações/Contratos ou tipo explícito)
  const isContractSource =
    /contrato|licita|dispensa|inexigibilidade|edital|aviso|ata\s+de\s+registro|preg[ãa]o|concorr[êe]ncia|chamamento|aditivo|ratifica|homologa|errata/.test(
      source
    );
  const isContractDept = /licita[çc][õo]es|contrata[çc][õo]es/.test(dept);

  // Portaria de designação de fiscal/gestor de contrato
  const isFiscalDesignation =
    /portaria/i.test(head) &&
    /(fiscal\s+administrativo|fiscal\s+t[ée]cnico|gestor\s+do\s+contrato|acompanhamento\s+e\s+fiscaliza[çc][ãa]o)/i.test(
      text
    );

  if (isFiscalDesignation) {
    return {
      category: "CONTRATOS_EDITAIS_AVISOS",
      subType: "Portaria de Fiscalização de Contrato",
    };
  }

  if (isContractSource || isContractDept) {
    return {
      category: "CONTRATOS_EDITAIS_AVISOS",
      subType: inferContractSubType(source, head, textLower),
    };
  }

  // 2. Atos de Pessoal
  const isPersonnelText =
    Boolean(params.metadata.action) ||
    /\b(exonerar|nomear|exonera[çc][ãa]o|nomea[çc][ãa]o|aposentadoria|licen[çc]a\s+pr[êe]mio|licen[çc]a\s+m[ée]dica|progress[ãa]o\s+funcional|sele[çc][ãa]o\s+simplificada|concurso\s+p[úu]blico|cargo\s+em\s+comiss[ãa]o|fun[çc][ãa]o\s+gratificada|relota[çc][ãa]o|cess[ãa]o\s+de\s+servidor|readapta[çc][ãa]o|vac[âa]ncia|est[áa]gio\s+probat[óo]rio|f[ée]rias|substitui[çc][ãa]o\s+de\s+servidor|sindic[âa]ncia|processo\s+administrativo\s+disciplinar)\b/i.test(
      text
    );

  if (
    isPersonnelText ||
    source === "ato" ||
    dept.includes("gestão de pessoas") ||
    dept.includes("gestao de pessoas")
  ) {
    return {
      category: "ATOS_DE_PESSOAL",
      subType: inferPersonnelSubType(params.metadata.action, head, textLower),
    };
  }

  // 3. Contratos, Editais e Avisos encontrados em outras secretarias
  if (
    /\b(extrato\s+de\s+contrato|extrato\s+do\s+\d+[º°o]?\s*termo\s+aditivo|termo\s+aditivo|aviso\s+de\s+licita[çc][ãa]o|aviso\s+de\s+resultado|aviso\s+de\s+dispensa|dispensa\s+de\s+licita[çc][ãa]o|inexigibilidade|processo\s+licitat[óo]rio|preg[ãa]o\s+eletr[ôo]nico|concorr[êe]ncia\s+p[úu]blica|ata\s+de\s+registro\s+de\s+pre[çc]os|termo\s+de\s+ratifica[çc][ãa]o|termo\s+de\s+homologa[çc][ãa]o|chamamento\s+p[úu]blico|edital\s+de\s+convoca[çc][ãa]o|aviso\s+de\s+chamamento|credenciamento)\b/i.test(
      text
    )
  ) {
    return {
      category: "CONTRATOS_EDITAIS_AVISOS",
      subType: inferContractSubType(source, head, textLower),
    };
  }

  // 4. Portarias normativas (quando não são de pessoal nem de contrato)
  if (/^\s*portaria\b/.test(head) || source.includes("portaria")) {
    return {
      category: "LEIS_E_ATOS_NORMATIVOS",
      subType: "Portaria Normativa",
    };
  }

  // 5. Editais e Avisos genéricos
  if (/\b(edital|aviso|comunicado|notifica[çc][ãa]o|intima[çc][ãa]o)\b/i.test(head)) {
    return {
      category: "CONTRATOS_EDITAIS_AVISOS",
      subType: /\bedital\b/i.test(head) ? "Edital" : "Aviso / Comunicado",
    };
  }

  return {
    category: "OUTROS",
    subType: params.sourceType || "Publicação Oficial",
  };
}

function inferContractSubType(source: string, head: string, textLower: string): string {
  if (/errata/.test(source) || /^\s*errata\b/.test(head)) {
    return "Errata";
  }
  if (/dispensa/.test(source) || /dispensa\s+de\s+licita|dispensa\s+em\s+raz[ãa]o/.test(textLower)) {
    return "Dispensa de Licitação";
  }
  if (/inexigibilidade/.test(head) || /inexigibilidade/.test(source)) {
    return "Inexigibilidade";
  }
  if (/aditivo/.test(head) || /termo\s+aditivo/.test(textLower)) {
    return "Termo Aditivo";
  }
  if (/ata\s+de\s+registro/.test(head) || /ata\s+de\s+registro/.test(source)) {
    return "Ata de Registro de Preços";
  }
  if (/resultado|julgamento|homologa|adjudica/.test(head)) {
    return "Resultado / Homologação";
  }
  if (/concorr[êe]ncia|preg[ãa]o|processo\s+licitat|aviso\s+de\s+licita/.test(head)) {
    return "Aviso de Licitação";
  }
  if (/extrato\s+de\s+contrato|contrato/.test(head) || source.includes("contrato")) {
    return "Extrato de Contrato";
  }
  if (/chamamento|credenciamento/.test(head)) {
    return "Chamamento / Credenciamento";
  }
  if (/edital/.test(head) || /edital/.test(source)) {
    return "Edital";
  }
  return "Aviso / Contratação";
}

function inferPersonnelSubType(
  action: string | undefined,
  head: string,
  textLower: string
): string {
  if (action) return action;
  if (/aposentad/.test(textLower)) return "Aposentadoria";
  if (/concurso|sele[çc][ãa]o\s+simplificada/.test(textLower)) return "Concurso / Seleção";
  if (/licen[çc]a/.test(textLower)) return "Licença";
  if (/sindic[âa]ncia|disciplinar/.test(textLower)) return "Processo Disciplinar";
  if (/portaria/.test(head)) return "Portaria de Pessoal";
  return "Ato de Pessoal";
}
