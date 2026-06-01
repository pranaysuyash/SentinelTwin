# ── SentinelTwin Studio — Multi-stage Docker build ─────────────────────────
# Stage 1: Install dependencies
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/studio/package.json apps/studio/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN cd apps/studio && NEXT_PRIVATE_WORKER_THREADS=false pnpm build

# Stage 3: Production runtime
FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

RUN addgroup --system --gid 1001 sentineltwin \
    && adduser --system --uid 1001 sentineltwin

WORKDIR /app/apps/studio

COPY --from=builder /app/apps/studio/.next ./.next
COPY --from=builder /app/apps/studio/public ./public
COPY --from=builder /app/apps/studio/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER sentineltwin

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
