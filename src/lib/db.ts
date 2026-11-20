import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c timezone=UTC" });
  // DB session in UTC so reports are identical whatever timezone the server machine uses
  return new PrismaClient({ adapter });
}

/** Single shared Prisma client (re-used across hot reloads in dev). */
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
