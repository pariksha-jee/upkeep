import { Injectable } from '@nestjs/common';
import type { ChannelType, NotifyEvent } from '@upkeep/core';
import { shouldNotify } from '@upkeep/core';
import { PrismaService } from '../../shared/prisma.service.js';
import { decryptSecret } from '../../shared/crypto.js';
import { notificationProviders } from './providers.js';
import type { NotifyContext } from './templates.js';

type ChannelRow = {
  id: string;
  type: ChannelType;
  label: string;
  config: unknown;
  secretCipher: string | null;
  verifiedAt: Date | null;
};

type MonitorRow = { id: string; name: string; type: string; target: string };

/**
 * Sends notifications and records every attempt in NotificationLog.
 * Used by the worker's notification processor AND the API's verify endpoint.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(private readonly prisma: PrismaService) {}

  /** Deliver to one configured channel. Cooldown is enforced by the caller. */
  async dispatchChannel(
    channel: ChannelRow,
    ctx: NotifyContext,
    incidentId: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    let result: { ok: boolean; error?: string };
    if (channel.type === 'EMAIL') {
      const to = (channel.config as { to?: string }).to ?? '';
      result = await notificationProviders.email(to, ctx);
    } else if (channel.type === 'SMS') {
      const to = (channel.config as { to?: string }).to ?? '';
      result = await notificationProviders.sms(to, ctx);
    } else {
      const url = (channel.config as { url?: string }).url ?? '';
      const secret = channel.secretCipher !== null ? decryptSecret(channel.secretCipher) : null;
      result = await notificationProviders.webhook(url, secret, ctx);
    }
    await this.log({
      incidentId,
      channelId: channel.id,
      type: channel.type,
      event: ctx.event,
      status: result.ok ? 'SENT' : 'FAILED',
      error: result.ok ? null : (result.error ?? 'unknown error'),
    });
    return result;
  }

  /** Push to every registered device of the user (skipped silently if FCM off). */
  async dispatchDevices(
    userId: string,
    monitor: MonitorRow,
    event: NotifyEvent,
    incidentId: string | null,
  ): Promise<void> {
    const devices = await this.prisma.device.findMany({ where: { userId } });
    if (devices.length === 0) return;
    const incident = await this.loadIncident(incidentId);
    const ctx: NotifyContext = { event, monitor, incident };
    const result = await notificationProviders.push(
      devices.map((d) => d.pushToken),
      ctx,
    );
    await this.log({
      incidentId,
      channelId: null,
      type: 'EMAIL', // see schema: push logs carry no channel; type is kept for the enum column
      event,
      status: result.ok ? 'SENT' : 'FAILED',
      error: result.ok ? null : (result.error ?? 'unknown error'),
    });
  }

  /**
   * Worker flow for a binding: cooldown check (SKIPPED) → send → update
   * lastNotifiedAt. TEST events bypass cooldown.
   */
  async dispatchBinding(
    bindingId: string,
    monitor: MonitorRow,
    event: 'DOWN' | 'RECOVERY' | 'TEST',
    incidentId: string | null,
  ): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
    const binding = await this.prisma.alertBinding.findUnique({
      where: { id: bindingId },
      include: { channel: true },
    });
    if (binding === null) return 'SKIPPED';

    if (
      event !== 'TEST' &&
      !shouldNotify(binding.lastNotifiedAt, binding.cooldownMinutes, new Date())
    ) {
      await this.log({
        incidentId,
        channelId: binding.channelId,
        type: binding.channel.type,
        event,
        status: 'SKIPPED',
        error: 'cooldown',
      });
      return 'SKIPPED';
    }

    const incident = await this.loadIncident(incidentId);
    const ctx: NotifyContext = { event, monitor, incident };
    const result = await this.dispatchChannel(binding.channel, ctx, incidentId);
    if (result.ok && event !== 'TEST') {
      await this.prisma.alertBinding.update({
        where: { id: binding.id },
        data: { lastNotifiedAt: new Date() },
      });
    }
    return result.ok ? 'SENT' : 'FAILED';
  }

  private async loadIncident(incidentId: string | null): Promise<NotifyContext['incident']> {
    if (incidentId === null) return null;
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (incident === null) return null;
    return {
      id: incident.id,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      cause: incident.cause,
    };
  }

  private async log(entry: {
    incidentId: string | null;
    channelId: string | null;
    type: ChannelType;
    event: NotifyEvent;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    error: string | null;
  }): Promise<void> {
    await this.prisma.notificationLog
      .create({
        data: {
          type: entry.type,
          event: entry.event,
          status: entry.status,
          error: entry.error,
          channelId: entry.channelId,
          incidentId: entry.incidentId,
        } satisfies import('@upkeep/db').Prisma.NotificationLogUncheckedCreateInput,
      })
      .catch(() => undefined);
  }
}
