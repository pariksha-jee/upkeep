'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CirclePause, MonitorUp, Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/Toast';
import { MonitorTable } from '@/components/monitors/MonitorTable';
import { useMonitorMutations, useMonitors, useSummary } from '@/hooks/api';
import { formatPercent } from '@/lib/format';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: summary } = useSummary();
  const { data, isLoading } = useMonitors(page, { status: statusFilter });
  const mutations = useMonitorMutations();
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        title="Monitors"
        subtitle="All endpoints under watch — public and tunneled."
        action={
          <Link href="/dashboard/monitors/new">
            <Button>
              <MonitorUp size={16} aria-hidden /> Add monitor
            </Button>
          </Link>
        }
      />

      <div className={styles.stats}>
        <StatCard
          label="Up"
          value={String(summary?.monitors.up ?? 0)}
          tone="up"
          icon={<CheckCircle2 size={19} aria-hidden />}
        />
        <StatCard
          label="Down"
          value={String(summary?.monitors.down ?? 0)}
          tone="down"
          icon={<AlertTriangle size={19} aria-hidden />}
        />
        <StatCard
          label="Paused"
          value={String(summary?.monitors.paused ?? 0)}
          tone="warning"
          icon={<CirclePause size={19} aria-hidden />}
        />
        <StatCard
          label="Open incidents"
          value={String(summary?.openIncidents ?? 0)}
          tone={summary !== undefined && summary.openIncidents > 0 ? 'down' : 'default'}
          icon={<Activity size={19} aria-hidden />}
        />
      </div>

      <Card padded={false}>
        <div className={styles.toolbar}>
          <h2 className={styles.toolbarTitle}>Your monitors</h2>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="">All statuses</option>
            <option value="UP">Up</option>
            <option value="DOWN">Down</option>
            <option value="PENDING">Pending</option>
            <option value="PAUSED">Paused</option>
          </Select>
        </div>
        {isLoading ? (
          <div className={styles.loading} aria-busy="true">
            Loading monitors…
          </div>
        ) : (
          <MonitorTable
            monitors={data?.data ?? []}
            onPause={async (id) => {
              await mutations.pause.mutateAsync(id).catch((e: Error) => toast(e.message, 'error'));
              toast('Monitor paused', 'success');
            }}
            onResume={async (id) => {
              await mutations.resume.mutateAsync(id).catch((e: Error) => toast(e.message, 'error'));
              toast('Monitor resumed', 'success');
            }}
            onTest={async (id) => {
              try {
                const r = await mutations.testNow.mutateAsync(id);
                toast(
                  r.outcome.ok
                    ? `Check ok — ${r.outcome.responseTimeMs ?? '?'} ms (${r.status})`
                    : `Check failed — ${r.outcome.error ?? 'unknown'} (${r.status})`,
                  r.outcome.ok ? 'success' : 'error',
                );
              } catch (e) {
                toast((e as Error).message, 'error');
              }
            }}
            testingId={mutations.testNow.isPending ? (mutations.testNow.variables ?? null) : null}
          />
        )}
        {data !== undefined && data.meta !== undefined ? (
          <div className={styles.pageInfo}>
            {data.meta.total} monitor{(data.meta.total ?? 0) === 1 ? '' : 's'} · page{' '}
            {data.meta.page}
          </div>
        ) : null}
      </Card>

      {summary !== undefined && summary.worstMonitors.length > 0 ? (
        <Card>
          <h2 className={styles.toolbarTitle}>Lowest 24h uptime</h2>
          <ul className={styles.worst}>
            {summary.worstMonitors.map((w) => (
              <li key={w.id}>
                <Link href={`/dashboard/monitors/${w.id}`}>{w.name}</Link>
                <span className="numeric">{formatPercent(w.uptime24h)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
