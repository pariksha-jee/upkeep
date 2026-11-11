'use client';

import type { MonitorStatus, TunnelStatus } from '@upkeep/core';
import { CheckCircle2, CirclePause, CircleAlert, CircleDashed, MinusCircle } from 'lucide-react';
import styles from './status.module.css';

export function StatusDot({ status }: { status: MonitorStatus }) {
  const config = {
    UP: { cls: 'up', icon: CheckCircle2, text: 'Up' },
    DOWN: { cls: 'down', icon: CircleAlert, text: 'Down' },
    PAUSED: { cls: 'paused', icon: CirclePause, text: 'Paused' },
    PENDING: { cls: 'pending', icon: CircleDashed, text: 'Pending' },
  } as const;
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={[styles.dot, styles[c.cls]].join(' ')}>
      <Icon size={14} aria-hidden />
      {c.text}
    </span>
  );
}

export function TunnelBadge({ status }: { status: TunnelStatus }) {
  const cls: Record<TunnelStatus, string> = {
    CONNECTED: 'up',
    CONNECTING: 'pending',
    UNKNOWN: 'paused',
    DEGRADED: 'pending',
    EXPIRED: 'down',
    FAILED: 'down',
  };
  return (
    <span className={[styles.dot, styles[cls[status]]].join(' ')}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

interface BadgeProps {
  tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning';
  children: React.ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={[styles.badge, styles[tone]].join(' ')}>{children}</span>;
}

export function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (expiresAt === null) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <Badge tone="danger">expired {-days}d ago</Badge>;
  if (days <= 3) return <Badge tone="warning">expires in {days}d</Badge>;
  if (days <= 7) return <Badge tone="warning">expires in {days}d</Badge>;
  return (
    <Badge tone="neutral">
      <MinusCircle size={11} aria-hidden /> {days}d left
    </Badge>
  );
}
