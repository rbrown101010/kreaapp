import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// IMPORTANT: SQLite optimizations for better performance
async function initSqlitePragmas(prisma: PrismaClient) {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
}

initSqlitePragmas(prisma);

export { prisma };
