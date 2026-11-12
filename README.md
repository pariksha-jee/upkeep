# Upkeep

Uptime monitoring and alerting for **public and private endpoints** — like UptimeRobot, but able to reach inside your network via **SSH tunnels** and **OpenVPN**, with credentials either encrypted at rest or fetched at runtime from your own signed URLs (AWS S3 / GCP Cloud Storage) for zero-persistence compliance.

- **Monitors** — HTTP(S) and TCP checks at 30s / 1m / 5m / 10m / 15m / 30m / 1h intervals
- **Alerts** — email, SMS, HMAC-signed webhooks, mobile push; cooldowns and anti-flapping thresholds
- **Apps** — NestJS API + check-engine worker, Next.js dashboard, Expo (Android-first) mobile app

## Stack

pnpm workspaces · TypeScript (strict) · NestJS 12 · PostgreSQL 16 + Prisma · BullMQ + Redis · Next.js 16 · Expo SDK 58 · Pino · Vitest

## Quickstart (development)

```bash
# 1. Infrastructure (Postgres 16 + Redis 7)
docker compose -f compose.dev.yml up -d

# 2. Install
pnpm install

# 3. Environment
cp apps/api/.env.example apps/api/.env

# 4. Database
pnpm db:migrate        # create + apply dev migration
pnpm db:seed           # optional demo user + monitors

# 5. Run (three terminals)
pnpm dev:api           # REST API on :4000
pnpm dev:worker        # check engine + notifications
pnpm dev:web           # dashboard on :3000
```

> **Open the dashboard at `http://127.0.0.1:3000`** (not `localhost:3000`) —
> session cookies are SameSite-scoped and the API sits on `127.0.0.1:4000`.
> Production serves both behind one domain, so this is dev-only.

Default seed login: `demo@upkeep.dev` / `demo12345` (development only).

**Production**: `docs/deployment/DEPLOYMENT.md` covers single-host
docker-compose (Caddy TLS) and the split Vercel + containers topology.

## Repository layout

```
apps/api      NestJS headless API + worker entry (one image, two roles)
apps/web      Next.js dashboard (pure API consumer, Vercel-ready)
apps/mobile   Expo React Native app (Android first)
packages/core Domain types, Zod schemas, state-machine logic (pure TS)
packages/db   Prisma schema, migrations, seeds, client
packages/api-client  Typed HTTP client shared by web + mobile
docs/         architecture · deployment · requirement
```

See [PLAN.md](./PLAN.md) for the full engineering plan and [GUARDRAILS.md](./GUARDRAILS.md) for the source standards (adapted: pnpm workspaces instead of Turborepo).

## Documentation

- [Docs index](./docs/README.md)
- [Deployment guide](./docs/deployment/DEPLOYMENT.md)
- [Environment variables](./docs/deployment/ENVIRONMENT.md)
- [OpenVPN privileged worker](./docs/deployment/OPENVPN-WORKER.md)
- [Ops runbook](./docs/deployment/RUNBOOK.md)
