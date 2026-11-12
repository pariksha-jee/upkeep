import { describe, expect, it } from 'vitest';

process.env.ENCRYPTION_KEY ??= 's8PL5xMCAxUdOKMhxl0StMlbUH8JiVFzy0fXbqyzUMA=';

const { parseSignedUrlExpiry, isPrivateHostname, awsS3PresignedProvider, gcpSignedUrlProvider } =
  await import('../../src/worker-core/credentials.js');

describe('parseSignedUrlExpiry', () => {
  it('parses AWS SigV4 query params', () => {
    const d = parseSignedUrlExpiry(
      'https://b.s3.amazonaws.com/k.pem?X-Amz-Date=20261112T083000Z&X-Amz-Expires=900&X-Amz-Signature=x',
      'AWS_S3',
    );
    expect(d?.toISOString()).toBe('2026-11-12T08:45:00.000Z');
  });

  it('parses GCS v4 query params', () => {
    const d = parseSignedUrlExpiry(
      'https://storage.googleapis.com/b/k.ovpn?X-Goog-Date=20261112T000000Z&X-Goog-Expires=604800&X-Goog-Signature=x',
      'GCP_CS',
    );
    expect(d?.toISOString()).toBe('2026-11-19T00:00:00.000Z');
  });

  it('returns null for URLs without expiry params', () => {
    expect(parseSignedUrlExpiry('https://b.s3.amazonaws.com/k.pem', 'AWS_S3')).toBeNull();
  });
});

describe('fetch guardrails', () => {
  it('refuses non-HTTPS and private hosts', async () => {
    await expect(
      awsS3PresignedProvider.fetchCredential('http://b.s3.amazonaws.com/k.pem'),
    ).rejects.toThrow(/HTTPS/);
    await expect(
      awsS3PresignedProvider.fetchCredential('https://127.0.0.1/k.pem?X-Amz-Signature=x'),
    ).rejects.toThrow(/not allowed/);
    await expect(
      gcpSignedUrlProvider.fetchCredential('https://10.0.0.5/k.pem?X-Goog-Signature=x'),
    ).rejects.toThrow(/not allowed/);
  });

  it('rejects fetched content that is not a credential', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('<html>not a key</html>', { status: 200 })) as typeof fetch;
    try {
      await expect(
        awsS3PresignedProvider.fetchCredential(
          'https://bucket.s3.amazonaws.com/key.pem?X-Amz-Signature=x',
        ),
      ).rejects.toThrow(/does not look like/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('isPrivateHostname (worker-side guard)', () => {
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', 'localhost'])('blocks %s', (h) => {
    expect(isPrivateHostname(h)).toBe(true);
  });
  it.each(['example.com', '8.8.8.8'])('allows %s', (h) => {
    expect(isPrivateHostname(h)).toBe(false);
  });
});
