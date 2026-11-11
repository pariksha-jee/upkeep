import { Injectable } from '@nestjs/common';
import {
  hostnameOf,
  isPrivateHostnameLiteral,
  LIMITS,
  type ChannelDto,
  type CreateChannelInput,
  type UpdateChannelInput,
} from '@upkeep/core';
import { PrismaService } from '../../shared/prisma.service.js';
import { encryptSecret } from '../../shared/crypto.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { env } from '../../config/env.js';
import { NotificationDispatcher } from '../../worker-core/notify/notification-dispatcher.js';
import type { Prisma } from '@upkeep/db';

type ChannelRow = {
  id: string;
  type: 'EMAIL' | 'SMS' | 'WEBHOOK';
  label: string;
  config: unknown;
  secretCipher: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

export function toChannelDto(row: ChannelRow): ChannelDto {
  if (row.type === 'EMAIL') {
    return {
      id: row.id,
      type: 'EMAIL',
      label: row.label,
      config: { kind: 'EMAIL', to: (row.config as { to: string }).to },
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
  if (row.type === 'SMS') {
    return {
      id: row.id,
      type: 'SMS',
      label: row.label,
      config: { kind: 'SMS', to: (row.config as { to: string }).to },
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
  return {
    id: row.id,
    type: 'WEBHOOK',
    label: row.label,
    config: { kind: 'WEBHOOK', url: (row.config as { url: string }).url },
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async create(userId: string, input: CreateChannelInput): Promise<ChannelDto> {
    const count = await this.prisma.channel.count({ where: { userId } });
    if (count >= LIMITS.channelsPerUser) {
      throw new ConflictError(`Channel limit reached (${LIMITS.channelsPerUser})`);
    }
    const { data, secret } = this.channelData(input);
    this.assertWebhookAllowed(data);
    const row = await this.prisma.channel.create({
      data: {
        userId,
        type: data.type,
        label: input.label,
        config: data.config as Prisma.InputJsonValue,
        ...(secret !== null && secret !== undefined ? { secretCipher: encryptSecret(secret) } : {}),
      },
    });
    return toChannelDto(row);
  }

  async list(userId: string): Promise<ChannelDto[]> {
    const rows = await this.prisma.channel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toChannelDto);
  }

  async update(userId: string, id: string, input: UpdateChannelInput): Promise<ChannelDto> {
    const row = await this.prisma.channel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Channel');
    if (row.type !== input.type) {
      throw new ValidationError([{ path: 'type', message: 'channel type is immutable' }]);
    }
    const { data, secret } = this.channelData(input);
    this.assertWebhookAllowed(data);
    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        config: data.config as Prisma.InputJsonValue,
        ...(secret !== undefined
          ? secret !== null
            ? { secretCipher: encryptSecret(secret) }
            : { secretCipher: null }
          : {}),
        verifiedAt: null, // re-verify after any change
      },
    });
    return toChannelDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.channel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Channel');
    await this.prisma.channel.delete({ where: { id } });
  }

  /** Sends a TEST notification through the channel and records the result. */
  async verify(userId: string, id: string): Promise<{ delivered: boolean; error: string | null }> {
    const row = await this.prisma.channel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Channel');
    const result = await this.dispatcher.dispatchChannel(
      row,
      {
        event: 'TEST',
        monitor: { id: 'test', name: row.label, type: 'TEST', target: 'upkeep' },
        incident: null,
      },
      null,
    );
    if (result.ok) {
      await this.prisma.channel.update({ where: { id }, data: { verifiedAt: new Date() } });
    }
    return { delivered: result.ok, error: result.ok ? null : (result.error ?? 'unknown error') };
  }

  private channelData(input: CreateChannelInput | UpdateChannelInput): {
    data: { type: 'EMAIL' | 'SMS' | 'WEBHOOK'; config: unknown };
    secret: string | null | undefined;
  } {
    if (input.type === 'EMAIL') {
      return { data: { type: 'EMAIL', config: { to: input.email.to } }, secret: null };
    }
    if (input.type === 'SMS') {
      return { data: { type: 'SMS', config: { to: input.sms.to } }, secret: null };
    }
    return {
      data: { type: 'WEBHOOK', config: { url: input.webhook.url } },
      secret: input.webhook.secret !== undefined ? input.webhook.secret : undefined,
    };
  }

  /** SSRF guard for outbound webhooks (security review #4). */
  private assertWebhookAllowed(data: { type: string; config: unknown }): void {
    if (data.type !== 'WEBHOOK' || env.WEBHOOK_ALLOW_PRIVATE) return;
    const url = (data.config as { url: string }).url;
    const host = hostnameOf(url);
    if (host !== null && isPrivateHostnameLiteral(host)) {
      throw new ValidationError([
        {
          path: 'webhook.url',
          message:
            'webhook host is a private address — allowed only on self-hosted servers with WEBHOOK_ALLOW_PRIVATE=true',
        },
      ]);
    }
  }
}
