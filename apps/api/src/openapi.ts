/**
 * Hand-maintained OpenAPI 3.1 document served at /openapi.json.
 * JSON only — the API never serves HTML (guardrails §6.1). The runtime
 * contract is @upkeep/core's Zod schemas; this spec describes the surface for
 * external consumers.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Upkeep API',
    version: '1.0.0',
    description:
      'Uptime monitoring for public and private endpoints. All responses use the envelope { success, data, meta? } / { success: false, error }. Auth: Bearer JWT (mobile) or httpOnly cookie (web, plus x-upkeep-csrf header on mutations).',
  },
  servers: [{ url: '/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'upkeep_at' },
    },
  },
  tags: [
    { name: 'auth' },
    { name: 'users' },
    { name: 'monitors' },
    { name: 'tunnels' },
    { name: 'channels' },
    { name: 'incidents' },
    { name: 'devices' },
    { name: 'summary' },
  ],
  paths: {
    '/auth/register': { post: { tags: ['auth'], summary: 'Create account, returns tokens' } },
    '/auth/login': { post: { tags: ['auth'], summary: 'Login, returns tokens + cookies' } },
    '/auth/refresh': { post: { tags: ['auth'], summary: 'Rotate refresh token (body or cookie)' } },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Revoke session family',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Current user',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/users/me': {
      patch: {
        tags: ['users'],
        summary: 'Update profile / change password',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors': {
      get: {
        tags: ['monitors'],
        summary: 'List monitors (paginated, uptime24h)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      post: {
        tags: ['monitors'],
        summary: 'Create HTTP/TCP monitor',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}': {
      get: {
        tags: ['monitors'],
        summary: 'Monitor detail with bindings',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      patch: {
        tags: ['monitors'],
        summary: 'Update monitor',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      delete: {
        tags: ['monitors'],
        summary: 'Delete monitor',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/pause': {
      post: {
        tags: ['monitors'],
        summary: 'Pause (resolves open incident)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/resume': {
      post: {
        tags: ['monitors'],
        summary: 'Resume',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/test': {
      post: {
        tags: ['monitors'],
        summary: 'Run one check immediately',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/bindings': {
      put: {
        tags: ['monitors'],
        summary: 'Replace alert bindings',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/checks': {
      get: {
        tags: ['monitors'],
        summary: 'Recent checks',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/monitors/{id}/stats': {
      get: {
        tags: ['monitors'],
        summary: 'Window stats (1h/24h/7d/30d/90d)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/tunnels': {
      get: {
        tags: ['tunnels'],
        summary: 'List tunnels (sanitized)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      post: {
        tags: ['tunnels'],
        summary: 'Create SSH/OpenVPN tunnel (INLINE or SIGNED_URL credential)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/tunnels/{id}': {
      patch: {
        tags: ['tunnels'],
        summary: 'Rename / rotate credential (incl. signed URL)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      delete: {
        tags: ['tunnels'],
        summary: 'Delete tunnel (monitors detach)',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/tunnels/{id}/test': {
      post: {
        tags: ['tunnels'],
        summary: 'Probe credential + connectivity',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/channels': {
      get: {
        tags: ['channels'],
        summary: 'List channels',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      post: {
        tags: ['channels'],
        summary: 'Create EMAIL/SMS/WEBHOOK channel',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/channels/{id}': {
      patch: {
        tags: ['channels'],
        summary: 'Update channel',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      delete: {
        tags: ['channels'],
        summary: 'Delete channel',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/channels/{id}/verify': {
      post: {
        tags: ['channels'],
        summary: 'Send test notification',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/incidents': {
      get: {
        tags: ['incidents'],
        summary: 'Incident history',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/incidents/{id}': {
      get: {
        tags: ['incidents'],
        summary: 'Incident detail',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/incidents/{id}/notifications': {
      get: {
        tags: ['incidents'],
        summary: 'Delivery log for an incident',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/devices': {
      post: {
        tags: ['devices'],
        summary: 'Register push token',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
      get: {
        tags: ['devices'],
        summary: 'List devices',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/devices/{id}': {
      delete: {
        tags: ['devices'],
        summary: 'Remove device',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
    '/summary': {
      get: {
        tags: ['summary'],
        summary: 'Dashboard summary',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
      },
    },
  },
} as const;
