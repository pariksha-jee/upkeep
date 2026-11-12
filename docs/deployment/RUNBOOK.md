# Operations Runbook

Day-2 operations for Upkeep deployments.

## Health & status

| Check              | Command / endpoint                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Process alive      | `GET /health/live`                                                                                        |
| Dependencies wired | `GET /health/ready` → `{database, redis}` both `true`                                                     |
| Container health   | `docker compose -f compose.prod.yml ps`                                                                   |
| Worker heartbeats  | Worker logs start with `dispatcher started (5s tick)`; any `dispatcher tick failed` line means DB trouble |
| Queue depth        | `redis-cli llen upkeep-checks` / `upkeep-notifications` — should hover near 0                             |

## Migrations

```bash
# from the repo (any machine with DB access)
DATABASE_URL=postgresql://… pnpm db:deploy

# via the running image
docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy
```

Rules (guardrails §8): migrations are version-controlled, additive, applied by
the deploy pipeline **before** the new version boots, and never at application
startup. Roll-forward on bad migrations; do not edit committed migration files.

## Backups & restore

```bash
# nightly cron (keeps 14 days)
0 3 * * * docker exec upkeep-postgres-1 pg_dump -U upkeep upkeep | gzip > /var/backups/upkeep-$(date +\%F).sql.gz
0 4 * * * find /var/backups -name 'upkeep-*.sql.gz' -mtime +14 -delete
```

Restore drill (do it once before you need it):

```bash
gunzip -c upkeep-2026-11-12.sql.gz | docker exec -i upkeep-postgres-1 psql -U upkeep upkeep
```

Redis data is disposable (queues + leases) — losing it costs in-flight checks
for one interval; monitors self-heal on the next tick.

## Scaling

| Symptom                                        | Action                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Checks lag behind interval (queue depth grows) | Add worker replicas (`docker compose up -d --scale worker=3`) — the dispatcher claims with `FOR UPDATE SKIP LOCKED`, safe with N workers |
| API latency                                    | Scale `api` replicas behind Caddy (stateless)                                                                                            |
| DB pressure                                    | Connection pool is Prisma-managed per process; keep total instances × pool < your PG `max_connections`                                   |

## Common incidents

| Symptom                                  | Likely cause                                    | Fix                                                                                       |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| All monitors DOWN at once                | Network egress or DNS outage on the worker host | Check worker logs + `curl example.com` from the container; monitors recover automatically |
| `readiness failed (redis: down)`         | Redis stopped/restarted                         | Restart redis; API degrades (readiness) but keeps serving cached-auth requests            |
| Tunnel badge `EXPIRED`                   | Signed URL lapsed (AWS/GCP cap at 7 days)       | Rotate: Tunnels → Rotate → paste fresh URL (PLAN §8.1); monitors keep their binding       |
| Tunnel `FAILED: credential fetch failed` | Object deleted, perms changed, or network       | `Test` button returns the sanitized reason                                                |
| Notification `FAILED: SMTP…`             | Provider outage / wrong creds                   | Channels → Test; NotificationLog rows keep the exact error                                |
| Alert storms                             | Flapping endpoint                               | Raise the monitor's confirm thresholds and cooldown; incidents dedupe automatically       |

## Self-monitoring (dogfooding)

Add monitors for the deployment itself:

- `HTTP https://your-domain/health/ready` (expect 200) — catches DB/Redis/API
- `HTTP https://your-domain/` (expect 200) — catches web/Caddy
- Point them at an **external** Upkeep instance or a second account so the
  monitor isn't down together with the outage it should report.

## Secrets rotation

| Secret                                     | Effect of rotation                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | All sessions invalid; users sign in again                                                                              |
| `ENCRYPTION_KEY`                           | Stored tunnel credentials/webhook secrets become undecryptable — re-enter them (tunnels show a clear error until then) |
| `SMTP_*` / `TWILIO_*` / `FCM_*`            | Channel types disable until re-set                                                                                     |

Restart `api` and `worker` after changing env: `docker compose -f compose.prod.yml up -d --force-recreate api worker`.

## Log format

Pino JSON, one line per event, `requestId` correlated across request logs and
error envelopes. Sensitive fields (authorization headers, cookie, credential
material, signed URLs) are redacted centrally in `shared/logger.ts`.
