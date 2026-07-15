# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/pdf-worker/package.json apps/pdf-worker/package.json
COPY apps/agent-worker/package.json apps/agent-worker/package.json

RUN pnpm install --frozen-lockfile

FROM base AS runner

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

COPY --from=deps /app/ ./
COPY apps/web apps/web
COPY apps/agent-worker apps/agent-worker

RUN apk add --no-cache openssl
RUN pnpm --filter @cvscholar/web prisma:generate

CMD ["pnpm", "--filter", "@cvscholar/agent-worker", "start"]
