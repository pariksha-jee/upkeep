# ADR 0002 — PostgreSQL + Prisma (over MongoDB)

**Status:** Accepted · **Date:** 2026-11-12

## Context

Monitoring is relational (`User → Monitor → Check → Incident → NotificationLog`)
with a high-volume time-series table (`Check`). Requirement allowed Postgres or
Mongo.

## Decision

PostgreSQL 16 with Prisma ORM and versioned migrations.

## Consequences

- ✅ Foreign keys + cascades make ownership and cleanup trivial (delete a
  monitor → checks/incidents/bindings follow).
- ✅ `FOR UPDATE SKIP LOCKED` row-claiming for the multi-worker dispatcher —
  hard to do right on Mongo.
- ✅ `date_trunc` GROUP BY powers window stats in one SQL round-trip.
- ✅ Prisma migrations satisfy guardrails §8 (migrations-as-code, applied by
  the pipeline, never at boot).
- ⚠️ `exactOptionalPropertyTypes` is disabled **in apps/api only** — Prisma 6's
  generated input types predate that flag. `@upkeep/core` keeps full strictness.
- Growth plan (not needed at v1 scale): convert `Check` to monthly range
  partitions; queries and the executor already key on `checkedAt`.
