import { Injectable } from '@nestjs/common';
import { decryptSecret } from '../shared/crypto.js';
import { type CanonicalTunnelConfig, remoteCredentialProviders } from './credentials.js';

/** Raised when a tunnel's credential cannot be loaded; message is sanitized. */
export class CredentialError extends Error {}

/** The tunnel fields the engine needs (subset of the Prisma row). */
export interface TunnelCoreRow {
  id: string;
  name: string;
  type: 'SSH' | 'OPENVPN';
  credentialSource: 'INLINE' | 'SIGNED_URL';
  credentialProvider: 'AWS_S3' | 'GCP_CS' | null;
  configCipher: string;
  credentialExpiresAt: Date | null;
  status: 'UNKNOWN' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'EXPIRED' | 'FAILED';
}

/**
 * Resolves credential material for a tunnel.
 * INLINE → decrypt the stored blob.
 * SIGNED_URL → decrypt the URL pointer, fetch material from the customer's
 * object store (in memory only — nothing is ever written to disk or DB).
 */
@Injectable()
export class CredentialResolver {
  private canonical(tunnel: TunnelCoreRow): CanonicalTunnelConfig {
    let cfg: CanonicalTunnelConfig;
    try {
      cfg = JSON.parse(decryptSecret(tunnel.configCipher)) as CanonicalTunnelConfig;
    } catch {
      throw new CredentialError('stored tunnel configuration is unreadable');
    }
    if (cfg.type !== tunnel.type) {
      throw new CredentialError('stored tunnel configuration type mismatch');
    }
    return cfg;
  }

  async resolveSsh(tunnel: TunnelCoreRow): Promise<{
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
  }> {
    const cfg = this.canonical(tunnel);
    if (cfg.type !== 'SSH') throw new CredentialError('tunnel is not an SSH tunnel');
    let privateKey: string;
    if (cfg.signedUrl !== undefined) {
      if (tunnel.credentialProvider === null) {
        throw new CredentialError('signed URL tunnel is missing its provider');
      }
      const provider = remoteCredentialProviders[tunnel.credentialProvider];
      try {
        privateKey = await provider.fetchCredential(cfg.signedUrl.url);
      } catch (err) {
        throw new CredentialError(`credential fetch failed: ${(err as Error).message}`);
      }
    } else if (cfg.privateKey !== undefined) {
      privateKey = cfg.privateKey;
    } else {
      throw new CredentialError('SSH tunnel has no credential configured');
    }
    return {
      host: cfg.ssh.host,
      port: cfg.ssh.port,
      username: cfg.ssh.username,
      privateKey,
      ...(cfg.ssh.passphrase !== undefined ? { passphrase: cfg.ssh.passphrase } : {}),
    };
  }

  async resolveOpenVpnConfig(tunnel: TunnelCoreRow): Promise<string> {
    const cfg = this.canonical(tunnel);
    if (cfg.type !== 'OPENVPN') throw new CredentialError('tunnel is not an OpenVPN tunnel');
    if (cfg.signedUrl !== undefined) {
      if (tunnel.credentialProvider === null) {
        throw new CredentialError('signed URL tunnel is missing its provider');
      }
      const provider = remoteCredentialProviders[tunnel.credentialProvider];
      try {
        return await provider.fetchCredential(cfg.signedUrl.url);
      } catch (err) {
        throw new CredentialError(`credential fetch failed: ${(err as Error).message}`);
      }
    }
    if (cfg.openvpnConfig !== undefined) return cfg.openvpnConfig;
    throw new CredentialError('OpenVPN tunnel has no credential configured');
  }
}
