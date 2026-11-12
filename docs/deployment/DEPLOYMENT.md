# Deployment Guide

Three supported topologies, from laptop to production. All of them share the same contract: **PostgreSQL 16 + Redis 7 + the `apps/api` image (two roles) + the web app**.

| Topology                                                             | Use case                                          |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| [Local development](#1-local-development)                            | Hacking on the repo                               |
| [Single-host Docker](#2-single-host-production-docker-compose)       | One VPS runs everything                           |
| [Split: Vercel + containers](#3-split-production-vercel--containers) | Web on Vercel, API/workers on a VPS or Fly/Render |

See [ENVIRONMENT.md](./ENVIRONMENT.md) for every variable, [OPENVPN-WORKER.md](./OPENVPN-WORKER.md) for the privileged worker, and [RUNBOOK.md](./RUNBOOK.md) for operations.

---

## 1. Local development

Prerequisites: Node ≥ 22, pnpm ≥ 9 (`npm i -g pnpm`), Docker (or local Postgres 16 + Redis 7).

```bash
# infrastructure
docker compose -f compose.dev.yml up -d        # postgres :5432, redis :6379, adminer :8080

# install + configure
pnpm install
cp apps/api/.env.example apps/api/.env         # defaults work against compose.dev
pnpm db:migrate                                # prisma migrate dev (creates schema)
pnpm db:seed                                   # demo user + monitors (dev only)

# run (three terminals, or use tmux)
pnpm dev:api                                   # REST API      → http://127.0.0.1:4000
pnpm dev:worker                                # check engine  (dispatcher + queues)
pnpm dev:web                                   # dashboard     → http://127.0.0.1:3000
```

> **Open the web app at `http://127.0.0.1:3000`, not `localhost:3000`.**
> The API lives on `127.0.0.1:4000`; `localhost` and `127.0.0.1` are different
> _sites_ for SameSite=Lax cookies, so sessions break on `localhost`. In
> production both share one domain behind the proxy — not an issue there.

Demo login (seed): `demo@upkeep.dev` / `demo12345`.

Useful endpoints: `GET /health/live`, `GET /health/ready`, `GET /openapi.json`.

### Mobile (dev)

```bash
cd apps/mobile
pnpm exec expo start              # QR → Expo Go, or press a for Android emulator
```

The emulator reaches your host's API via `http://10.0.2.2:4000` (default in
`src/lib/auth.ts`); override with `EXPO_PUBLIC_API_URL`.

---

## 2. Single-host production (docker compose)

One Linux server, one domain, automatic TLS via Caddy.

```bash
git clone <repo> upkeep && cd upkeep

# 1. secrets
cp apps/api/.env.example apps/api/.env
$EDITOR apps/api/.env             # see ENVIRONMENT.md — generate real secrets!
export UPKEEP_DOMAIN=upkeep.example.com
export POSTGRES_PASSWORD=$(openssl rand -hex 16)

# 2. build + start (postgres, redis, caddy, api, worker, web)
docker compose -f compose.prod.yml up -d --build

# 3. apply migrations (explicit — never at app boot)
DATABASE_URL="postgresql://upkeep:${POSTGRES_PASSWORD}@localhost:5432/upkeep" \
  pnpm db:deploy
# (or from outside the host: docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy …)
```

Verify: `curl https://$UPKEEP_DOMAIN/health/ready` → `{"checks":{"database":true,"redis":true}}`.

**OpenVPN monitors** additionally need the privileged worker:

```bash
docker compose -f compose.prod.yml --profile openvpn up -d openvpn-worker
```

It runs with `NET_ADMIN` + `/dev/net/tun` — see [OPENVPN-WORKER.md](./OPENVPN-WORKER.md)
for what that grants and how to verify it. SSH-tunnel monitors do **not** need it.

### Postgres/Redis on the host network

The compose file publishes only 80/443 (Caddy). Postgres and Redis are
internal; run migrations via the api image as shown above.

---

## 3. Split production (Vercel + containers)

- **Web → Vercel**: import the repo, set _Root Directory_ to `apps/web`, and
  set `NEXT_PUBLIC_API_URL=https://api.your-domain.com`. No other config
  needed (standalone output is Vercel-compatible). CORS: add the Vercel
  origin to `CORS_ORIGIN` on the API.
- **API + worker → any container host** (VPS with compose, Fly.io, Render):
  build `apps/api/Dockerfile` twice — default target for API + SSH worker,
  `openvpn-runner` target for the OpenVPN worker (needs NET_ADMIN/tun).
- **PostgreSQL** → managed (Neon, RDS, Supabase) or your own.
- **Redis** → managed (Upstash, ElastiCache) or your own — must support
  BullMQ (standard Redis 6+ does; serverless-style Valkey HTTP proxies do not).

### Zero-downtime upgrades

1. Build/push the new image (tag = git SHA).
2. `pnpm db:deploy` (additive migrations are applied while the old version serves).
3. Rolling-restart `worker`, then `api` (workers drain on SIGTERM; in-flight checks finish or re-claim on the next tick).
4. Web deploys are immutable on Vercel.

---

## Image reference

| Image                | Target             | Entrypoint                                 | Notes                                                                    |
| -------------------- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| `upkeep-api`         | `runner` (default) | `node dist/main.js`                        | REST API, unprivileged, healthchecked                                    |
| `upkeep-api`         | `runner`           | `node dist/worker.js` _(override command)_ | SSH-tunnel + notification worker                                         |
| `upkeep-api:openvpn` | `openvpn-runner`   | `node dist/worker.js`                      | + openvpn/iproute2; requires `--cap-add NET_ADMIN --device /dev/net/tun` |
| `upkeep-web`         | `runner`           | `node apps/web/server.js`                  | Next standalone; `NEXT_PUBLIC_API_URL` is a **build** arg                |

All images are multi-stage, run as uid 1001 (non-root), use tini as PID 1,
and contain **only compiled artifacts + production dependencies** — no
TypeScript sources, no `packages/` tree (guardrails §5.4).
