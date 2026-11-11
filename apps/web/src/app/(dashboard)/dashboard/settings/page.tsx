'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/api';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/Toast';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(session?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateProfile({
        ...(name !== session?.name ? { name: name.trim() } : {}),
        ...(newPassword !== ''
          ? { currentPassword, newPassword: newPassword.length >= 10 ? newPassword : '' }
          : {}),
      });
      toast('Profile saved', 'success');
      setCurrentPassword('');
      setNewPassword('');
      void qc.invalidateQueries({ queryKey: ['session'] });
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Account and preferences." />
      <Card className={styles.card}>
        <CardHeader title="Profile" subtitle={session?.email} />
        <form onSubmit={onSave} className={styles.form}>
          <Field label="Display name" htmlFor="set-name">
            <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Current password"
            htmlFor="set-cpw"
            hint="Required only when changing your password."
          >
            <Input
              id="set-cpw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="set-npw"
            hint="At least 10 characters. Leave blank to keep the current one."
          >
            <Input
              id="set-npw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <div className={styles.actions}>
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Theme"
          subtitle="Light or dark — saved per browser, follows your OS by default."
        />
      </Card>

      <Card>
        <CardHeader title="API" subtitle="Automation and integrations." />
        <p className={styles.apiText}>
          The full REST API is documented as OpenAPI at{' '}
          <code className={styles.code}>GET /openapi.json</code>. Webhook payloads are versioned (
          <code className={styles.code}>version: 1</code>) and HMAC-signed when you set a channel
          secret.
        </p>
      </Card>
    </>
  );
}
