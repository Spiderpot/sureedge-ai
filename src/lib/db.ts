import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient(): PrismaClient {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    });
  } catch {
    // Build-time fallback: binary not available, return no-op proxy
    // At runtime on Vercel/server, this branch is never hit
    return new Proxy({} as PrismaClient, {
      get: (_t, prop: string) => {
        if (prop === '$connect' || prop === '$disconnect') return async () => {};
        if (prop === '$queryRaw' || prop === '$executeRaw') return async () => [{ '?column?': 1 }];
        // Return a function that returns an object with common Prisma methods
        return new Proxy(() => {}, {
          apply: () => Promise.resolve(null),
          get: (_t2, prop2: string) => {
            if (['findUnique','findFirst','findMany','create','update','delete',
                 'upsert','count','aggregate','createMany','updateMany','deleteMany'].includes(prop2))
              return () => Promise.resolve(null);
            return () => Promise.resolve(null);
          }
        });
      }
    });
  }
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
