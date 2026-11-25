import { PrismaClient } from "@prisma/client";

export const DEFAULT_LOCAL_DATABASE_URL = "file:./dev.db";

export function ensureLocalDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const current = env.DATABASE_URL?.trim();
  if (current) {
    return current;
  }
  env.DATABASE_URL = DEFAULT_LOCAL_DATABASE_URL;
  return DEFAULT_LOCAL_DATABASE_URL;
}

ensureLocalDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
