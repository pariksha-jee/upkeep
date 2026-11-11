import { describe, expect, it } from 'vitest';
import { UpkeepClient, ApiError } from '../src/index.js';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const user = {
  id: '0d7baa67-3661-4c53-8f9e-f2e21a5b819a',
  email: 'demo@upkeep.dev',
  name: 'Demo',
  role: 'USER',
  createdAt: '2026-11-12T00:00:00.000Z',
};

function makeClient(fetchImpl: FetchLike, tokens?: { access: string; refresh: string }) {
  return new UpkeepClient({
    baseUrl: 'http://api.test',
    fetchImpl,
    ...(tokens !== undefined
      ? {
          getAccessToken: () => tokens.access,
          getRefreshToken: () => tokens.refresh,
          onTokens: (t) => {
            tokens.access = t.accessToken;
            tokens.refresh = t.refreshToken;
          },
        }
      : {}),
  });
}

describe('UpkeepClient', () => {
  it('unwraps the envelope and parses the DTO', async () => {
    const client = makeClient(async () => jsonResponse(200, { success: true, data: user }));
    const me = await client.me();
    expect(me.email).toBe('demo@upkeep.dev');
  });

  it('maps error envelopes to ApiError with code and requestId', async () => {
    const client = makeClient(async () =>
      jsonResponse(404, {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Monitor not found', requestId: 'req-1' },
      }),
    );
    await expect(client.getMonitor('0d7baa67-3661-4c53-8f9e-f2e21a5b819a')).rejects.toBeInstanceOf(
      ApiError,
    );
    try {
      await client.getMonitor('0d7baa67-3661-4c53-8f9e-f2e21a5b819a');
    } catch (err) {
      expect((err as ApiError).code).toBe('NOT_FOUND');
      expect((err as ApiError).requestId).toBe('req-1');
    }
  });

  it('attaches bearer token, refreshes once on 401 and retries', async () => {
    const tokens = { access: 'stale', refresh: 'refresh-1' };
    let calls = 0;
    const client = makeClient(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls++;
      if (url.endsWith('/v1/auth/me')) {
        const auth = (init?.headers as Record<string, string>)?.authorization;
        return auth === 'Bearer fresh'
          ? jsonResponse(200, { success: true, data: user })
          : jsonResponse(401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'expired' },
            });
      }
      if (url.endsWith('/v1/auth/refresh')) {
        return jsonResponse(200, {
          success: true,
          data: {
            accessToken: 'fresh',
            refreshToken: 'refresh-2',
            user,
          },
        });
      }
      return jsonResponse(500, { success: false, error: { code: 'X', message: 'unreachable' } });
    }, tokens);

    const me = await client.me();
    expect(me.email).toBe('demo@upkeep.dev');
    expect(tokens.access).toBe('fresh');
    expect(tokens.refresh).toBe('refresh-2');
    expect(calls).toBe(3); // me(401) → refresh → me(200)
  });

  it('sends the CSRF header on mutations in cookie mode', async () => {
    let seenHeader: string | undefined;
    const client = new UpkeepClient({
      baseUrl: 'http://api.test',
      useCookies: true,
      fetchImpl: async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeader = (init?.headers as Record<string, string>)?.['x-upkeep-csrf'];
        return jsonResponse(200, { success: true, data: { loggedOut: true } });
      },
    });
    await client.logout();
    expect(seenHeader).toBe('1');
  });
});
