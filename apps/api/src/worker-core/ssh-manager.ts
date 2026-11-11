import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createServer, type Server, type Socket } from 'node:net';
import { Client } from 'ssh2';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { CredentialError, CredentialResolver, type TunnelCoreRow } from './credential-resolver.js';

type TunnelRow = TunnelCoreRow;

/**
 * SSH tunnel manager (PLAN §8.2).
 *
 * One ssh2 Client per tunnel; one local TCP listener per (tunnel, target
 * host, port) forward — monitors on the same tunnel with different targets
 * each get their own listener on an OS-assigned local port. Idle listeners
 * are reaped after FORWARD_IDLE_MS; clients disconnect once all their
 * forwards are gone. Errors update Tunnel.status for the UI.
 */

const FORWARD_IDLE_MS = 120_000;
const READY_TIMEOUT_MS = 15_000;

interface ClientEntry {
  client: Client;
  tunnelId: string;
  healthy: boolean;
  forwards: Set<string>; // forward keys using this client
}

interface ForwardEntry {
  server: Server;
  port: number;
  tunnelId: string;
  targetHost: string;
  targetPort: number;
  lastUsedAt: number;
}

export class TunnelUnavailableError extends Error {}

@Injectable()
export class SshTunnelManager implements OnModuleDestroy {
  private readonly clients = new Map<string, ClientEntry>();
  private readonly forwards = new Map<string, ForwardEntry>();
  private reaper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CredentialResolver,
  ) {}

  /**
   * Ensure a healthy local forward to `host:port` through the tunnel.
   * Returns the local port to connect to.
   */
  async ensureForward(tunnel: TunnelRow, host: string, port: number): Promise<number> {
    const key = this.forwardKey(tunnel.id, host, port);
    const existing = this.forwards.get(key);
    if (existing !== undefined && existing.server.listening) {
      existing.lastUsedAt = Date.now();
      return existing.port;
    }

    const entry = await this.ensureClient(tunnel);
    const server = createServer((sock: Socket) => {
      entry.client.forwardOut('127.0.0.1', 0, host, port, (err, stream) => {
        if (err !== null && err !== undefined) {
          sock.destroy();
          return;
        }
        stream.pipe(sock);
        sock.pipe(stream);
        sock.on('error', () => stream.destroy());
        stream.on('error', () => sock.destroy());
      });
    });

    const listening = await new Promise<{ ok: boolean; port: number }>((resolve) => {
      server.once('error', () => resolve({ ok: false, port: 0 }));
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        resolve({
          ok: typeof addr === 'object' && addr !== null,
          port: typeof addr === 'object' && addr !== null ? addr.port : 0,
        });
      });
    });
    if (!listening.ok) {
      server.close();
      throw new TunnelUnavailableError('could not bind a local forward port');
    }

    this.forwards.set(key, {
      server,
      port: listening.port,
      tunnelId: tunnel.id,
      targetHost: host,
      targetPort: port,
      lastUsedAt: Date.now(),
    });
    return listening.port;
  }

  private async ensureClient(tunnel: TunnelRow): Promise<ClientEntry> {
    const existing = this.clients.get(tunnel.id);
    if (existing !== undefined && existing.healthy) return existing;

    let creds;
    try {
      creds = await this.resolver.resolveSsh(tunnel);
    } catch (err) {
      await this.markTunnel(
        tunnel.id,
        tunnel.credentialSource === 'SIGNED_URL' ? 'EXPIRED' : 'FAILED',
        (err as Error).message,
      );
      throw err instanceof CredentialError ? err : new CredentialError((err as Error).message);
    }

    await this.markTunnel(tunnel.id, 'CONNECTING', null);
    const client = new Client();
    const entry: ClientEntry = { client, tunnelId: tunnel.id, healthy: false, forwards: new Set() };

    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new TunnelUnavailableError('SSH connection timed out')),
        READY_TIMEOUT_MS,
      );
      client.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timer);
        reject(new TunnelUnavailableError(`SSH connection failed: ${err.message}`));
      });
    });

    client.connect({
      host: creds.host,
      port: creds.port,
      username: creds.username,
      privateKey: creds.privateKey,
      ...(creds.passphrase !== undefined ? { passphrase: creds.passphrase } : {}),
      readyTimeout: READY_TIMEOUT_MS,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
    });

    try {
      await ready;
    } catch (err) {
      client.end();
      await this.markTunnel(tunnel.id, 'FAILED', (err as Error).message);
      throw err;
    }

    entry.healthy = true;
    this.clients.set(tunnel.id, entry);
    await this.markTunnel(tunnel.id, 'CONNECTED', null);
    logger.debug({ tunnelId: tunnel.id }, 'SSH tunnel connected');

    client.once('close', () => this.handleClientDown(entry, 'SSH connection closed'));
    client.once('error', (err) => this.handleClientDown(entry, err.message));
    this.startReaper();
    return entry;
  }

  private handleClientDown(entry: ClientEntry, reason: string): void {
    this.clients.delete(entry.tunnelId);
    for (const key of [...entry.forwards]) {
      this.closeForward(key);
    }
    void this.markTunnel(entry.tunnelId, 'DEGRADED', reason);
    logger.warn({ tunnelId: entry.tunnelId, reason }, 'SSH tunnel went down');
  }

  private forwardKey(tunnelId: string, host: string, port: number): string {
    return `${tunnelId}|${host}|${port}`;
  }

  private closeForward(key: string): void {
    const f = this.forwards.get(key);
    if (f === undefined) return;
    f.server.close();
    this.forwards.delete(key);
    const client = this.clients.get(f.tunnelId);
    if (client !== undefined) {
      client.forwards.delete(key);
      if (client.forwards.size === 0 && !client.healthy) {
        client.client.end();
        this.clients.delete(f.tunnelId);
      }
    }
  }

  private startReaper(): void {
    if (this.reaper !== null) return;
    this.reaper = setInterval(() => {
      const now = Date.now();
      for (const [key, f] of this.forwards) {
        if (now - f.lastUsedAt > FORWARD_IDLE_MS) this.closeForward(key);
      }
    }, 30_000);
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
        data: { status, lastError: error, lastErrorAt: error !== null ? new Date() : undefined },
      })
      .catch((err: unknown) => {
        logger.warn({ err, tunnelId: id }, 'failed to update tunnel status');
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reaper !== null) clearInterval(this.reaper);
    for (const key of [...this.forwards.keys()]) this.closeForward(key);
    for (const entry of this.clients.values()) entry.client.end();
    this.clients.clear();
  }
}
