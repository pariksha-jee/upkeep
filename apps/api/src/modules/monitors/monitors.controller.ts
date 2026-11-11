import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  bindingsUpdateSchema,
  createMonitorSchema,
  listChecksQuerySchema,
  listMonitorsQuerySchema,
  statsQuerySchema,
  updateMonitorSchema,
  type BindingsUpdateInput,
  type CreateMonitorInput,
  type ListChecksQuery,
  type ListMonitorsQuery,
  type MonitorDetailDto,
  type MonitorDto,
  type MonitorStatsDto,
  type StatsQuery,
  type UpdateMonitorInput,
  uuidSchema,
} from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import type { Paginated } from '../../common/pagination.js';
import { MonitorsService } from './monitors.service.js';
import { ChecksService } from './checks.service.js';
import { CheckExecutor, type CheckOutcome } from '../../worker-core/check-executor.js';
import { NotFoundError } from '../../shared/errors.js';

export interface TestNowResult {
  outcome: CheckOutcome;
  status: MonitorDetailDto['status'];
  transition: 'none' | 'went-down' | 'went-up';
}

@Controller('monitors')
export class MonitorsController {
  constructor(
    private readonly monitors: MonitorsService,
    private readonly checks: ChecksService,
    private readonly executor: CheckExecutor,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(listMonitorsQuerySchema)) query: ListMonitorsQuery,
  ): Promise<Paginated<MonitorDto & { uptime24h: number | null }>> {
    return this.monitors.list(user.id, query);
  }

  @Post()
  async create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createMonitorSchema)) body: CreateMonitorInput,
  ): Promise<MonitorDetailDto> {
    return this.monitors.create(user.id, body);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<MonitorDetailDto> {
    return this.monitors.get(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateMonitorSchema)) body: UpdateMonitorInput,
  ): Promise<MonitorDetailDto> {
    return this.monitors.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<{ deleted: true }> {
    await this.monitors.remove(user.id, id);
    return { deleted: true };
  }

  @Post(':id/pause')
  async pause(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<MonitorDetailDto> {
    return this.monitors.pause(user.id, id);
  }

  @Post(':id/resume')
  async resume(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<MonitorDetailDto> {
    return this.monitors.resume(user.id, id);
  }

  /** Runs one check immediately (through the same executor as the worker). */
  @Post(':id/test')
  async test(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<TestNowResult> {
    await this.monitors.get(user.id, id); // ownership
    const result = await this.executor.executeMonitor(id, { trigger: 'manual' });
    if (result === null) throw new NotFoundError('Monitor');
    return result;
  }

  @Put(':id/bindings')
  async updateBindings(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(bindingsUpdateSchema)) body: BindingsUpdateInput,
  ) {
    return this.monitors.updateBindings(user.id, id, body);
  }

  @Get(':id/checks')
  async listChecks(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Query(new ZodValidationPipe(listChecksQuerySchema)) query: ListChecksQuery,
  ) {
    return this.checks.listChecks(user.id, id, query);
  }

  @Get(':id/stats')
  async stats(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Query(new ZodValidationPipe(statsQuerySchema)) query: StatsQuery,
  ): Promise<MonitorStatsDto> {
    return this.checks.stats(user.id, id, query.window);
  }
}
