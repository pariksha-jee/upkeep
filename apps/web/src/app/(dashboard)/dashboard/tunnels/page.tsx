'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Radio, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { ExpiryBadge, TunnelBadge } from '@/components/ui/status';
import { Table, TableWrap, Td, Th, EmptyState } from '@/components/ui/table';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTunnelMutations, useTunnels } from '@/hooks/api';
import { relativeTime } from '@/lib/format';
import styles from './tunnels.module.css';

type CredentialMode = 'INLINE' | 'SIGNED_URL';

export default function TunnelsPage() {
  const { data: tunnels, isLoading } = useTunnels();
  const mutations = useTunnelMutations();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'SSH' | 'OPENVPN'>('SSH');
  const [mode, setMode] = useState<CredentialMode>('INLINE');
  const [name, setName] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [openvpnConfig, setOpenvpnConfig] = useState('');
  const [signedProvider, setSignedProvider] = useState<'AWS_S3' | 'GCP_CS'>('AWS_S3');
  const [signedUrl, setSignedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<{ id: string; name: string } | null>(null);
  const [rotateUrl, setRotateUrl] = useState('');
  const [rotateProvider, setRotateProvider] = useState<'AWS_S3' | 'GCP_CS'>('AWS_S3');

  async function onCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await mutations.create.mutateAsync(
        type === 'SSH'
          ? mode === 'INLINE'
            ? {
                type: 'SSH',
                name,
                credentialSource: 'INLINE',
                ssh: { host: sshHost.trim(), port: Number(sshPort), username: sshUser.trim() },
                privateKey,
              }
            : {
                type: 'SSH',
                name,
                credentialSource: 'SIGNED_URL',
                ssh: { host: sshHost.trim(), port: Number(sshPort), username: sshUser.trim() },
                signedUrl: { provider: signedProvider, url: signedUrl.trim() },
              }
          : mode === 'INLINE'
            ? { type: 'OPENVPN', name, credentialSource: 'INLINE', openvpnConfig }
            : {
                type: 'OPENVPN',
                name,
                credentialSource: 'SIGNED_URL',
                signedUrl: { provider: signedProvider, url: signedUrl.trim() },
              },
      );
      toast('Tunnel created', 'success');
      setOpen(false);
      setName('');
      setPrivateKey('');
      setOpenvpnConfig('');
      setSignedUrl('');
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
        title="Tunnels"
        subtitle="Reach private endpoints through SSH or OpenVPN — credentials encrypted at rest, or fetched from your signed URLs."
        action={<Button onClick={() => setOpen(true)}>Add tunnel</Button>}
      />

      <Card padded={false}>
        {isLoading ? (
          <div className={styles.loading}>Loading tunnels…</div>
        ) : (tunnels ?? []).length === 0 ? (
          <EmptyState
            icon={<Radio size={22} aria-hidden />}
            title="No tunnels yet"
            hint="Create an SSH or OpenVPN tunnel, then attach monitors to it to watch internal services."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                Add tunnel
              </Button>
            }
          />
        ) : (
          <TableWrap>
            <Table aria-label="Tunnels">
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Credential</Th>
                  <Th>Expiry</Th>
                  <Th>Last error</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {(tunnels ?? []).map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <TunnelBadge status={t.status} />
                    </Td>
                    <Td className={styles.name}>{t.name}</Td>
                    <Td>{t.type === 'SSH' ? 'SSH' : 'OpenVPN'}</Td>
                    <Td className="secondary">
                      {t.credentialSource === 'INLINE'
                        ? 'encrypted at rest'
                        : `${t.credentialProvider === 'AWS_S3' ? 'AWS S3' : 'GCS'} signed URL`}
                    </Td>
                    <Td>
                      <ExpiryBadge expiresAt={t.credentialExpiresAt} />
                    </Td>
                    <Td className={styles.errorCell}>
                      {t.lastError !== null
                        ? `${t.lastError} · ${relativeTime(t.lastErrorAt)}`
                        : '—'}
                    </Td>
                    <Td>
                      <div className={styles.actions}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const r = await mutations.test
                              .mutateAsync(t.id)
                              .catch((e: Error) => ({ ok: false, message: e.message }));
                            toast(
                              r.ok ? `Tunnel OK — ${r.message}` : `Test failed — ${r.message}`,
                              r.ok ? 'success' : 'error',
                            );
                          }}
                        >
                          Test
                        </Button>
                        {t.credentialSource === 'SIGNED_URL' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRotateTarget({ id: t.id, name: t.name });
                              setRotateUrl('');
                            }}
                          >
                            <RefreshCw size={14} aria-hidden /> Rotate
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(t.id)}>
                          <Trash2 size={14} aria-hidden />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add tunnel" wide>
        <form onSubmit={onCreate} className={styles.form}>
          {error !== null ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          <div className={styles.grid}>
            <Field label="Tunnel type">
              <Select value={type} onChange={(e) => setType(e.target.value as 'SSH' | 'OPENVPN')}>
                <option value="SSH">SSH (key + port forwarding)</option>
                <option value="OPENVPN">OpenVPN (client config)</option>
              </Select>
            </Field>
            <Field label="Name" htmlFor="tf-name" required>
              <Input
                id="tf-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="prod-bastion"
              />
            </Field>
          </div>

          <Field label="Credential source">
            <Select value={mode} onChange={(e) => setMode(e.target.value as CredentialMode)}>
              <option value="INLINE">Upload / paste (encrypted at rest)</option>
              <option value="SIGNED_URL">Signed URL (fetched at runtime, never stored)</option>
            </Select>
          </Field>

          {type === 'SSH' ? (
            <div className={styles.grid}>
              <Field label="SSH host" htmlFor="tf-host" required>
                <Input
                  id="tf-host"
                  required
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="bastion.company.com"
                />
              </Field>
              <Field label="Port" htmlFor="tf-port">
                <Input
                  id="tf-port"
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                />
              </Field>
              <Field label="Username" htmlFor="tf-user" required>
                <Input
                  id="tf-user"
                  required
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="deploy"
                />
              </Field>
            </div>
          ) : null}

          {mode === 'INLINE' ? (
            type === 'SSH' ? (
              <Field
                label="Private key (PEM / OpenSSH)"
                htmlFor="tf-key"
                required
                hint="Encrypted with AES-256-GCM before storage."
              >
                <Textarea
                  id="tf-key"
                  required
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                />
              </Field>
            ) : (
              <Field
                label="OpenVPN client config"
                htmlFor="tf-ovpn"
                required
                hint="Scripts, route-up, proxies and similar directives are rejected for security."
              >
                <Textarea
                  id="tf-ovpn"
                  required
                  value={openvpnConfig}
                  onChange={(e) => setOpenvpnConfig(e.target.value)}
                  placeholder={'client\ndev tun\nproto udp\nremote vpn.company.com 1194'}
                />
              </Field>
            )
          ) : (
            <div className={styles.grid}>
              <Field label="Provider">
                <Select
                  value={signedProvider}
                  onChange={(e) => setSignedProvider(e.target.value as 'AWS_S3' | 'GCP_CS')}
                >
                  <option value="AWS_S3">AWS S3 presigned URL</option>
                  <option value="GCP_CS">GCP Cloud Storage signed URL</option>
                </Select>
              </Field>
              <Field
                label="Signed URL"
                htmlFor="tf-url"
                required
                hint="We fetch the credential at connect time and keep it in memory only. Expiry is tracked automatically."
              >
                <Input
                  id="tf-url"
                  required
                  value={signedUrl}
                  onChange={(e) => setSignedUrl(e.target.value)}
                  placeholder="https://bucket.s3.amazonaws.com/key.pem?X-Amz-Signature=…"
                />
              </Field>
            </div>
          )}

          <div className={styles.actions}>
            <Button type="submit" loading={busy}>
              <KeyRound size={15} aria-hidden /> Create tunnel
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={rotateTarget !== null}
        onClose={() => setRotateTarget(null)}
        title={`Rotate signed URL — ${rotateTarget?.name ?? ''}`}
      >
        <div className={styles.form}>
          <Field label="Provider">
            <Select
              value={rotateProvider}
              onChange={(e) => setRotateProvider(e.target.value as 'AWS_S3' | 'GCP_CS')}
            >
              <option value="AWS_S3">AWS S3 presigned URL</option>
              <option value="GCP_CS">GCP Cloud Storage signed URL</option>
            </Select>
          </Field>
          <Field label="New signed URL" htmlFor="rot-url" required>
            <Input
              id="rot-url"
              required
              value={rotateUrl}
              onChange={(e) => setRotateUrl(e.target.value)}
            />
          </Field>
          <div className={styles.actions}>
            <Button
              loading={mutations.update.isPending}
              onClick={async () => {
                if (rotateTarget === null) return;
                try {
                  await mutations.update.mutateAsync({
                    id: rotateTarget.id,
                    input: { signedUrl: { provider: rotateProvider, url: rotateUrl.trim() } },
                  });
                  toast('Signed URL rotated', 'success');
                  setRotateTarget(null);
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              Rotate
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete tunnel"
        message="Monitors attached to this tunnel will fall back to direct (public) checks. Continue?"
        confirmLabel="Delete tunnel"
        busy={mutations.remove.isPending}
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          if (confirmId === null) return;
          await mutations.remove
            .mutateAsync(confirmId)
            .catch((e: Error) => toast(e.message, 'error'));
          toast('Tunnel deleted', 'success');
          setConfirmId(null);
        }}
      />
    </>
  );
}
