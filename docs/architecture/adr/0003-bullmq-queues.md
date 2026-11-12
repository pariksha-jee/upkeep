# ADR 0003 — BullMQ for checks & notifications

**Status:** Accepted · **Date:** 2026-11-12

## Context

Checks must run on schedule (30 s floor) decoupled from HTTP serving; retries,
concurrency limits and horizontal scale are required; Redis is already in the
stack.

## Decision

BullMQ queues (`upkeep-checks`, `upkeep-notifications`, `upkeep-maintenance`)
driven by a 5-second claiming dispatcher. Note the v6 API: repeatable jobs are
registered with `upsertJobScheduler` (not the legacy `repeat` job option), and
queue names may not contain `:`.

## Consequences

- ✅ Worker scale-out is safe (row-claim + SKIP LOCKED); queue depth is an
  actionable signal.
- ✅ Notification retries/backoff without a second system.
- ⚠️ Redis becomes required for the engine (the API itself degrades gracefully
  and reports it via `/health/ready`).
- The dispatcher-vs-per-monitor-timer trade: ±2 s accuracy at 30 s intervals,
  one SQL scan per 5 s per worker — cheap and observable.
