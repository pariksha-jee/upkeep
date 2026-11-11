import { describe, expect, it } from 'vitest';
import {
  createChannelSchema,
  createMonitorSchema,
  createTunnelSchema,
  registerSchema,
} from '../src/index.js';

describe('createMonitorSchema', () => {
  it('parses a valid HTTP monitor and applies defaults', () => {
    const parsed = createMonitorSchema.parse({
      type: 'HTTP',
      name: 'API',
      target: 'https://api.example.com/health',
      intervalSeconds: 60,
    });
    expect(parsed.timeoutMs).toBe(10_000);
    expect(parsed.method).toBe('GET');
    expect(parsed.failureThreshold).toBe(2);
    expect(parsed.channelIds).toEqual([]);
  });

  it('rejects unsupported intervals', () => {
    expect(() =>
      createMonitorSchema.parse({
        type: 'HTTP',
        name: 'API',
        target: 'https://api.example.com/health',
        intervalSeconds: 45,
      }),
    ).toThrow();
  });

  it('rejects non-http target', () => {
    expect(() =>
      createMonitorSchema.parse({
        type: 'HTTP',
        name: 'API',
        target: 'ftp://example.com',
        intervalSeconds: 60,
      }),
    ).toThrow();
  });

  it('requires a port for TCP monitors', () => {
    expect(() =>
      createMonitorSchema.parse({
        type: 'TCP',
        name: 'db',
        target: 'db.internal',
        intervalSeconds: 30,
      }),
    ).toThrow();
    const ok = createMonitorSchema.parse({
      type: 'TCP',
      name: 'db',
      target: 'db.internal',
      port: 5432,
      intervalSeconds: 30,
    });
    expect(ok.type).toBe('TCP');
  });
});

describe('createTunnelSchema', () => {
  it('parses INLINE SSH with a PEM key', () => {
    const key = `-----BEGIN OPENSSH PRIVATE KEY-----\n${'a'.repeat(100)}\n-----END OPENSSH PRIVATE KEY-----\n`;
    const parsed = createTunnelSchema.parse({
      type: 'SSH',
      name: 'bastion',
      credentialSource: 'INLINE',
      ssh: { host: 'bastion.example.com', username: 'deploy' },
      privateKey: key,
    });
    expect(parsed.credentialSource).toBe('INLINE');
    if (parsed.credentialSource === 'INLINE' && parsed.type === 'SSH') {
      expect(parsed.ssh.port).toBe(22);
    }
  });

  it('rejects INLINE SSH with a non-PEM private key', () => {
    expect(() =>
      createTunnelSchema.parse({
        type: 'SSH',
        name: 'bastion',
        credentialSource: 'INLINE',
        ssh: { host: 'bastion.example.com', username: 'deploy' },
        privateKey: 'not-a-key',
      }),
    ).toThrow();
  });

  it('parses SIGNED_URL OpenVPN and requires HTTPS + known provider', () => {
    const url = 'https://storage.googleapis.com/bucket/creds.ovpn?X-Goog-Signature=abc';
    expect(() =>
      createTunnelSchema.parse({
        type: 'OPENVPN',
        name: 'corp-vpn',
        credentialSource: 'SIGNED_URL',
        signedUrl: { provider: 'AZURE', url },
      }),
    ).toThrow();
    const parsed = createTunnelSchema.parse({
      type: 'OPENVPN',
      name: 'corp-vpn',
      credentialSource: 'SIGNED_URL',
      signedUrl: { provider: 'GCP_CS', url },
    });
    expect(parsed.signedUrl.provider).toBe('GCP_CS');
    expect(() =>
      createTunnelSchema.parse({
        type: 'OPENVPN',
        name: 'corp-vpn',
        credentialSource: 'SIGNED_URL',
        signedUrl: { provider: 'GCP_CS', url: 'http://insecure.example.com/creds' },
      }),
    ).toThrow();
  });
});

describe('createChannelSchema', () => {
  it('validates SMS numbers as E.164', () => {
    expect(() =>
      createChannelSchema.parse({
        type: 'SMS',
        label: 'on-call',
        sms: { to: '4155552671' },
      }),
    ).toThrow();
    expect(
      createChannelSchema.parse({
        type: 'SMS',
        label: 'on-call',
        sms: { to: '+14155552671' },
      }).type,
    ).toBe('SMS');
  });
});

describe('registerSchema', () => {
  it('enforces a 10-char minimum password', () => {
    expect(() => registerSchema.parse({ name: 'A', email: 'a@b.co', password: 'short' })).toThrow();
    expect(
      registerSchema.parse({ name: 'A', email: 'a@b.co', password: 'longenough1' }).email,
    ).toBe('a@b.co');
  });
});
