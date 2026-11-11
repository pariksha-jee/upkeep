import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { connect as netConnect, type Socket } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { randomInt } from 'node:crypto';
import { sanitizeOpenVpnConfig } from '@upkeep/core';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { CredentialError, CredentialResolver, type TunnelCoreRow } from './credential-resolver.js';

type TunnelRow = TunnelCoreRow;

const execFileAsync = promisify(execFile);
const CONNECT_TIMEOUT_MS = 30_000;
const VPN_IDLE_MS = 300_000;

/**
 * OpenVPN manager (PLAN §8.3) — runs ONLY on the privileged tunnel worker
 * (openvpn + iproute2, NET_ADMIN, /dev/net/tun).
 *
 * Per tunnel: one openvpn process with a named tun device (upkeepT<id>),
 * `--route-nopull` so the default route is never hijacked, controlled through
 * its management socket. Monitored targets get explicit /32 routes through the
 * tun device; everything else (DB, Redis, outbound APIs) keeps the primary
 * interface. Configs are sanitized (core allowlist) before touching disk.
 */

interface VpnEntry {
  tunnelId: string;
  proc: ChildProcess;
  devName: string;
  configPath: string;
  mgmtPort: number;
  state: 'connecting' | 'connected' | 'failed';
  routes: Set<string>; // "ip/32" entries installed
  lastUsedAt: number;
}

export class OpenVpnUnavailableError extends Error {}

@Injectable()
export class OpenVpnManager implements OnModuleDestroy {
  private readonly entries = new Map<string, VpnEntry>();
  private reaper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CredentialResolver,
  ) {}

  /**
   * Ensure the VPN for this tunnel is up and `targetHost` is routed through
   * it. Resolves when the route is installed.
   */
  async ensureRoute(tunnel: TunnelRow, targetHost: string): Promise<void> {
    const entry = this.entries.get(tunnel.id);
    const vpn =
      entry !== undefined && (entry.state === 'connected' || entry.state === 'connecting')
        ? entry
        : await this.start(tunnel);

    if (vpn.state !== 'connected') {
      await this.waitForConnected(vpn);
    }
    vpn.lastUsedAt = Date.now();

    const { address } = await lookup(targetHost).catch(() => {
      throw new OpenVpnUnavailableError(`cannot resolve target host ${targetHost}`);
    });
    const route = `${address}/32`;
    if (vpn.routes.has(route)) return;
    await execFileAsync('ip', ['route', 'replace', route, 'dev', vpn.devName]).catch((err) => {
      throw new OpenVpnUnavailableError(`route install failed: ${(err as Error).message}`);
    });
    vpn.routes.add(route);
    logger.debug({ tunnelId: tunnel.id, route }, 'VPN route installed');
  }

  private async start(tunnel: TunnelRow): Promise<VpnEntry> {
    if (
      tunnel.credentialSource === 'SIGNED_URL' &&
      tunnel.credentialExpiresAt !== null &&
      tunnel.credentialExpiresAt < new Date()
    ) {
      await this.markTunnel(
        tunnel.id,
        'EXPIRED',
        'signed URL expired — rotate it on the tunnel page',
      );
      throw new CredentialError('tunnel credential (signed URL) has expired');
    }

    let rawConfig: string;
    try {
      rawConfig = await this.resolver.resolveOpenVpnConfig(tunnel);
    } catch (err) {
      await this.markTunnel(
        tunnel.id,
        tunnel.credentialSource === 'SIGNED_URL' ? 'EXPIRED' : 'FAILED',
        (err as Error).message,
      );
      throw err;
    }
    // Defense in depth: strip anything outside the allowlist before disk.
    const { sanitized } = sanitizeOpenVpnConfig(rawConfig);

    const devName = `upkeepT${tunnel.id.replace(/-/g, '').slice(0, 10)}`;
    const configPath = join(tmpdir(), `upkeep-ovpn-${tunnel.id}.conf`);
    await writeFile(configPath, sanitized, { mode: 0o600 });
    const mgmtPort = randomInt(20000, 40000);

    await this.markTunnel(tunnel.id, 'CONNECTING', null);
    const proc = spawn(
      'openvpn',
      [
        '--config',
        configPath,
        '--dev',
        devName,
        '--dev-type',
        'tun',
        '--route-nopull',
        // openvpn LISTENS on the management port; we connect as the client.
        '--management',
        '127.0.0.1',
        String(mgmtPort),
        '--verb',
        '1',
      ],
      { stdio: 'ignore', detached: false },
    );

    const entry: VpnEntry = {
      tunnelId: tunnel.id,
      proc,
      devName,
      configPath,
      mgmtPort,
      state: 'connecting',
      routes: new Set(),
      lastUsedAt: Date.now(),
    };
    this.entries.set(tunnel.id, entry);

    // The management interface listens on our behalf; connect to track state.
    void this.observeManagement(entry, tunnel);

    proc.once('exit', (code) => {
      this.entries.delete(tunnel.id);
      void this.cleanupRoutes(entry);
      void rm(configPath, { force: true });
      if (entry.state !== 'failed') {
        void this.markTunnel(tunnel.id, 'DEGRADED', `openvpn exited (code ${code ?? 'signal'})`);
      }
    });

    this.startReaper();
    return entry;
  }

  /** Subscribe to management state events; also acts as the mgmt socket server. */
  private async observeManagement(entry: VpnEntry, tunnel: TunnelRow): Promise<void> {
    try {
      const sock = await this.connectMgmt(entry.mgmtPort);
      sock.on('data', (buf: Buffer) => {
        const text = buf.toString('utf8');
        for (const line of text.split('\n')) {
          if (!line.startsWith('>STATE:')) continue;
          const parts = line.slice(7).trim().split(',');
          const state = parts[1] ?? '';
          if (state === 'CONNECTED') {
            entry.state = 'connected';
            void this.markTunnel(tunnel.id, 'CONNECTED', null);
            logger.info({ tunnelId: tunnel.id }, 'OpenVPN connected');
          } else if (state === 'RECONNECTING') {
            entry.state = 'connecting';
          } else if (state === 'EXITING') {
            entry.state = 'failed';
            void this.markTunnel(
              tunnel.id,
              'FAILED',
              `openvpn exiting: ${parts[2] ?? 'unknown reason'}`,
            );
          }
        }
      });
      sock.on('close', () => sock.destroy());
      sock.write('state on\nverb 0\n');
    } catch (err) {
      entry.state = 'failed';
      void this.markTunnel(
        tunnel.id,
        'FAILED',
        `management interface failed: ${(err as Error).message}`,
      );
    }
  }

  private connectMgmt(port: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const sock = netConnect({ host: '127.0.0.1', port }, () => resolve(sock));
      sock.once('error', reject);
      setTimeout(() => reject(new Error('management socket connect timeout')), 5_000).unref();
    });
  }

  private waitForConnected(entry: VpnEntry): Promise<void> {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const tick = (): void => {
        if (entry.state === 'connected') {
          resolve();
          return;
        }
        if (entry.state === 'failed' || !this.entries.has(entry.tunnelId)) {
          reject(new OpenVpnUnavailableError('VPN failed to connect'));
          return;
        }
        if (Date.now() > deadline) {
          reject(new OpenVpnUnavailableError('VPN connection timed out'));
          return;
        }
        setTimeout(tick, 500);
      };
      tick();
    });
  }

  private async cleanupRoutes(entry: VpnEntry): Promise<void> {
    for (const route of entry.routes) {
      await execFileAsync('ip', ['route', 'del', route]).catch(() => undefined);
    }
    entry.routes.clear();
  }

  private startReaper(): void {
    if (this.reaper !== null) return;
    this.reaper = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.entries) {
        if (now - entry.lastUsedAt > VPN_IDLE_MS) {
          logger.info({ tunnelId: id }, 'VPN idle — stopping');
          entry.proc.kill('SIGTERM');
        }
      }
    }, 60_000);
    this.reaper.unref();
  }

  private async markTunnel(
    id: string,
    status: TunnelRow['status'],
    error: string | null,
  ): Promise<void> {
    await this.prisma.tunnel
      .update({
        where: { id },
        data: {
          status,
          lastError: error,
          ...(error !== null ? { lastErrorAt: new Date() } : {}),
        },
      })
      .catch((err: unknown) => {
        logger.warn({ err, tunnelId: id }, 'failed to update tunnel status');
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reaper !== null) clearInterval(this.reaper);
    for (const entry of this.entries.values()) {
      await this.cleanupRoutes(entry);
      entry.proc.kill('SIGTERM');
      await rm(entry.configPath, { force: true }).catch(() => undefined);
    }
    this.entries.clear();
  }
}
