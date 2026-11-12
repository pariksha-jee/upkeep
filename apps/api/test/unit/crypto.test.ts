import { describe, expect, it } from 'vitest';

process.env.ENCRYPTION_KEY ??= 's8PL5xMCAxUdOKMhxl0StMlbUH8JiVFzy0fXbqyzUMA=';

const { encryptSecret, decryptSecret, signWebhookPayload } =
  await import('../../src/shared/crypto.js');

describe('AES-256-GCM secret box', () => {
  it('round-trips and produces distinct ciphertexts per call (random IV)', () => {
    const secret = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----';
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });

  it('fails closed on tampered ciphertext (auth tag)', () => {
    const cipher = encryptSecret('topsecret');
    const raw = Buffer.from(cipher, 'base64');
    raw.set([raw[raw.length - 1]! ^ 0xff], raw.length - 1);
    expect(() => decryptSecret(raw.toString('base64'))).toThrow();
  });
});

describe('webhook HMAC signature', () => {
  it('is deterministic and verifiable', () => {
    const ts = 1794439048;
    const body = JSON.stringify({ event: 'DOWN' });
    const sig = signWebhookPayload('whsec_test_16_chars!', ts, body);
    expect(sig).toHaveLength(64); // sha256 hex
    expect(signWebhookPayload('whsec_test_16_chars!', ts, body)).toBe(sig);
    expect(signWebhookPayload('other-secret-16ch', ts, body)).not.toBe(sig);
  });
});
