import { syncEditions, SyncMode } from "../src/lib/syncService";
import { prisma } from "../src/lib/db";

function getArgValue(args: string[], prefix: string): string | undefined {
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = getArgValue(args, "--mode=") as SyncMode | undefined;
  const pagesStr = getArgValue(args, "--pages=") ?? getArgValue(args, "--max-pages=");
  const startPageStr = getArgValue(args, "--start-page=");
  const endPageStr = getArgValue(args, "--end-page=");
  const limitStr = getArgValue(args, "--limit=");
  const yearStr = getArgValue(args, "--year=");
  const dateFrom = getArgValue(args, "--from=");
  const dateTo = getArgValue(args, "--to=");
  const searchTerm = getArgValue(args, "--search=");
  const force = args.includes("--force");
  const noEarlyStop = args.includes("--no-early-stop");

  const options = {
    mode,
    maxPages: pagesStr ? Number(pagesStr) : undefined,
    startPage: startPageStr ? Number(startPageStr) : undefined,
    endPage: endPageStr ? Number(endPageStr) : undefined,
    limit: limitStr ? Number(limitStr) : undefined,
    year: yearStr ? Number(yearStr) : undefined,
    dateFrom,
    dateTo,
    searchTerm,
    forceResync: force,
    stopOnExistingPage: noEarlyStop ? false : undefined,
  };

  console.log("[DOM Jaboatão] Iniciando sincronização paginada:", JSON.stringify(options));

  const result = await syncEditions(options);
  console.log("[DOM Jaboatão] Resultado:", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
  if (result.status !== "SUCCESS") {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("Erro fatal na sincronização:", err);
  await prisma.$disconnect();
  process.exit(1);
});
