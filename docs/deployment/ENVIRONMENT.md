# Environment Variables

Every variable the API/worker reads, in one table. The process **refuses to
boot** (fail-fast, guardrails §7.1) when a required variable is missing or a
secret is weak. Optional provider blocks disable the matching channel type
when unset — the API returns a clear error instead of failing delivery.

## Core (required)

| Variable             | Used by     | Format / constraint                     | Notes                                                                                      |
| -------------------- | ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`           | api, worker | `development` \| `test` \| `production` | Default `development`                                                                      |
| `PORT`               | api         | int 1–65535                             | Default `4000`                                                                             |
| `HOST`               | api         | hostname                                | Bind address. `127.0.0.1` for dev; `0.0.0.0` behind a proxy                                |
| `DATABASE_URL`       | api, worker | `postgresql://user:pass@host:5432/db`   | PostgreSQL 14+                                                                             |
| `REDIS_URL`          | api, worker | `redis://host:6379`                     | BullMQ + leases; standard Redis (no HTTP proxies)                                          |
| `JWT_ACCESS_SECRET`  | api, worker | ≥ 32 chars                              | `openssl rand -hex 32`                                                                     |
| `JWT_REFRESH_SECRET` | api, worker | ≥ 32 chars                              | Rotate to invalidate all sessions                                                          |
| `ENCRYPTION_KEY`     | api, worker | base64, exactly 32 bytes                | AES-256-GCM master key for tunnel credentials + webhook secrets. `openssl rand -base64 32` |
| `CORS_ORIGIN`        | api         | comma-separated origins                 | e.g. `https://upkeep.example.com,https://xyz.vercel.app`                                   |

## Optional providers (feature-gated channels)

| Variable                                                        | Enables             | Notes                                                                    |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email notifications | Port 465 ⇒ implicit TLS; otherwise STARTTLS                              |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`        | SMS notifications   | From number in E.164                                                     |
| `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`         | Push notifications  | Firebase service-account JSON fields (single line; `\n` escapes handled) |

## Tunables

| Variable                      | Default   | Notes                                                                        |
| ----------------------------- | --------- | ---------------------------------------------------------------------------- |
| `LOG_LEVEL`                   | `info`    | Pino level: `fatal`…`trace` (`silent` under test)                            |
| `WORKER_CONCURRENCY`          | `50`      | Parallel check jobs per worker                                               |
| `CHECK_RETENTION_DAYS`        | `45`      | Raw `Check` rows purged nightly (batched)                                    |
| `CREDENTIAL_FETCH_MAX_BYTES`  | `262144`  | Signed-URL credential size cap                                               |
| `CREDENTIAL_FETCH_TIMEOUT_MS` | `10000`   | Signed-URL fetch timeout                                                     |
| `CREDENTIAL_HOST_ALLOWLIST`   | _(unset)_ | Comma list of hostnames allowed for signed URLs (beyond HTTPS + non-private) |
| `WEBHOOK_ALLOW_PRIVATE`       | `false`   | Self-hosted only: allow webhook channels targeting private addresses         |

## Secrets handling

- Generate distinct secrets per environment: `openssl rand -hex 32` (JWTs) and
  `openssl rand -base64 32` (encryption key).
- **Changing `ENCRYPTION_KEY` invalidates every stored tunnel credential and
  webhook secret** (they become undecryptable; tunnels show FAILED with
  "stored tunnel configuration is unreadable"). Rotate = re-enter credentials.
- Prefer your platform's secret store (Vercel env, Fly secrets, SOPS, Vault).
  `.env*` files are git-ignored; Gitleaks runs in CI.

## Web app (build-time)

| Variable              | Default                 | Notes                                                               |
| --------------------- | ----------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:4000` | Public API base URL; **baked at build time** into the client bundle |

## Mobile app (build-time)

| Variable                     | Default                | Notes                                                                                           |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`        | `http://10.0.2.2:4000` | `10.0.2.2` = host loopback from the Android emulator; set the production URL for release builds |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | _(unset)_              | EAS project id if you use Expo push instead of raw FCM                                          |
