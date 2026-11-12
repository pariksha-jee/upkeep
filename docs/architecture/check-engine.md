# Check Engine Internals

How a monitor becomes a check, a state transition, an incident, and a delivered notification.

## Scheduling

- Each worker instance runs a **dispatcher** with a 5-second tick.
- The tick claims due monitors atomically:

```sql
UPDATE "Monitor" m SET "nextCheckAt" = now() + interval
WHERE m.id IN (
  SELECT id FROM "Monitor"
  WHERE enabled AND status <> 'PAUSED' AND "nextCheckAt" <= now()
  ORDER BY "nextCheckAt"
  FOR UPDATE SKIP LOCKED
  LIMIT 100
) RETURNING id;
```

`FOR UPDATE SKIP LOCKED` makes the claim safe with any number of worker
replicas — two workers can never claim the same monitor in the same round.

- Claimed monitors are enqueued to the `upkeep-checks` BullMQ queue
  (concurrency `WORKER_CONCURRENCY`, default 50). Claim-time bump of
  `nextCheckAt` prevents double-enqueue while a job is in flight; the executor
  re-sets it from completion time.

## Execution (`CheckExecutor`)

```
load monitor (+tunnel)
  ├─ no tunnel        → direct HTTP/HTTPS or TCP (SSRF-guarded, see below)
  ├─ SSH tunnel       → SshTunnelManager.ensureForward(host, port)
  │                     → connect to 127.0.0.1:<local port>, SNI/Host preserved
  └─ OpenVPN tunnel   → OpenVpnManager.ensureRoute(host)
                        → direct request; /32 route sends it through the tun
record Check row
advance state machine (pure, from @upkeep/core)
persist counters/status/lastCheckedAt/nextCheckAt
on transition → open/resolve Incident → enqueue notifications
```

**HTTP checks** use `node:http(s)` directly (not fetch) for precise control:
per-monitor timeout, no silent redirects (3xx honors the expected-codes list
explicitly), optional keyword assertion against the first 256 KB of body, and
SSH-routed HTTPS keeps `servername`/`Host` on the real hostname so TLS
validation stays honest.

**SSRF guard (connect time):** direct (non-tunneled) monitors re-resolve the
target on every check and refuse private/loopback answers —
`private target rejected — attach a tunnel`. This closes the DNS-rebinding
window left by create-time validation. Tunnel-attached monitors are exempt:
reaching private hosts is their purpose.

## State machine (anti-flapping)

Pure function `advance()` in `@upkeep/core` — unit-tested in isolation:

| From       | Event                                         | To     | Side effect                                       |
| ---------- | --------------------------------------------- | ------ | ------------------------------------------------- |
| PENDING    | ok                                            | UP     | —                                                 |
| PENDING/UP | N consecutive failures (`failureThreshold`)   | DOWN   | incident opens, DOWN notifications                |
| DOWN       | N consecutive successes (`recoveryThreshold`) | UP     | incident resolves, RECOVERY notifications         |
| any        | pause                                         | PAUSED | open incident resolved as "paused", no alert spam |

Counters reset on every opposite outcome, so a single blip inside
`failureThreshold` never pages anyone.

## Notifications

`upkeep-notifications` queue → worker processor:

1. Channel-bound jobs check the binding **cooldown** (`lastNotifiedAt`) —
   suppressed sends are logged as `SKIPPED` for full auditability.
2. Providers: SMTP (nodemailer), Twilio, HMAC-signed webhook
   (`X-Upkeep-Signature: v1=hmac_sha256(ts.body)`, 3 retries, no redirect
   following), FCM push (all user devices, automatic).
3. Every attempt lands in `NotificationLog` — "who was told, when, with what
   result" — visible per incident.

The test-now endpoint and channel verification run the **same executor and
dispatcher code paths** (injected from `worker-core`), so a manual check is
byte-for-byte what the scheduler would do.

## Maintenance (repeatable jobs)

| Job       | Schedule    | Does                                                                                                                           |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| aggregate | hourly      | rolls raw checks into hourly `CheckAggregate` rows                                                                             |
| retention | 03:17 daily | purges raw checks > `CHECK_RETENTION_DAYS` (batched ctid deletes), stale refresh tokens, old notification logs, >2y aggregates |
| sweep     | hourly      | marks tunnels with expired signed URLs `EXPIRED`                                                                               |

Window statistics are computed straight from `date_trunc` GROUP BY queries, so
dashboards stay correct even before aggregates exist.
