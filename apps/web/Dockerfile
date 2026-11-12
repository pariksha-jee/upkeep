# syntax=docker/dockerfile:1
# Upkeep web — Next.js standalone output (dist-only, guardrails §5.4).
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time.
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .

FROM node:22-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @upkeep/core --filter @upkeep/api-client run build \
  && pnpm --filter @upkeep/web run build

FROM node:22-bookworm-slim AS runner
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nodejs
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=1001:1001 /app/apps/web/public ./apps/web/public
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
