/**
 * What this file does: creates the Prisma client singleton used by repository implementations.
 * What calls it: repository modules under src/repositories/.
 * What it calls: the generated Prisma client from prisma/schema.prisma.
 * One thing a junior engineer would likely get wrong when writing something similar: instantiating a new Prisma client on every request in dev and leaking connections.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/unison_hr?schema=public";
const adapter = new PrismaPg({ connectionString });

export const db =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = db;
}
