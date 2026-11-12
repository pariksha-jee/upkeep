# Credential Sources: Inline vs Signed URL

Upkeep's differentiator is reaching **private endpoints**. That requires
credentials — SSH private keys or OpenVPN client configs — and different
compliance regimes want those handled differently. Two modes cover both.

|                      | INLINE (default)                                | SIGNED_URL                                                                                               |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| User provides        | The key / `.ovpn` config itself                 | A time-limited signed URL to the file (AWS S3 presigned GET, GCP Cloud Storage v4)                       |
| Upkeep stores        | AES-256-GCM encrypted material (`configCipher`) | The **URL only**, also AES-256-GCM encrypted (the URL carries auth query params — it is itself a secret) |
| Where material lives | Worker memory during use                        | **Nowhere on disk** — fetched at connect, memory only, never persisted                                   |
| Compliance story     | Standard                                        | "Zero-persistence": for standards that forbid third-party servers holding your keys                      |
| Extra ops            | —                                               | URL expiry tracking + rotation (see below)                                                               |

Both modes work identically for both tunnel types (SSH and OpenVPN). Switching
a tunnel between modes is a `PATCH` — e.g. rotate the URL without recreating
the tunnel or its monitors.

## The fetch pipeline (SIGNED_URL)

Runs in the worker right before a tunnel connects:

```
provider = AWS_S3 | GCP_CS            (interface: fetch, parseExpiry, label)
→ guards: HTTPS only · host not private/loopback (SSRF) · optional host allowlist
          · 256 KB size cap · 10 s timeout · redirects refused
→ content must parse as an OpenSSH/PEM key or OpenVPN config
→ expiry parsed from the signature (X-Amz-Date/X-Amz-Expires · X-Goog-Date/X-Goog-Expires)
→ material handed to the tunnel manager in memory · zeroed after use · never logged
```

Failed fetches surface as sanitized tunnel errors (`EXPIRED`, `FAILED`) —
never key material.

## Expiry lifecycle

AWS presigned URLs and GCS v4 signed URLs both cap out at **7 days**, so
expiry handling is core, not polish:

1. `credentialExpiresAt` is parsed **at save time** and shown in the web/mobile
   UI as a countdown badge (≤ 7 d warning tone, expired = red).
2. An hourly sweep marks lapsed tunnels `EXPIRED` with a clear rotation hint.
3. Rotation is one call: `PATCH /v1/tunnels/:id` with a fresh `{provider, url}`.
   Monitors keep their tunnel binding; the next check reconnects with the new
   material. There is no need to touch the monitors.

## Generating signed URLs

**AWS S3**

```bash
aws s3 presign s3://my-bastion-keys/prod.pem --expires-in 604800
```

**GCP Cloud Storage**

```bash
gcloud storage sign-url gs://my-bastion-keys/prod.pem --duration=604800m
```

(The service account signing the URL needs only `storage.objects.get` on that
object; Upkeep needs no cloud credentials at all — the URL is the credential.)

## OpenVPN configs are untrusted input

A pasted `.ovpn` is sanitized against a **directive allowlist**
(`packages/core/src/logic/openvpn-sanitize.ts`) before it is ever written to
disk: `client`, `remote`, `ca/cert/key`, `cipher`, keepalive and friends pass;
`up`, `route-up`, `iproute`, `script-security`, `http-proxy`, `user`,
`chroot`, unknown inline blocks and everything else is rejected — at upload
(clear validation message) **and** again before every start (defense in
depth). On a NET_ADMIN worker this is the difference between a VPN client and
a remote-code-execution primitive.
