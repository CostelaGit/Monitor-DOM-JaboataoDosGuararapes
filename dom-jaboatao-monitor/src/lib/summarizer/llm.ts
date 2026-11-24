import { ParsedEdition, CATEGORY_LABELS } from "../types";

export async function generateOptionalAiSummary(edition: ParsedEdition): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const compactActs = edition.acts
    .slice(0, 40)
    .map(
      (a, idx) =>
        `${idx + 1}. [${CATEGORY_LABELS[a.category]} | ${a.subType} | ${a.department}] ${a.title} — ${a.summary}`
    )
    .join("\n");

  const prompt = `Você é um analista de Diário Oficial Municipal.
Gere um resumo executivo curto, claro e objetivo em português (máximo 1 parágrafo com 3 a 5 frases) sobre esta edição do Diário Oficial de Jaboatão dos Guararapes.
Destaque se é Edição Extraordinária/Suplementar (quando aplicável), as principais leis/decretos, movimentações relevantes de pessoal e contratos/licitações.

Edição: ${edition.title}
Tipo: ${edition.editionType}
Total de atos: ${edition.acts.length}

Atos principais:
${compactActs}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 320,
          },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim().length > 10 ? text.trim() : null;
  } catch {
    return null;
  }
}
