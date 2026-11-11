import { Injectable } from '@nestjs/common';
import { Client } from 'ssh2';
import {
  LIMITS,
  type CreateTunnelInput,
  type TunnelDto,
  type TunnelStatus,
  type UpdateTunnelInput,
} from '@upkeep/core';
import { PrismaService } from '../../shared/prisma.service.js';
import { decryptSecret, encryptSecret, sha256Hex } from '../../shared/crypto.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import {
  buildCanonicalConfig,
  parseSignedUrlExpiry,
  type CanonicalTunnelConfig,
} from '../../worker-core/credentials.js';
import { CredentialResolver } from '../../worker-core/credential-resolver.js';

type TunnelRow = {
  id: string;
  name: string;
  type: 'SSH' | 'OPENVPN';
  credentialSource: 'INLINE' | 'SIGNED_URL';
  credentialProvider: 'AWS_S3' | 'GCP_CS' | null;
  credentialExpiresAt: Date | null;
  configCipher: string;
  fingerprint: string;
  status: TunnelStatus;
  lastError: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
};

export function toTunnelDto(row: TunnelRow): TunnelDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    credentialSource: row.credentialSource,
    credentialProvider: row.credentialProvider,
    credentialExpiresAt: row.credentialExpiresAt?.toISOString() ?? null,
    fingerprint: row.fingerprint,
    status: row.status,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface TunnelTestResult {
  ok: boolean;
  message: string;
  credentialExpiresAt: string | null;
}

@Injectable()
export class TunnelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CredentialResolver,
  ) {}

  async create(userId: string, input: CreateTunnelInput): Promise<TunnelDto> {
    const count = await this.prisma.tunnel.count({ where: { userId } });
    if (count >= LIMITS.tunnelsPerUser) {
      throw new ConflictError(`Tunnel limit reached (${LIMITS.tunnelsPerUser})`);
    }

    const canonical = buildCanonicalConfig(input);
    const expires =
      canonical.signedUrl !== undefined && input.credentialSource === 'SIGNED_URL'
        ? parseSignedUrlExpiry(canonical.signedUrl.url, canonical.signedUrl.provider)
        : null;

    const row = await this.prisma.tunnel.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        credentialSource: input.credentialSource,
        ...(input.credentialSource === 'SIGNED_URL'
          ? { credentialProvider: input.signedUrl.provider }
          : {}),
        configCipher: encryptSecret(JSON.stringify(canonical)),
        ...(expires !== null ? { credentialExpiresAt: expires } : {}),
        fingerprint: sha256Hex(JSON.stringify(canonical)).slice(0, 16),
      },
    });
    return toTunnelDto(row);
  }

  async list(userId: string): Promise<TunnelDto[]> {
    const rows = await this.prisma.tunnel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTunnelDto);
  }

  async get(userId: string, id: string): Promise<TunnelDto> {
    const row = await this.prisma.tunnel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Tunnel');
    return toTunnelDto(row);
  }

  async update(userId: string, id: string, input: UpdateTunnelInput): Promise<TunnelDto> {
    const row = await this.prisma.tunnel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Tunnel');

    let canonical: CanonicalTunnelConfig;
    try {
      canonical = JSON.parse(decryptSecret(row.configCipher)) as CanonicalTunnelConfig;
    } catch {
      throw new ValidationError([{ path: 'config', message: 'stored config unreadable' }]);
    }

    // Apply rotations/material updates onto the canonical config.
    if (canonical.type === 'SSH') {
      if (input.ssh !== undefined) {
        canonical.ssh = { ...canonical.ssh, ...input.ssh };
      }
      if (input.privateKey !== undefined) {
        canonical.privateKey = input.privateKey;
        delete canonical.signedUrl;
      }
      if (input.signedUrl !== undefined) {
        canonical.signedUrl = input.signedUrl;
        delete canonical.privateKey;
      }
    } else {
      if (input.openvpnConfig !== undefined) {
        canonical.openvpnConfig = input.openvpnConfig;
        delete canonical.signedUrl;
      }
      if (input.signedUrl !== undefined) {
        canonical.signedUrl = input.signedUrl;
        delete canonical.openvpnConfig;
      }
    }

    const nowSigned = canonical.signedUrl;
    const credentialSource: 'INLINE' | 'SIGNED_URL' =
      nowSigned !== undefined ? 'SIGNED_URL' : 'INLINE';
    const expires =
      nowSigned !== undefined ? parseSignedUrlExpiry(nowSigned.url, nowSigned.provider) : null;

    const updated = await this.prisma.tunnel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        credentialSource,
        credentialProvider: nowSigned?.provider ?? null,
        configCipher: encryptSecret(JSON.stringify(canonical)),
        credentialExpiresAt: expires,
        fingerprint: sha256Hex(JSON.stringify(canonical)).slice(0, 16),
        status: 'UNKNOWN',
        lastError: null,
      },
    });
    return toTunnelDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.tunnel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Tunnel');
    await this.prisma.tunnel.delete({ where: { id } }); // monitors detach via SetNull
  }

  /**
   * Connectivity probe (sanitized output — never key material).
   * SSH: full handshake with the stored/fetched key, then immediate close.
   * OpenVPN: fetch/decrypt + sanitize the config (a real VPN bring-up happens
   * only on the privileged worker when a check runs).
   */
  async test(userId: string, id: string): Promise<TunnelTestResult> {
    const row = await this.prisma.tunnel.findFirst({ where: { id, userId } });
    if (row === null) throw new NotFoundError('Tunnel');

    if (row.type === 'OPENVPN') {
      try {
        const config = await this.resolver.resolveOpenVpnConfig(row);
        if (!/^(client|dev |proto |remote )/m.test(config)) {
          throw new Error('fetched file is not an OpenVPN client config');
        }
        await this.prisma.tunnel.update({
          where: { id },
          data: { status: 'UNKNOWN', lastError: null },
        });
        return {
          ok: true,
          message: 'credential loaded and parsed successfully',
          credentialExpiresAt: row.credentialExpiresAt?.toISOString() ?? null,
        };
      } catch (err) {
        const message = (err as Error).message;
        await this.prisma.tunnel.update({
          where: { id },
          data: { status: 'FAILED', lastError: message, lastErrorAt: new Date() },
        });
        return {
          ok: false,
          message,
          credentialExpiresAt: row.credentialExpiresAt?.toISOString() ?? null,
        };
      }
    }

    // SSH: resolve credential then perform a real handshake.
    try {
      const creds = await this.resolver.resolveSsh(row);
      await this.sshHandshake(
        creds.host,
        creds.port,
        creds.username,
        creds.privateKey,
        creds.passphrase,
      );
      await this.prisma.tunnel.update({
        where: { id },
        data: { status: 'CONNECTED', lastError: null },
      });
      return {
        ok: true,
        message: `authenticated as ${creds.username}@${creds.host}:${creds.port}`,
        credentialExpiresAt: row.credentialExpiresAt?.toISOString() ?? null,
      };
    } catch (err) {
      const message = (err as Error).message;
      await this.prisma.tunnel.update({
        where: { id },
        data: { status: 'FAILED', lastError: message, lastErrorAt: new Date() },
      });
      return {
        ok: false,
        message,
        credentialExpiresAt: row.credentialExpiresAt?.toISOString() ?? null,
      };
    }
  }

  private sshHandshake(
    host: string,
    port: number,
    username: string,
    privateKey: string,
    passphrase?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const timer = setTimeout(() => {
        client.end();
        reject(new Error('connection timed out'));
      }, 12_000);
      client.once('ready', () => {
        clearTimeout(timer);
        client.end();
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      client.connect({
        host,
        port,
        username,
        privateKey,
        ...(passphrase !== undefined ? { passphrase } : {}),
        readyTimeout: 12_000,
      });
    });
  }

  /** Expired-URL sweep used by the maintenance job. */
  async sweepExpirations(): Promise<number> {
    const expired = await this.prisma.tunnel.findMany({
      where: {
        credentialSource: 'SIGNED_URL',
        status: { not: 'EXPIRED' },
        credentialExpiresAt: { lt: new Date() },
      },
      select: { id: true },
    });
    if (expired.length === 0) return 0;
    await this.prisma.tunnel.updateMany({
      where: { id: { in: expired.map((t) => t.id) } },
      data: { status: 'EXPIRED', lastError: 'signed URL expired — rotate to restore tunneling' },
    });
    return expired.length;
  }
}
