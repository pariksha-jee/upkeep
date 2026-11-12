# ADR 0001 — pnpm workspaces (no Turborepo)

**Status:** Accepted · **Date:** 2026-11-12

## Context

The guardrails this repo is derived from mandate a workspace monorepo and were
written for Turborepo. The project constraint is pnpm.

## Decision

pnpm workspaces only. Orchestration is `pnpm -r <script>` (topological) plus a
GitHub Actions matrix. No turbo.json, no remote cache.

## Consequences

- ✅ Zero extra tooling; scripts stay single-purpose per guardrails §5.3.
- ✅ pnpm-native features we rely on: `pnpm deploy` for dist-only images,
  `allowBuilds` native-dependency allowlist (supply-chain hardening).
- ⚠️ No cross-package task caching — CI installs with a frozen lockfile and
  pnpm's content-addressable store keeps it fast enough at this size.
- Packages publish **compiled `dist/`** (consumed by API via tsc, by web/mobile
  as plain ESM). The dist-only mandate is preserved via `pnpm deploy`, which
  bundles workspace deps into the image without shipping sources.
