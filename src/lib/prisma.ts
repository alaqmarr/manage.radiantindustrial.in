import { PrismaClient } from "../generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`

const globalForPrisma = globalThis as unknown as { prismaV3: PrismaClient }

export const prisma =
  globalForPrisma.prismaV3 ||
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: dbUrl }),
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaV3 = prisma
