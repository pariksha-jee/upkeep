import type { NotifyEvent, WebhookPayload } from '@upkeep/core';

export interface NotifyContext {
  event: NotifyEvent;
  monitor: { id: string; name: string; type: string; target: string };
  incident: {
    id: string;
    startedAt: Date;
    resolvedAt: Date | null;
    cause: string | null;
  } | null;
}

function duration(from: Date, to: Date): string {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function messageTitle(ctx: NotifyContext): string {
  switch (ctx.event) {
    case 'DOWN':
      return `DOWN: ${ctx.monitor.name}`;
    case 'RECOVERY': {
      const dur =
        ctx.incident !== null && ctx.incident.resolvedAt !== null
          ? ` after ${duration(ctx.incident.startedAt, ctx.incident.resolvedAt)}`
          : '';
      return `UP: ${ctx.monitor.name}${dur}`;
    }
    case 'TEST':
      return 'Upkeep test notification';
    case 'SYSTEM':
      return `Upkeep: ${ctx.monitor.name}`;
  }
}

export function messageBody(ctx: NotifyContext): string {
  switch (ctx.event) {
    case 'DOWN':
      return `${ctx.monitor.name} (${ctx.monitor.target}) is down: ${ctx.incident?.cause ?? 'check failed'}.`;
    case 'RECOVERY':
      return `${ctx.monitor.name} (${ctx.monitor.target}) is back up.`;
    case 'TEST':
      return 'This is a test notification from Upkeep. If you received it, this channel works.';
    case 'SYSTEM':
      return `${ctx.monitor.name}: ${ctx.incident?.cause ?? 'system event'}.`;
  }
}

export function webhookPayload(ctx: NotifyContext, occurredAt = new Date()): WebhookPayload {
  return {
    version: 1,
    event: ctx.event,
    monitor: {
      id: ctx.monitor.id,
      name: ctx.monitor.name,
      type: ctx.monitor.type as WebhookPayload['monitor']['type'],
      target: ctx.monitor.target,
    },
    incident:
      ctx.incident !== null
        ? {
            id: ctx.incident.id,
            startedAt: ctx.incident.startedAt.toISOString(),
            resolvedAt: ctx.incident.resolvedAt?.toISOString() ?? null,
            cause: ctx.incident.cause,
          }
        : null,
    message: messageBody(ctx),
    occurredAt: occurredAt.toISOString(),
  };
}
