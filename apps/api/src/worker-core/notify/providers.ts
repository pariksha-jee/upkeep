import { env, features } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { signWebhookPayload } from '../../shared/crypto.js';
import { isPrivateHostnameLiteral } from '@upkeep/core';
import type { NotifyContext } from './templates.js';
import { messageBody, messageTitle, webhookPayload } from './templates.js';

export interface SendResult {
  ok: boolean;
  error?: string;
}

// ─── Email (SMTP via nodemailer, lazy) ───────────────────────────────────────

let transporter: { sendMail(opts: Record<string, unknown>): Promise<unknown> } | null = null;

async function emailProvider(to: string, ctx: NotifyContext): Promise<SendResult> {
  if (!features.email) return { ok: false, error: 'SMTP is not configured on this server' };
  try {
    if (transporter === null) {
      const nodemailer = await import('nodemailer');
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST ?? '',
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        ...(env.SMTP_USER !== undefined
          ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } }
          : {}),
      });
    }
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: messageTitle(ctx),
      text: messageBody(ctx),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── SMS (Twilio, lazy) ──────────────────────────────────────────────────────

interface TwilioLike {
  messages: { create(args: { to: string; from: string; body: string }): Promise<unknown> };
}

async function smsProvider(to: string, ctx: NotifyContext): Promise<SendResult> {
  if (!features.sms) return { ok: false, error: 'Twilio is not configured on this server' };
  try {
    const mod = (await import('twilio')) as unknown as {
      default?: new (sid: string, token: string) => TwilioLike;
    };
    const TwilioCtor = mod.default;
    if (TwilioCtor === undefined) throw new Error('twilio SDK unavailable');
    const client = new TwilioCtor(env.TWILIO_ACCOUNT_SID ?? '', env.TWILIO_AUTH_TOKEN ?? '');
    await client.messages.create({
      to,
      from: env.TWILIO_FROM ?? '',
      body: `${messageTitle(ctx)}\n${messageBody(ctx)}`.slice(0, 480),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Webhook (HMAC-signed POST, per-hop SSRF guard, retries) ────────────────

const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_RETRIES = 3;

async function webhookProvider(
  url: string,
  secret: string | null,
  ctx: NotifyContext,
): Promise<SendResult> {
  const payload = JSON.stringify(webhookPayload(ctx));
  let lastError = 'unknown error';

  for (let attempt = 0; attempt < WEBHOOK_RETRIES; attempt++) {
    try {
      const current = url;
      // Per-hop guard: refuse private targets unless explicitly allowed.
      const hostname = new URL(current).hostname;
      if (!env.WEBHOOK_ALLOW_PRIVATE && isPrivateHostnameLiteral(hostname)) {
        return { ok: false, error: 'webhook host is a private address' };
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'Upkeep-Webhook/1.0',
        'x-upkeep-timestamp': String(timestamp),
      };
      if (secret !== null) {
        headers['x-upkeep-signature'] = `v1=${signWebhookPayload(secret, timestamp, payload)}`;
      }
      const res = await fetch(current, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        // Strict v1: webhook receivers must be final endpoints (no redirect
        // following → no redirect-based SSRF). Host checked above per attempt.
        redirect: 'error',
      });
      if (res.status >= 200 && res.status < 300) return { ok: true };
      lastError = `HTTP ${res.status}`;
      // 4xx (except 429) will not get better with retries.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = (err as Error).message;
    }
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
  }
  return { ok: false, error: lastError };
}

// ─── Push (FCM via firebase-admin, lazy) ─────────────────────────────────────

interface FcmMessage {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: { priority: 'high' };
}

let fcmMessaging: { sendEach(messages: FcmMessage[]): Promise<unknown> } | null = null;

async function pushProvider(tokens: string[], ctx: NotifyContext): Promise<SendResult> {
  if (!features.push) return { ok: false, error: 'FCM is not configured on this server' };
  if (tokens.length === 0) return { ok: true };
  try {
    if (fcmMessaging === null) {
      const mod = (await import('firebase-admin')) as unknown as {
        default?: {
          initializeApp(opts: unknown, name: string): unknown;
          credential: { cert(c: unknown): unknown };
          messaging(app?: unknown): { sendEach(messages: FcmMessage[]): Promise<unknown> };
        };
      };
      const admin = mod.default;
      if (admin === undefined) throw new Error('firebase-admin SDK unavailable');
      const app = admin.initializeApp(
        {
          credential: admin.credential.cert({
            projectId: env.FCM_PROJECT_ID,
            clientEmail: env.FCM_CLIENT_EMAIL,
            privateKey: env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
          }),
        },
        'upkeep-notify',
      );
      fcmMessaging = admin.messaging(app);
    }
    const messages: FcmMessage[] = tokens.map((token) => ({
      token,
      notification: { title: messageTitle(ctx), body: messageBody(ctx) },
      data: { monitorId: ctx.monitor.id, event: ctx.event },
      android: { priority: 'high' },
    }));
    await fcmMessaging.sendEach(messages);
    return { ok: true };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'FCM send failed');
    return { ok: false, error: (err as Error).message };
  }
}

export const notificationProviders = {
  email: emailProvider,
  sms: smsProvider,
  webhook: webhookProvider,
  push: pushProvider,
};
