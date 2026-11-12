# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Upkeep API + worker — one image, two targets:
#   default target `runner`        → API:      CMD node dist/main.js
#   target `openvpn-runner`        → privileged tunnel worker (NET_ADMIN + tun)
#
# Dist-only mandate (guardrails §5.4 / §11.2): the runner receives a
# `pnpm deploy` output — compiled dist + production node_modules only.
# No TypeScript sources, no packages/ tree, no repo root.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app

# 1) Manifest-only layer for install caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2) Sources + workspace build (db postinstall skipped above; generate here so
#    prisma engines resolve against the committed schema).
COPY . .
RUN pnpm --filter @upkeep/db run generate \
  && pnpm --filter @upkeep/core --filter @upkeep/db --filter @upkeep/api-client run build \
  && pnpm --filter @upkeep/api run build

# 3) Self-contained production deploy dir (dist + prod deps incl. workspace pkgs).
RUN pnpm deploy --filter=@upkeep/api --prod /out

# ── API runner (default) ────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nodejs
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=builder --chown=1001:1001 /out ./
USER nodejs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/main.js"]

# ── Privileged OpenVPN tunnel worker ────────────────────────────────────────
# Build with: docker build --target openvpn-runner -t upkeep-api:openvpn .
# Run with:   --cap-add NET_ADMIN --device /dev/net/tun
FROM node:22-bookworm-slim AS openvpn-runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini openvpn iproute2 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nodejs
WORKDIR /app
ENV NODE_ENV=production UPKEEP_ROLE=worker
COPY --from=builder --chown=1001:1001 /out ./
USER nodejs
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/worker.js"]
