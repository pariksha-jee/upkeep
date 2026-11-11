'use client';

import Link from 'next/link';
import { formatInterval, formatMs, formatPercent, relativeTime } from '@/lib/format';
import type { MonitorDto } from '@upkeep/core';
import { StatusDot } from '@/components/ui/status';
import { Button, IconButton } from '@/components/ui/Button';
import { Table, TableWrap, Td, Th, EmptyState } from '@/components/ui/table';
import { MonitorUp, Pause, Play, Zap } from 'lucide-react';
import styles from './MonitorTable.module.css';

interface MonitorTableProps {
  monitors: MonitorDto[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onTest: (id: string) => void;
  testingId?: string | null;
}

export function MonitorTable({
  monitors,
  onPause,
  onResume,
  onTest,
  testingId,
}: MonitorTableProps) {
  return (
    <TableWrap>
      {monitors.length === 0 ? (
        <EmptyState
          icon={<MonitorUp size={22} aria-hidden />}
          title="No monitors yet"
          hint="Add your first endpoint — a public URL, or a private service through an SSH/OpenVPN tunnel."
          action={
            <Link href="/dashboard/monitors/new">
              <Button size="sm">Add monitor</Button>
            </Link>
          }
        />
      ) : (
        <Table aria-label="Monitors">
          <thead>
            <tr>
              <Th>Status</Th>
              <Th>Name</Th>
              <Th>Target</Th>
              <Th>Interval</Th>
              <Th>24h uptime</Th>
              <Th>Last check</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => (
              <tr key={m.id}>
                <Td>
                  <StatusDot status={m.status} />
                </Td>
                <Td>
                  <Link href={`/dashboard/monitors/${m.id}`} className={styles.nameLink}>
                    {m.name}
                  </Link>
                  {m.tunnelId !== null ? <span className={styles.tunnelTag}>tunneled</span> : null}
                </Td>
                <Td className={styles.target}>
                  {m.type === 'TCP' ? `${m.target}:${m.port ?? ''}` : m.target}
                </Td>
                <Td className="numeric">{formatInterval(m.intervalSeconds)}</Td>
                <Td className="numeric">
                  {m.uptime24h !== undefined && m.uptime24h !== null
                    ? formatPercent(m.uptime24h)
                    : '—'}
                </Td>
                <Td className="secondary">{relativeTime(m.lastCheckedAt)}</Td>
                <Td>
                  <div className={styles.actions}>
                    <IconButton
                      label="Run check now"
                      onClick={() => onTest(m.id)}
                      disabled={testingId === m.id}
                    >
                      <Zap size={15} aria-hidden />
                    </IconButton>
                    {m.status === 'PAUSED' ? (
                      <IconButton label="Resume monitor" onClick={() => onResume(m.id)}>
                        <Play size={15} aria-hidden />
                      </IconButton>
                    ) : (
                      <IconButton label="Pause monitor" onClick={() => onPause(m.id)}>
                        <Pause size={15} aria-hidden />
                      </IconButton>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </TableWrap>
  );
}

export function MonitorListSkeleton() {
  return (
    <TableWrap>
      <div className={styles.skeletonBlock} aria-busy="true" aria-label="Loading monitors" />
    </TableWrap>
  );
}

export function formatResponseMs(ms: number | null): string {
  return formatMs(ms);
}
