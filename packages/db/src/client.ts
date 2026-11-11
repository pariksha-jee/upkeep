import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client singleton for the API and worker processes.
 * Connection pooling and lifecycle are managed by Prisma itself.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export * from '@prisma/client';
