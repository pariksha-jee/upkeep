import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@upkeep/db';

/**
 * Prisma lifecycle wrapper. Imported as a provider by both the API and the
 * worker application contexts; connections drain on shutdown (guardrails §8.2).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
