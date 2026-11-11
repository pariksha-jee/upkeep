'use client';

import { useState, type FormEvent } from 'react';
import { Bell, Trash2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/form';
import { Badge } from '@/components/ui/status';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useChannelMutations, useChannels } from '@/hooks/api';
import styles from './channels.module.css';

type ChannelType = 'EMAIL' | 'SMS' | 'WEBHOOK';

export default function ChannelsPage() {
  const { data: channels, isLoading } = useChannels();
  const mutations = useChannelMutations();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChannelType>('EMAIL');
  const [label, setLabel] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [smsTo, setSmsTo] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await mutations.create.mutateAsync(
        type === 'EMAIL'
          ? { type: 'EMAIL', label, email: { to: emailTo.trim() } }
          : type === 'SMS'
            ? { type: 'SMS', label, sms: { to: smsTo.trim() } }
            : {
                type: 'WEBHOOK',
                label,
                webhook: {
                  url: webhookUrl.trim(),
                  ...(webhookSecret !== '' ? { secret: webhookSecret } : {}),
                },
              },
      );
      toast('Channel created — verify it to confirm delivery', 'success');
      setOpen(false);
      setLabel('');
      setEmailTo('');
      setSmsTo('');
      setWebhookUrl('');
      setWebhookSecret('');
    } catch (err) {
      const e2 = err as { details?: Array<{ path: string; message: string }>; message: string };
      setError(e2.details?.[0] ? `${e2.details[0].path}: ${e2.details[0].message}` : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notification channels"
        subtitle="Where alerts land: email, SMS and HMAC-signed webhooks. Push is automatic for signed-in mobile devices."
        action={<Button onClick={() => setOpen(true)}>Add channel</Button>}
      />

      <Card padded={false}>
        {isLoading ? (
          <div className={styles.loading}>Loading channels…</div>
        ) : (channels ?? []).length === 0 ? (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyTitle}>No channels yet</p>
            <p className={styles.emptyHint}>
              Add at least one channel, then bind monitors to it to receive down/recovery alerts.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {(channels ?? []).map((c) => (
              <li key={c.id} className={styles.item}>
                <div className={styles.itemMeta}>
                  <span className={styles.itemLabel}>{c.label}</span>
                  <span className={styles.itemType}>{c.type}</span>
                  <span className={styles.itemTarget}>
                    {c.config.kind === 'WEBHOOK' ? c.config.url : c.config.to}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  {c.verifiedAt !== null ? (
                    <Badge tone="success">verified</Badge>
                  ) : (
                    <Badge tone="warning">unverified</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const r = await mutations.verify.mutateAsync(c.id).catch((e: Error) => ({
                        delivered: false,
                        error: e.message,
                      }));
                      toast(
                        r.delivered
                          ? 'Test notification sent'
                          : `Delivery failed — ${r.error ?? 'unknown'}`,
                        r.delivered ? 'success' : 'error',
                      );
                    }}
                  >
                    <Zap size={14} aria-hidden /> Test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(c.id)}>
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add channel">
        <form onSubmit={onCreate} className={styles.form}>
          {error !== null ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as ChannelType)}>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WEBHOOK">Webhook (POST)</option>
            </Select>
          </Field>
          <Field label="Label" htmlFor="cf-label" required>
            <Input
              id="cf-label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="On-call email"
            />
          </Field>
          {type === 'EMAIL' ? (
            <Field label="Send to" htmlFor="cf-to" required>
              <Input
                id="cf-to"
                type="email"
                required
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="oncall@company.com"
              />
            </Field>
          ) : type === 'SMS' ? (
            <Field
              label="Phone (E.164)"
              htmlFor="cf-sms"
              required
              hint="Include the country code, e.g. +14155552671"
            >
              <Input
                id="cf-sms"
                required
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+14155552671"
              />
            </Field>
          ) : (
            <>
              <Field
                label="URL"
                htmlFor="cf-url"
                required
                hint="Receives a signed POST (X-Upkeep-Signature) on down/recovery."
              >
                <Input
                  id="cf-url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.company.com/upkeep"
                />
              </Field>
              <Field
                label="Signing secret (optional)"
                htmlFor="cf-secret"
                hint="≥16 chars. Verify authenticity with HMAC-SHA256 over `timestamp.body`."
              >
                <Input
                  id="cf-secret"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_…"
                />
              </Field>
            </>
          )}
          <div className={styles.actions}>
            <Button type="submit" loading={busy}>
              <Bell size={15} aria-hidden /> Create channel
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete channel"
        message="Monitors bound to this channel will stop alerting through it. Continue?"
        confirmLabel="Delete channel"
        busy={mutations.remove.isPending}
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          if (confirmId === null) return;
          await mutations.remove
            .mutateAsync(confirmId)
            .catch((e: Error) => toast(e.message, 'error'));
          toast('Channel deleted', 'success');
          setConfirmId(null);
        }}
      />
    </>
  );
}
