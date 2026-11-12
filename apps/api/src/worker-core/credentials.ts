import { isIP } from 'node:net';
import { env } from '../config/env.js';
import type { CreateTunnelInput } from '@upkeep/core';

/**
 * Canonical (pre-encryption) tunnel configuration — what actually gets
 * AES-GCM-encrypted into Tunnel.configCipher. SIGNED_URL tunnels store ONLY
 * the URL pointer; the material itself is fetched at connect time and kept in
 * memory (zero persistence — PLAN §8.1).
 */
export interface CanonicalSshConfig {
  type: 'SSH';
  ssh: { host: string; port: number; username: string; passphrase?: string };
  privateKey?: string;
  signedUrl?: { provider: 'AWS_S3' | 'GCP_CS'; url: string };
}

export interface CanonicalOpenVpnConfig {
  type: 'OPENVPN';
  openvpnConfig?: string;
  signedUrl?: { provider: 'AWS_S3' | 'GCP_CS'; url: string };
}

export type CanonicalTunnelConfig = CanonicalSshConfig | CanonicalOpenVpnConfig;

export function buildCanonicalConfig(input: CreateTunnelInput): CanonicalTunnelConfig {
  if (input.type === 'SSH') {
    return {
      type: 'SSH',
      ssh: {
        host: input.ssh.host,
        port: input.ssh.port,
        username: input.ssh.username,
        ...(input.ssh.passphrase !== undefined ? { passphrase: input.ssh.passphrase } : {}),
      },
      ...(input.credentialSource === 'INLINE' ? { privateKey: input.privateKey } : {}),
      ...(input.credentialSource === 'SIGNED_URL' ? { signedUrl: input.signedUrl } : {}),
    };
  }
  return {
    type: 'OPENVPN',
    ...(input.credentialSource === 'INLINE' ? { openvpnConfig: input.openvpnConfig } : {}),
    ...(input.credentialSource === 'SIGNED_URL' ? { signedUrl: input.signedUrl } : {}),
  };
}

// ─── Signed URL expiry parsing ───────────────────────────────────────────────

/** AWS: 20261112T083000Z; GCP: same basic-ISO shape. */
function parseBasicIso(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (m === null) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

export function parseSignedUrlExpiry(url: string, provider: 'AWS_S3' | 'GCP_CS'): Date | null {
  const params = new URL(url).searchParams;
  const dateParam = provider === 'AWS_S3' ? 'X-Amz-Date' : 'X-Goog-Date';
  const expiresParam = provider === 'AWS_S3' ? 'X-Amz-Expires' : 'X-Goog-Expires';
  const date = parseBasicIso(params.get(dateParam) ?? '');
  const seconds = Number(params.get(expiresParam));
  if (date === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(date.getTime() + seconds * 1000);
}

// ─── Fetch guardrails (PLAN §8.1) ────────────────────────────────────────────

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export function isPrivateHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') return true;
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (isIP(bare) === 6) {
    const lower = bare.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    );
  }
  if (isIP(bare) === 4) {
    return PRIVATE_V4.some((re) => re.test(bare));
  }
  return false;
}

function hostAllowed(hostname: string): boolean {
  if (isPrivateHostname(hostname)) return false;
  const allowlist = env.CREDENTIAL_HOST_ALLOWLIST?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist === undefined || allowlist.length === 0) return true;
  return allowlist.includes(hostname);
}

export interface RemoteCredentialProvider {
  readonly id: 'AWS_S3' | 'GCP_CS';
  readonly label: string;
  parseExpiry(url: string): Date | null;
  fetchCredential(url: string): Promise<string>;
}

/**
 * Shared HTTPS fetch with the guardrails from the plan: HTTPS-only, optional
 * host allowlist, size cap, timeout, no-redirect-to-private (SSRF guard) and
 * content sniffing (must look like a private key or an OpenVPN config).
 */
class HttpsSignedUrlProvider implements RemoteCredentialProvider {
  constructor(
    readonly id: 'AWS_S3' | 'GCP_CS',
    readonly label: string,
  ) {}

  parseExpiry(url: string): Date | null {
    return parseSignedUrlExpiry(url, this.id);
  }

  async fetchCredential(url: string): Promise<string> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('signed URL must use HTTPS');
    }
    if (!hostAllowed(parsed.hostname)) {
      throw new Error('signed URL host is not allowed');
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(env.CREDENTIAL_FETCH_TIMEOUT_MS),
      redirect: 'follow',
      headers: { 'user-agent': 'Upkeep-TunnelWorker/1.0' },
    });
    if (!res.ok) {
      throw new Error(`credential source returned HTTP ${res.status}`);
    }
    if (res.url.length > 0 && res.url !== url && !hostAllowed(new URL(res.url).hostname)) {
      throw new Error('credential source redirected to a disallowed host');
    }
    const lengthHeader = res.headers.get('content-length');
    if (lengthHeader !== null && Number(lengthHeader) > env.CREDENTIAL_FETCH_MAX_BYTES) {
      throw new Error('credential file exceeds size cap');
    }
    const material = await res.text();
    if (material.length > env.CREDENTIAL_FETCH_MAX_BYTES) {
      throw new Error('credential file exceeds size cap');
    }
    if (!looksLikeCredential(material)) {
      throw new Error('fetched file does not look like an SSH private key or OpenVPN config');
    }
    return material;
  }
}

export function looksLikeCredential(material: string): boolean {
  return material.includes('PRIVATE KEY') || /^(client|dev |proto |remote )/m.test(material);
}

export const awsS3PresignedProvider: RemoteCredentialProvider = new HttpsSignedUrlProvider(
  'AWS_S3',
  'AWS S3 presigned URL',
);
export const gcpSignedUrlProvider: RemoteCredentialProvider = new HttpsSignedUrlProvider(
  'GCP_CS',
  'GCP Cloud Storage signed URL',
);

export const remoteCredentialProviders: Record<'AWS_S3' | 'GCP_CS', RemoteCredentialProvider> = {
  AWS_S3: awsS3PresignedProvider,
  GCP_CS: gcpSignedUrlProvider,
};
