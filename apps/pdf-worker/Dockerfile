# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/pdf-worker/package.json apps/pdf-worker/package.json

RUN pnpm install --frozen-lockfile

FROM base AS runner

RUN apk add --no-cache openssl tectonic

COPY --from=deps /app/ ./
COPY apps/web apps/web
COPY apps/pdf-worker apps/pdf-worker

RUN pnpm --filter @cvscholar/web prisma:generate \
    && mkdir -p /app/storage/generated /app/storage/temp/latex

CMD ["pnpm", "--filter", "@cvscholar/pdf-worker", "start"]
