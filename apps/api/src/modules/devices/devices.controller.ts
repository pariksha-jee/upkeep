import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  registerDeviceSchema,
  uuidSchema,
  type DeviceDto,
  type RegisterDeviceInput,
} from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { PrismaService } from '../../shared/prisma.service.js';
import { NotFoundError } from '../../shared/errors.js';

@Controller('devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Registers (or refreshes) a push token — idempotent on pushToken. */
  @Post()
  async register(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ): Promise<DeviceDto> {
    const row = await this.prisma.device.upsert({
      where: { pushToken: body.pushToken },
      update: {
        userId: user.id, // tokens move with re-login
        platform: body.platform,
        ...(body.appVersion !== undefined ? { appVersion: body.appVersion } : {}),
        lastSeenAt: new Date(),
      },
      create: {
        userId: user.id,
        platform: body.platform,
        pushToken: body.pushToken,
        ...(body.appVersion !== undefined ? { appVersion: body.appVersion } : {}),
      },
    });
    return {
      id: row.id,
      platform: row.platform,
      appVersion: row.appVersion,
      lastSeenAt: row.lastSeenAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<DeviceDto[]> {
    const rows = await this.prisma.device.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      appVersion: row.appVersion,
      lastSeenAt: row.lastSeenAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<{ deleted: true }> {
    const row = await this.prisma.device.findFirst({ where: { id, userId: user.id } });
    if (row === null) throw new NotFoundError('Device');
    await this.prisma.device.delete({ where: { id } });
    return { deleted: true };
  }
}
