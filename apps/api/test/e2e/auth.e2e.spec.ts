/**
 * API e2e — runs against a real PostgreSQL + Redis (CI services or local).
 * Boot requirements are the same as production (env boot guard active).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';

let app: INestApplication;
let http: () => ReturnType<typeof request>;

const uniqueEmail = (): string =>
  `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@upkeep.test`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready', 'openapi.json'] });
  await app.init();
  http = (): ReturnType<typeof request> => request(app.getHttpServer());
});

afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('registers, returns tokens and sets cookies', async () => {
    const res = await http().post('/v1/auth/register').send({
      name: 'E2E',
      email: uniqueEmail(),
      password: 'super-secret-1',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((c) => c.startsWith('upkeep_at='))).toBe(true);
  });

  it('rejects weak passwords with the envelope error format', async () => {
    const res = await http().post('/v1/auth/register').send({
      name: 'E2E',
      email: uniqueEmail(),
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeTypeOf('string');
  });

  it('login → me → refresh rotates the refresh token', async () => {
    const email = uniqueEmail();
    await http().post('/v1/auth/register').send({ name: 'E2E', email, password: 'super-secret-1' });

    const login = await http().post('/v1/auth/login').send({ email, password: 'super-secret-1' });
    expect(login.status).toBe(201);
    const { accessToken, refreshToken } = login.body.data as {
      accessToken: string;
      refreshToken: string;
    };

    const me = await http().get('/v1/auth/me').set('authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const refreshed = await http().post('/v1/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(201);
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);

    // Reusing the old (rotated) token revokes the family.
    const replay = await http().post('/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const res = await http().get('/v1/monitors');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('monitors (validation + SSRF guard)', () => {
  let token: string;

  beforeAll(async () => {
    const email = uniqueEmail();
    const reg = await http()
      .post('/v1/auth/register')
      .send({ name: 'E2E', email, password: 'super-secret-1' });
    token = (reg.body.data as { accessToken: string }).accessToken;
  });

  it('creates an HTTP monitor and returns the detail DTO', async () => {
    const res = await http()
      .post('/v1/monitors')
      .set('authorization', `Bearer ${token}`)
      .send({ type: 'HTTP', name: 'pub', target: 'https://example.com', intervalSeconds: 60 });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('HTTP');
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.bindings).toEqual([]);
  });

  it('rejects private targets without a tunnel (SSRF guard)', async () => {
    const res = await http()
      .post('/v1/monitors')
      .set('authorization', `Bearer ${token}`)
      .send({
        type: 'HTTP',
        name: 'meta',
        target: 'http://169.254.169.254/latest',
        intervalSeconds: 60,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details?.[0]?.path).toBe('target');
  });

  it('rejects invalid intervals', async () => {
    const res = await http()
      .post('/v1/monitors')
      .set('authorization', `Bearer ${token}`)
      .send({ type: 'HTTP', name: 'x', target: 'https://example.com', intervalSeconds: 45 });
    expect(res.status).toBe(400);
  });
});

describe('tunnels (credential modes)', () => {
  let token: string;

  beforeAll(async () => {
    const email = uniqueEmail();
    const reg = await http()
      .post('/v1/auth/register')
      .send({ name: 'E2E', email, password: 'super-secret-1' });
    token = (reg.body.data as { accessToken: string }).accessToken;
  });

  it('stores INLINE SSH tunnels encrypted and returns sanitized DTOs', async () => {
    const key = `-----BEGIN OPENSSH PRIVATE KEY-----\n${'e'.repeat(120)}\n-----END OPENSSH PRIVATE KEY-----\n`;
    const res = await http()
      .post('/v1/tunnels')
      .set('authorization', `Bearer ${token}`)
      .send({
        type: 'SSH',
        name: 'bastion',
        credentialSource: 'INLINE',
        ssh: { host: 'bastion.example.com', username: 'deploy' },
        privateKey: key,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.credentialSource).toBe('INLINE');
    // Sanitization: no key material anywhere in the payload.
    expect(JSON.stringify(res.body)).not.toContain('BEGIN OPENSSH');
  });

  it('parses signed-URL expiry for SIGNED_URL tunnels (AWS + GCP formats)', async () => {
    const awsUrl = `https://bucket.s3.us-east-1.amazonaws.com/key.pem?X-Amz-Date=20261112T000000Z&X-Amz-Expires=3600&X-Amz-Signature=abc`;
    const gcpUrl = `https://storage.googleapis.com/bucket/key.pem?X-Goog-Date=20261112T010000Z&X-Goog-Expires=7200&X-Goog-Signature=def`;

    const aws = await http()
      .post('/v1/tunnels')
      .set('authorization', `Bearer ${token}`)
      .send({
        type: 'SSH',
        name: 'aws-url-tunnel',
        credentialSource: 'SIGNED_URL',
        ssh: { host: 'bastion.example.com', username: 'deploy' },
        signedUrl: { provider: 'AWS_S3', url: awsUrl },
      });
    expect(aws.status).toBe(201);
    const awsExpiry = new Date(aws.body.data.credentialExpiresAt as string);
    expect(awsExpiry.toISOString()).toBe('2026-11-12T01:00:00.000Z');

    const gcp = await http()
      .post('/v1/tunnels')
      .set('authorization', `Bearer ${token}`)
      .send({
        type: 'OPENVPN',
        name: 'gcp-url-tunnel',
        credentialSource: 'SIGNED_URL',
        signedUrl: { provider: 'GCP_CS', url: gcpUrl },
      });
    expect(gcp.status).toBe(201);
    const gcpExpiry = new Date(gcp.body.data.credentialExpiresAt as string);
    expect(gcpExpiry.toISOString()).toBe('2026-11-12T03:00:00.000Z');
  });

  it('rejects OpenVPN configs with dangerous directives (RCE guard)', async () => {
    const res = await http().post('/v1/tunnels').set('authorization', `Bearer ${token}`).send({
      type: 'OPENVPN',
      name: 'evil',
      credentialSource: 'INLINE',
      openvpnConfig:
        'client\ndev tun\nremote vpn.example.com 1194\nup /tmp/evil.sh\nscript-security 2\n',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('disallowed directives');
  });
});

describe('health', () => {
  it('liveness and readiness report ok', async () => {
    expect((await http().get('/health/live')).status).toBe(200);
    const ready = await http().get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.checks).toEqual({ database: true, redis: true });
  });
});
