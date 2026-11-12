# ADR 0006 — Two credential sources (inline encrypted vs signed URL)

**Status:** Accepted · **Date:** 2026-11-12

## Context

Users whose compliance standards forbid a third party persisting SSH keys or
VPN configs still need private-endpoint monitoring.

## Decision

Tunnels carry `credentialSource ∈ {INLINE, SIGNED_URL}`. INLINE = AES-256-GCM
material at rest. SIGNED_URL = runtime fetch from a customer-generated
presigned URL (AWS S3 / GCS v4 at launch) under strict guards (HTTPS-only,
non-private host, optional allowlist, 256 KB cap, timeout, parse-before-use),
material kept in memory only. `RemoteCredentialProvider {fetch, parseExpiry,
label}` keeps Azure SAS / Vault / KMS-issued certs as drop-ins. Expiry is
parsed from the URL signature at save time, surfaced in UI, swept hourly, and
rotated via `PATCH` without touching monitors.

## Consequences

- ✅ Zero-persistence mode with no cloud credentials held by Upkeep.
- ⚠️ 7-day provider cap on signed URLs ⇒ expiry alerting + frictionless
  rotation are load-bearing (implemented as such).
- OpenVPN configs additionally pass a directive allowlist (see
  [credential-sources.md](../credential-sources.md)) — a security review
  finding that became a tested control.
