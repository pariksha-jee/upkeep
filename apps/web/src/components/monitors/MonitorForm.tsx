'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { MonitorDetailDto } from '@upkeep/core';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/Toast';
import { useChannels, useMonitorMutations, useTunnels } from '@/hooks/api';
import styles from './MonitorForm.module.css';

const INTERVALS = [
  { v: 30, label: '30 seconds' },
  { v: 60, label: '1 minute' },
  { v: 300, label: '5 minutes' },
  { v: 600, label: '10 minutes' },
  { v: 900, label: '15 minutes' },
  { v: 1800, label: '30 minutes' },
  { v: 3600, label: '1 hour' },
];

interface MonitorFormProps {
  /** Present → edit mode. */
  monitor?: MonitorDetailDto;
}

export function MonitorForm({ monitor }: MonitorFormProps) {
  const router = useRouter();
  const { data: tunnels } = useTunnels();
  const { data: channels } = useChannels();
  const mutations = useMonitorMutations();
  const { toast } = useToast();

  const isEdit = monitor !== undefined;
  const [type, setType] = useState<'HTTP' | 'TCP'>(monitor?.type ?? 'HTTP');
  const [name, setName] = useState(monitor?.name ?? '');
  const [target, setTarget] = useState(
    monitor?.type === 'TCP'
      ? monitor.target
      : monitor?.type === 'HTTP' && monitor.target.startsWith('http')
        ? monitor.target
        : '',
  );
  const [port, setPort] = useState(
    monitor?.port !== null && monitor?.port !== undefined ? String(monitor.port) : '',
  );
  const [interval, setInterval] = useState(String(monitor?.intervalSeconds ?? 60));
  const [timeoutMs, setTimeoutMs] = useState(String(monitor?.timeoutMs ?? 10000));
  const [failThreshold, setFailThreshold] = useState(String(monitor?.failureThreshold ?? 2));
  const [recoverThreshold, setRecoverThreshold] = useState(String(monitor?.recoveryThreshold ?? 2));
  const [tunnelId, setTunnelId] = useState(monitor?.tunnelId ?? '');
  const [keyword, setKeyword] = useState(monitor?.keyword ?? '');
  const [expected, setExpected] = useState(
    monitor?.expectedStatusCodes !== null && monitor?.expectedStatusCodes !== undefined
      ? monitor.expectedStatusCodes.join(', ')
      : '',
  );
  const [boundChannels, setBoundChannels] = useState<string[]>(
    (monitor?.bindings ?? []).map((b) => b.channelId),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const intervalValue = Number(interval) as 30 | 60 | 300 | 600 | 900 | 1800 | 3600;
      const common = {
        name: name.trim(),
        intervalSeconds: intervalValue,
        timeoutMs: Number(timeoutMs),
        failureThreshold: Number(failThreshold),
        recoveryThreshold: Number(recoverThreshold),
        tunnelId: tunnelId === '' ? null : tunnelId,
        channelIds: boundChannels,
      };
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: monitor.id,
          input: {
            ...common,
            ...(type === 'HTTP'
              ? {
                  keyword: keyword === '' ? null : keyword,
                  expectedStatusCodes:
                    expected.trim() === ''
                      ? null
                      : expected
                          .split(',')
                          .map((s) => Number(s.trim()))
                          .filter((n) => !Number.isNaN(n)),
                }
              : {}),
          },
        });
        toast('Monitor updated', 'success');
        router.push(`/dashboard/monitors/${monitor.id}`);
      } else {
        const created = await mutations.create.mutateAsync(
          type === 'HTTP'
            ? {
                type: 'HTTP' as const,
                target: target.trim(),
                method: 'GET' as const,
                ...common,
              }
            : { type: 'TCP' as const, target: target.trim(), port: Number(port), ...common },
        );
        toast('Monitor created — first check within seconds', 'success');
        router.push(`/dashboard/monitors/${created.id}`);
      }
    } catch (err) {
      const e = err as { details?: Array<{ path: string; message: string }>; message: string };
      setError(
        e.details !== undefined && e.details.length > 0
          ? `${e.details[0]?.path}: ${e.details[0]?.message}`
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <Card>
        <h2 className={styles.sectionTitle}>Target</h2>
        <div className={styles.grid}>
          {!isEdit ? (
            <Field label="Check type">
              <Select value={type} onChange={(e) => setType(e.target.value as 'HTTP' | 'TCP')}>
                <option value="HTTP">HTTP(S) request</option>
                <option value="TCP">TCP port</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Name" htmlFor="mf-name" required>
            <Input
              id="mf-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production API"
            />
          </Field>
          {type === 'HTTP' ? (
            <Field
              label="URL"
              htmlFor="mf-target"
              required
              hint="Full URL including https:// — private hosts require a tunnel below."
            >
              <Input
                id="mf-target"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://api.internal.company.com/health"
              />
            </Field>
          ) : (
            <>
              <Field label="Host" htmlFor="mf-host" required>
                <Input
                  id="mf-host"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="db.internal"
                />
              </Field>
              <Field label="Port" htmlFor="mf-port" required>
                <Input
                  id="mf-port"
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="5432"
                />
              </Field>
            </>
          )}
          <Field
            label="Tunnel (optional)"
            htmlFor="mf-tunnel"
            hint="Route checks through an SSH/OpenVPN tunnel to reach private targets."
          >
            <Select id="mf-tunnel" value={tunnelId} onChange={(e) => setTunnelId(e.target.value)}>
              <option value="">Direct (public internet)</option>
              {(tunnels ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type.toLowerCase()})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {type === 'HTTP' ? (
          <div className={styles.grid}>
            <Field label="Keyword assertion (optional)" htmlFor="mf-keyword">
              <Input
                id="mf-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder='"ok" — body must contain this'
              />
            </Field>
            <Field label="Accepted status codes (optional)" htmlFor="mf-expected">
              <Input
                id="mf-expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="200, 301 (default: any 2xx)"
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Schedule &amp; sensitivity</h2>
        <div className={styles.grid}>
          <Field label="Check interval" htmlFor="mf-interval">
            <Select id="mf-interval" value={interval} onChange={(e) => setInterval(e.target.value)}>
              {INTERVALS.map((i) => (
                <option key={i.v} value={i.v}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timeout (ms)" htmlFor="mf-timeout">
            <Input
              id="mf-timeout"
              type="number"
              min={1000}
              max={30000}
              step={500}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(e.target.value)}
            />
          </Field>
          <Field label="Confirm down after N failures" htmlFor="mf-fail">
            <Input
              id="mf-fail"
              type="number"
              min={1}
              max={10}
              value={failThreshold}
              onChange={(e) => setFailThreshold(e.target.value)}
            />
          </Field>
          <Field label="Confirm up after N successes" htmlFor="mf-recover">
            <Input
              id="mf-recover"
              type="number"
              min={1}
              max={10}
              value={recoverThreshold}
              onChange={(e) => setRecoverThreshold(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Alerts</h2>
        {(channels ?? []).length === 0 ? (
          <p className={styles.noChannels}>
            No notification channels yet — add one (email, SMS, webhook) on the Channels page, then
            bind it here.
          </p>
        ) : (
          <div className={styles.channelGrid}>
            {(channels ?? []).map((c) => (
              <label key={c.id} className={styles.channelOption}>
                <input
                  type="checkbox"
                  checked={boundChannels.includes(c.id)}
                  onChange={(e) =>
                    setBoundChannels((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
                  }
                />
                <span className={styles.channelType}>{c.type}</span>
                <span className={styles.channelLabel}>{c.label}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className={styles.actions}>
        <Button type="submit" loading={busy}>
          {isEdit ? 'Save changes' : 'Create monitor'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
