# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/pdf-worker/package.json apps/pdf-worker/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

ARG NEXT_PUBLIC_APP_URL
ARG DATABASE_URL
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DATABASE_URL=$DATABASE_URL
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET

COPY --from=deps /app/ ./
COPY apps/web apps/web

RUN pnpm --filter @cvscholar/web prisma:generate
RUN pnpm --filter @cvscholar/web build

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./

RUN mkdir -p /app/apps/web/storage/generated /app/apps/web/storage/temp/latex \
    && chown -R nextjs:nodejs /app/apps/web/storage

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @cvscholar/web prisma:deploy && node apps/web/.next/standalone/apps/web/server.js"]
