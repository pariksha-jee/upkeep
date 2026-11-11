'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StatsWindow } from '@upkeep/core';
import { Pencil, Trash2, Zap, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { StatusDot } from '@/components/ui/status';
import { Table, TableWrap, Td, Th, EmptyState } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { UptimeBars } from '@/components/charts/UptimeBars';
import { ResponseChart } from '@/components/charts/ResponseChart';
import {
  useIncidents,
  useMonitor,
  useMonitorChecks,
  useMonitorMutations,
  useMonitorStats,
} from '@/hooks/api';
import {
  formatDateTime,
  formatInterval,
  formatMs,
  formatPercent,
  relativeTime,
} from '@/lib/format';
import styles from './monitor-detail.module.css';

const WINDOWS: StatsWindow[] = ['1h', '24h', '7d', '30d', '90d'];

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [win, setWin] = useState<StatsWindow>('24h');
  const [confirming, setConfirming] = useState(false);
  const { data: monitor, isLoading } = useMonitor(id);
  const { data: stats } = useMonitorStats(id, win);
  const { data: checks } = useMonitorChecks(id, 50);
  const { data: incidents } = useIncidents(undefined, 1);
  const mutations = useMonitorMutations();
  const { toast } = useToast();
  const router = useRouter();

  if (isLoading || monitor === undefined) {
    return (
      <>
        <PageHeader title="Monitor" />
        <div className={styles.loading} aria-busy="true">
          Loading monitor…
        </div>
      </>
    );
  }

  const monitorIncidents = (incidents?.data ?? []).filter((i) => i.monitorId === id);

  return (
    <>
      <PageHeader
        title={monitor.name}
        subtitle={`${monitor.type === 'TCP' ? `${monitor.target}:${monitor.port ?? ''}` : monitor.target} · every ${formatInterval(monitor.intervalSeconds)}`}
        action={
          <div className={styles.headerActions}>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  const r = await mutations.testNow.mutateAsync(id);
                  toast(
                    r.outcome.ok
                      ? `Check ok — ${r.outcome.responseTimeMs ?? '?'} ms`
                      : `Failed: ${r.outcome.error}`,
                    r.outcome.ok ? 'success' : 'error',
                  );
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              <Zap size={15} aria-hidden /> Check now
            </Button>
            <Link href={`/dashboard/monitors/${id}/edit`}>
              <Button size="sm" variant="secondary">
                <Pencil size={15} aria-hidden /> Edit
              </Button>
            </Link>
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 size={15} aria-hidden /> Delete
            </Button>
          </div>
        }
      />

      <div className={styles.summaryRow}>
        <Card>
          <p className={styles.statLabel}>Status</p>
          <div className={styles.statusValue}>
            <StatusDot status={monitor.status} />
          </div>
        </Card>
        <Card>
          <p className={styles.statLabel}>Uptime ({win})</p>
          <p className={[styles.statValue, 'numeric'].join(' ')}>
            {stats !== undefined ? formatPercent(stats.uptimeRatio) : '—'}
          </p>
        </Card>
        <Card>
          <p className={styles.statLabel}>Avg response</p>
          <p className={[styles.statValue, 'numeric'].join(' ')}>
            {stats !== undefined ? formatMs(stats.avgResponseMs) : '—'}
          </p>
        </Card>
        <Card>
          <p className={styles.statLabel}>Last check</p>
          <p className={styles.statValue}>{relativeTime(monitor.lastCheckedAt)}</p>
        </Card>
      </div>

      <Card>
        <div className={styles.chartHeader}>
          <h2 className={styles.cardTitle}>Uptime</h2>
          <div className={styles.windowTabs} role="tablist" aria-label="Statistics window">
            {WINDOWS.map((w) => (
              <button
                key={w}
                role="tab"
                aria-selected={win === w}
                className={`${styles.windowTab} ${win === w ? styles.windowTabActive : ''}`}
                onClick={() => setWin(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        {stats !== undefined ? (
          <UptimeBars stats={stats} />
        ) : (
          <div className={styles.loading}>Loading…</div>
        )}
        {stats !== undefined && stats.totalChecks > 0 ? (
          <p className={styles.chartMeta}>
            {stats.totalChecks} checks · {stats.failedChecks} failed · min{' '}
            {formatMs(stats.minResponseMs)} · max {formatMs(stats.maxResponseMs)}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Response time</h2>
        {stats !== undefined ? (
          <ResponseChart stats={stats} />
        ) : (
          <div className={styles.loading}>Loading…</div>
        )}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Recent checks</h2>
        {(checks ?? []).length === 0 ? (
          <EmptyState title="No checks yet" hint="The first check runs within one interval." />
        ) : (
          <TableWrap>
            <Table aria-label="Recent checks">
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Result</Th>
                  <Th>Response</Th>
                  <Th>Status code</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {(checks ?? []).map((c) => (
                  <tr key={c.id}>
                    <Td className="secondary">{formatDateTime(c.checkedAt)}</Td>
                    <Td>
                      <StatusDot status={c.status === 'UP' ? 'UP' : 'DOWN'} />
                    </Td>
                    <Td className="numeric">{formatMs(c.responseTimeMs)}</Td>
                    <Td className="numeric">{c.statusCode ?? '—'}</Td>
                    <Td className={styles.errorCell}>{c.error ?? ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <h2 className={styles.cardTitle}>Incidents</h2>
        {monitorIncidents.length === 0 ? (
          <EmptyState title="No incidents recorded" />
        ) : (
          <ul className={styles.incidents}>
            {monitorIncidents.slice(0, 10).map((i) => (
              <li key={i.id} className={styles.incident}>
                <div>
                  <p className={styles.incidentCause}>{i.cause ?? 'check failed'}</p>
                  <p className={styles.incidentTime}>
                    started {formatDateTime(i.startedAt)}
                    {i.resolvedAt !== null
                      ? ` · resolved ${formatDateTime(i.resolvedAt)}`
                      : ' · ongoing'}
                  </p>
                </div>
                <StatusDot status={i.status === 'OPEN' ? 'DOWN' : 'UP'} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {monitor.tunnelId !== null ? (
        <p className={styles.tunnelNote}>
          <ExternalLink size={13} aria-hidden /> Checks route through a tunnel.{' '}
          <Link href="/dashboard/tunnels">Manage tunnels</Link>
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Delete monitor"
        message={`Delete "${monitor.name}" and all of its history? This cannot be undone.`}
        confirmLabel="Delete monitor"
        busy={mutations.remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          await mutations.remove.mutateAsync(id).catch((e: Error) => toast(e.message, 'error'));
          toast('Monitor deleted', 'success');
          router.replace('/dashboard');
        }}
      />
    </>
  );
}
