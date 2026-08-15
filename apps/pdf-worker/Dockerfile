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
ENV XDG_CACHE_HOME=/app/.cache

RUN apk add --no-cache openssl poppler-utils tectonic

COPY --from=deps /app/ ./
COPY apps/web apps/web
COPY apps/pdf-worker apps/pdf-worker

RUN pnpm --filter @cvscholar/web prisma:generate

# Pre-warm Tectonic package/font cache. The Fullyjustified CDN often returns HTTP 429
# under GitHub Actions load, so retry with backoff instead of failing the image build once.
RUN mkdir -p /app/.cache /tmp/tectonic-warmup \
    && set -e; \
       attempt=1; \
       max=8; \
       until tectonic --keep-logs --outdir /tmp/tectonic-warmup apps/pdf-worker/latex-warmup.tex; do \
         if [ "$attempt" -ge "$max" ]; then \
           echo "Tectonic warmup failed after ${max} attempts (CDN rate limit or network)."; \
           exit 1; \
         fi; \
         sleep_secs=$((attempt * 20)); \
         echo "Tectonic warmup attempt ${attempt} failed; retrying in ${sleep_secs}s..."; \
         attempt=$((attempt + 1)); \
         sleep "$sleep_secs"; \
       done \
    && rm -rf /tmp/tectonic-warmup

RUN mkdir -p /app/storage/generated /app/storage/temp/latex

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@cvscholar/pdf-worker", "start"]
