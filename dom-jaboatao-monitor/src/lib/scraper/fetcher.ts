export const DOM_BASE_URL = "https://diariooficial.jaboatao.pe.gov.br";

const USER_AGENT =
  "MonitorDOM-Jaboatao/1.0 (+https://diariooficial.jaboatao.pe.gov.br/; coleta-resumo-cidadao)";

let lastRequestTime = 0;
const MIN_DELAY_MS = 650;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtml(
  urlOrPath: string,
  options?: { retries?: number; timeoutMs?: number }
): Promise<string> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `${DOM_BASE_URL}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;

  const retries = options?.retries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 25000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_DELAY_MS) {
      await sleep(MIN_DELAY_MS - elapsed);
    }
    lastRequestTime = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao acessar ${url}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw new Error(
    `Falha ao baixar ${url} após ${retries} tentativas: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
