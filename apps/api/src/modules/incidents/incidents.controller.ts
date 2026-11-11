import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { uuidSchema, type IncidentDto, type NotificationLogDto } from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { PrismaService } from '../../shared/prisma.service.js';
import { NotFoundError } from '../../shared/errors.js';
import { paginate, type Paginated } from '../../common/pagination.js';

const listIncidentsQuerySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
  monitorId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(listIncidentsQuerySchema))
    query: z.infer<typeof listIncidentsQuerySchema>,
  ): Promise<Paginated<IncidentDto>> {
    const where = {
      monitor: { userId: user.id },
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.monitorId !== undefined ? { monitorId: query.monitorId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { monitor: { select: { name: true } } },
      }),
      this.prisma.incident.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({
        id: r.id,
        monitorId: r.monitorId,
        monitorName: r.monitor.name,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        cause: r.cause,
        lastError: r.lastError,
      })),
      query.page,
      query.limit,
      total,
    );
  }

  @Get(':id')
  async get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<IncidentDto> {
    const row = await this.prisma.incident.findFirst({
      where: { id, monitor: { userId: user.id } },
      include: { monitor: { select: { name: true } } },
    });
    if (row === null) throw new NotFoundError('Incident');
    return {
      id: row.id,
      monitorId: row.monitorId,
      monitorName: row.monitor.name,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      cause: row.cause,
      lastError: row.lastError,
    };
  }

  /** Delivery log for an incident — "who was told, when" (PLAN §9.2). */
  @Get(':id/notifications')
  async notifications(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<NotificationLogDto[]> {
    const incident = await this.prisma.incident.findFirst({
      where: { id, monitor: { userId: user.id } },
    });
    if (incident === null) throw new NotFoundError('Incident');
    const rows = await this.prisma.notificationLog.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'desc' },
      include: { channel: { select: { label: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      incidentId: r.incidentId,
      channelId: r.channelId,
      channelLabel: r.channel?.label ?? 'push',
      type: r.type,
      event: r.event as NotificationLogDto['event'],
      status: r.status,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
