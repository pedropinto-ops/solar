import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton do Prisma Client.
 *
 * Em desenvolvimento, o Next.js faz hot-reload e cria novas instâncias —
 * o globalThis evita esgotar pool de conexões.
 * Em produção, sempre uma instância nova.
 */
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
