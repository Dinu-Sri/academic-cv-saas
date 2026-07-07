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

RUN pnpm install --frozen-lockfile

FROM base AS runner

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV XDG_CACHE_HOME=/app/.cache

RUN apk add --no-cache openssl poppler-utils tectonic

COPY --from=deps /app/ ./
COPY apps/web apps/web
COPY apps/pdf-worker apps/pdf-worker

RUN pnpm --filter @cvscholar/web prisma:generate
RUN mkdir -p /app/.cache /tmp/tectonic-warmup \
    && tectonic --keep-logs --outdir /tmp/tectonic-warmup apps/pdf-worker/latex-warmup.tex \
    && rm -rf /tmp/tectonic-warmup
RUN mkdir -p /app/storage/generated /app/storage/temp/latex

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@cvscholar/pdf-worker", "start"]
