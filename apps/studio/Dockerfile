FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/studio/package.json apps/studio/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY . .

RUN cd apps/studio && NEXT_PRIVATE_WORKER_THREADS=false pnpm build

ENV NODE_ENV=production

WORKDIR /app/apps/studio
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
