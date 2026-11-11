import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createChannelSchema,
  updateChannelSchema,
  uuidSchema,
  type ChannelDto,
  type CreateChannelInput,
  type UpdateChannelInput,
} from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { ChannelsService } from './channels.service.js';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<ChannelDto[]> {
    return this.channels.list(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createChannelSchema)) body: CreateChannelInput,
  ): Promise<ChannelDto> {
    return this.channels.create(user.id, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateChannelSchema)) body: UpdateChannelInput,
  ): Promise<ChannelDto> {
    return this.channels.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<{ deleted: true }> {
    await this.channels.remove(user.id, id);
    return { deleted: true };
  }

  @Post(':id/verify')
  async verify(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<{ delivered: boolean; error: string | null }> {
    return this.channels.verify(user.id, id);
  }
}
