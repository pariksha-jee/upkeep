# Upkeep — Product Specification

## What it is

An uptime monitoring and alerting platform (UptimeRobot-class) whose
differentiator is **private-endpoint monitoring** via SSH tunnels and OpenVPN —
with a zero-persistence credential mode for compliance-restricted teams.

## Users & jobs-to-be-done

| User                                          | Job                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| SRE on-call                                   | Know within 30 s when any endpoint (public or behind the bastion) degrades; get paged through the channels we already use |
| Platform engineer with compliance constraints | Monitor internal services without handing a third party our SSH keys                                                      |
| Indie hacker                                  | Watch a handful of public URLs with email + push alerts, free of noise                                                    |

## Feature checklist (v1 — as built)

### Monitors

- [x] HTTP(S): method, headers, body, keyword assertion, expected status codes, timeout 1–30 s
- [x] TCP host:port
- [x] Intervals: 30 s / 1 m / 5 m / 10 m / 15 m / 30 m / 1 h
- [x] Anti-flapping: confirm-down N failures / confirm-up N successes (1–10, defaults 2/2)
- [x] Pause/resume (pause resolves open incidents quietly), instant "Check now", delete with full history cascade
- [x] Uptime bars (1 h–90 d), response-time chart, recent checks, incident timeline, notification log

### Tunnels

- [x] SSH: key-based auth, host/port/user, pooled local forwards per target
- [x] OpenVPN: client config (directive-allowlisted) — runs on the privileged worker
- [x] Credential modes: INLINE (AES-256-GCM at rest) and SIGNED_URL (AWS S3 / GCS, runtime fetch, never stored)
- [x] Expiry countdown badges, hourly EXPIRED sweep, one-call URL rotation, connectivity test

### Alerting

- [x] Channels: email (SMTP), SMS (Twilio), webhook (HMAC-signed, versioned payload), device push (FCM, automatic)
- [x] Per-monitor bindings with notify-on-down/recovery + per-channel cooldown; SKIPPED attempts audited
- [x] Incidents: cause, duration, full delivery log

### Apps

- [x] Web dashboard: landing, auth, monitors, monitor detail/edit, tunnels, channels, incidents, settings; light/dark
- [x] Android app: login/register, monitor list, incidents, settings + push registration, monitor detail/add

### Ops

- [x] Health live/ready, OpenAPI JSON, structured logs with request IDs, seeds, CI (lint/typecheck/test/e2e/build/gitleaks/docker)

## Out of scope for v1 (planned)

Status pages · maintenance windows · ICMP/ping monitors · SSL-expiry checks ·
multi-region probes · teams/roles · SSO · iOS polish · realtime updates over
WebSocket (v1 polls) · per-tunnel network namespaces for overlapping VPN CIDRs.

## Acceptance criteria (release gate)

1. A monitor created via the web dashboard records its first real check within
   one interval of creation; state transitions and incidents match the spec.
2. Taking a monitored public endpoint down (verified with a controllable
   404-ing target) pages email + webhook within one interval of confirmation;
   recovery pages on confirm-up.
3. An SSH tunnel created with a real key + bastion carries checks to a private
   target (verified in a sandbox with a local sshd).
4. A signed-URL tunnel shows a correct expiry badge and rotates without
   touching monitors.
5. `/health/ready` is green on a fresh compose deployment following
   docs/deployment/DEPLOYMENT.md, and the seeded demo login works.
