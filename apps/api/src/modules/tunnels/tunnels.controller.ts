import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createTunnelSchema,
  updateTunnelSchema,
  uuidSchema,
  type CreateTunnelInput,
  type TunnelDto,
  type UpdateTunnelInput,
} from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { TunnelsService, type TunnelTestResult } from './tunnels.service.js';

@Controller('tunnels')
export class TunnelsController {
  constructor(private readonly tunnels: TunnelsService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<TunnelDto[]> {
    return this.tunnels.list(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createTunnelSchema)) body: CreateTunnelInput,
  ): Promise<TunnelDto> {
    return this.tunnels.create(user.id, body);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<TunnelDto> {
    return this.tunnels.get(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateTunnelSchema)) body: UpdateTunnelInput,
  ): Promise<TunnelDto> {
    return this.tunnels.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<{ deleted: true }> {
    await this.tunnels.remove(user.id, id);
    return { deleted: true };
  }

  @Post(':id/test')
  async test(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<TunnelTestResult> {
    return this.tunnels.test(user.id, id);
  }
}
