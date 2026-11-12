# System Design

Condensed from [PLAN.md](../../PLAN.md) — the as-built view.

## Components

```
                    ┌─────────────┐   ┌──────────────────┐
                    │  Web (Next)  │   │ Mobile (Expo/RN) │
                    │  Vercel/any  │   │    Android-first │
                    └──────┬──────┘   └────────┬─────────┘
                           │  REST /v1 (JSON)  │  Bearer JWT
                    ┌──────▼───────────────────▼──────┐
                    │        API (NestJS, :4000)       │  auth, CRUD, stats,
                    │  headless — never serves UI      │  test-now, verify
                    └──────┬───────────────┬──────────┘
                           │ Prisma        │ BullMQ (enqueue)
                    ┌──────▼──────┐  ┌─────▼─────────────┐
                    │ PostgreSQL  │  │  Redis 7          │
                    │ 16          │  │  checks/notif/mnt │
                    └──────▲──────┘  └─────▲─────────────┘
                           │               │
                    ┌──────┴───────────────┴──────────┐
                    │ Worker(s) (same image, no HTTP)  │
                    │  dispatcher → executor → tunnels │
                    │  SSH manager · OpenVPN manager   │
                    │  notification providers          │
                    └──────┬───────────────────────────┘
                           │ outbound: HTTP/TCP · SMTP · Twilio · FCM · webhooks
                           │ tunneled:  ssh2 forwards · openvpn + /32 routes
```

Key decisions (details in [adr/](./adr/)):

- **One image, two roles.** `apps/api` builds `dist/main.js` (API) and
  `dist/worker.js` (engine); Docker targets add the OpenVPN variant.
- **pnpm workspaces, no Turborepo** — orchestration is `pnpm -r` + CI.
- **Dist-only deploys** — packages compile to `dist/`, images ship
  `pnpm deploy` output (API) or Next standalone (web); no sources in prod.
- **`@upkeep/core` is the contract** — Zod schemas/types/state logic shared by
  API, web and mobile; the api-client parses responses with them.

## Data model (11 tables)

`User → Tunnel / Monitor → Check / Incident → NotificationLog ← Channel ← AlertBinding`
plus `CheckAggregate` (hourly rollups), `Device` (push tokens),
`RefreshToken` (rotating, family-revocation). See
`packages/db/prisma/schema.prisma` for the source of truth.

## Security posture

- Fail-fast env boot guard; fail-closed auth on every non-public route.
- JWT access (15 m) + rotating refresh (30 d) with reuse detection; web uses
  httpOnly cookies + CSRF header, mobile uses bearer tokens.
- Tunnel credentials and webhook secrets AES-256-GCM encrypted at rest;
  write-only over the API (GET returns metadata + fingerprint only).
- SSRF guards: direct monitors can't target private ranges (schema + DNS at
  create, DNS re-check at every connect); signed-URL fetches and webhook
  deliveries enforce HTTPS/non-private hosts; OpenVPN configs pass a directive
  allowlist. Security-review driven; regression-tested in
  `packages/core/test/security-guards.test.ts`.
- Webhooks are HMAC-signed (`v1=` scheme) so receivers can verify authenticity.

## Verification (what has actually been run)

- 49 core unit tests, 14 API unit tests, 11 API e2e tests — green locally.
- Live loop verified on this machine: register → login → monitor creation →
  state transitions PENDING→UP→DOWN→UP → incident open/resolve → queue →
  worker → **HMAC-signed webhook delivered** to a local receiver.
- Web dashboard verified in-browser end-to-end (login → live monitor data).
