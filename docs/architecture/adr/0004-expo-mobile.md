# ADR 0004 — Expo (React Native) for mobile, Android-first

**Status:** Accepted · **Date:** 2026-11-12

## Context

"Any tech, as long as complex functionality is implementable"; TypeScript is
the house language.

## Decision

Expo SDK 58 + expo-router, sharing `@upkeep/core` and `@upkeep/api-client`
with the web app. Android ships first (EAS profiles: preview APK for QA,
AAB for Play). iOS is a later polish pass.

## Consequences

- ✅ One language + one API contract across three surfaces.
- ✅ Push (FCM), secure storage, deep links are first-class SDK modules — the
  "complex functionality" bar.
- ⚠️ No React Native ESLint config yet (mobile files are prettier-formatted
  only; typechecked in CI).
- Escalation path: an EAS dev build admits any bare module without leaving Expo.
