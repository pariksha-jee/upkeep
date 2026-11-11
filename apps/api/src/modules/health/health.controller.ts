import { Controller, Get, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Public } from '../../common/decorators.js';
import { PrismaService } from '../../shared/prisma.service.js';
import { REDIS_CLIENT } from '../../common/redis.provider.js';
import { ServiceUnavailableError } from '../../shared/errors.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<{ status: 'ok'; checks: { database: boolean; redis: boolean } }> {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis
        .ping()
        .then((r) => r === 'PONG')
        .catch(() => false),
    ]);
    if (!database || !redis) {
      throw new ServiceUnavailableError(
        `readiness failed (database: ${database ? 'ok' : 'down'}, redis: ${redis ? 'ok' : 'down'})`,
      );
    }
    return { status: 'ok', checks: { database, redis } };
  }
}
