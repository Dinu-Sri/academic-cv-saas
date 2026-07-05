# Phase 0 Decisions and Environment Checklist

This checklist must be resolved before scaffolding or deploying the rewrite stack. It protects the current production PHP app while the Next.js/PostgreSQL rewrite is built in parallel.

## Required Decisions

### Repository Strategy

Recommendation: keep the rewrite inside this repository as a clearly separated workspace until it is mature.

Options:

- `apps/web`, `apps/workers/*`, `packages/*` in this repository.
- Separate repository for the rewrite.
- Separate branch with long-running rewrite work.

Decision needed:

- Where should Stage 1 app-shell code live?
- Should the current PHP app remain at repository root during the rewrite?

Suggested answer:

- Keep current PHP app at root.
- Add rewrite code under `apps/` and `packages/`.
- Do not move production PHP files during Stage 1.

### Runtime and Framework

Blueprint recommendation:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.

Decision needed:

- Confirm Node/package manager: npm, pnpm, or another.
- Confirm whether the first scaffold should include shadcn/ui immediately or after base layout.

Suggested answer:

- Use `pnpm` if available and accepted for production builds; otherwise use npm.
- Add Tailwind and shadcn/ui in Stage 1 because UI consistency is central to the rewrite.

### Database

Blueprint recommendation:

- PostgreSQL.
- Prisma first.

Decision needed:

- PostgreSQL hosting: self-hosted Docker, managed Postgres, or both staging/prod split.
- Prisma vs Drizzle.

Suggested answer:

- Prisma for rewrite velocity and migrations.
- Staging Postgres in Docker/Portainer first.
- Production can be managed Postgres or a carefully backed-up Portainer service.

### Authentication

Blueprint recommendation:

- Better Auth.
- Workspace membership model.

Decision needed:

- Can current password hashes be reused?
- Should migrated users use password reset/magic link on first login?
- Google OAuth app/client strategy for rewrite/staging.

Suggested answer:

- Do not assume hash compatibility.
- Use email verification/reset/magic link path for migrated password users unless hash compatibility is proven.
- Preserve Google login by matching email and provider identity.

### Billing Provider

Current app:

- PayHere.
- Plans/subscriptions.
- Credit economy.

Decision needed:

- Keep PayHere in rewrite MVP?
- Add another provider?
- How to migrate active subscriptions safely?

Suggested answer:

- Keep PayHere history.
- Keep PayHere checkout unless there is a business decision to change.
- Do not cut over billing until subscription behavior is verified in staging.

### Object Storage

Blueprint recommendation:

- Cloudflare R2.

Decision needed:

- Bucket names and access policies.
- Whether existing local PDFs migrate eagerly or lazily.

Suggested answer:

- Buckets:
  - `cvscholar-private`
  - `cvscholar-public`
  - `cvscholar-temp`
  - `cvscholar-logs`
- Migrate generated PDFs eagerly for beta users, then all users before cutover.
- Keep missing-file report.

### Queue and Workers

Blueprint recommendation:

- Redis + BullMQ.
- Separate workers for PDF, website, email, cleanup.

Decision needed:

- Redis hosting.
- Worker scaling strategy in Portainer.
- Whether website publishing is queued from MVP or direct/snapshot first.

Suggested answer:

- Add Redis in staging compose.
- PDF generation must be queued from the start.
- Website publishing can use queue if implemented early; otherwise make publish a fast snapshot operation and add worker later.

### PDF Engine

Blueprint recommendation:

- Tectonic LaTeX in isolated workers.

Current app:

- `LatexRenderer.php` with `xelatex`.
- `RendererFactory.php` normalizes legacy `fpdf` to `latex`.

Decision needed:

- Port current templates to Tectonic directly or keep xelatex worker compatibility first?
- Which template is ported first?

Suggested answer:

- Start with one Tectonic template package.
- Use current LaTeX renderer behavior as visual reference, not as runtime dependency.
- Port Classic first, then Modern, Detailed, and Pro templates.

### Public Websites

Blueprint recommendation:

- Subdomain per customer/profile.

Current app:

- `/u/{slug}`.
- single/multi-page mode.
- contact messages.

Decision needed:

- Launch rewrite website MVP with `/u/{slug}` first or wildcard subdomains immediately?
- Preserve current slugs?

Suggested answer:

- Preserve `/u/{slug}` for launch.
- Add subdomains after DNS, reserved names, spam protection, and abuse admin tools are ready.

### Email Provider

Blueprint recommendation:

- Resend.

Current app:

- SMTP settings and email service.

Decision needed:

- Keep SMTP initially or switch to Resend in rewrite.

Suggested answer:

- Use Resend in rewrite staging.
- Preserve old email history only if needed.

### Analytics and Errors

Blueprint recommendation:

- PostHog.
- Sentry.

Current app:

- PostHog/GA references.
- behavior tracking.
- user events.
- analytics API.

Decision needed:

- Which historical events migrate?
- Which events are tracked from Stage 1?

Suggested answer:

- Do not migrate all old analytics row-by-row.
- Track new rewrite events from day one:
  - app shell loaded.
  - signup/login modal opened.
  - profile started/completed.
  - CV generation requested/succeeded/failed.
  - website publish requested/succeeded/failed.
  - billing checkout opened.

## Environment Variables to Plan

Do not add these to the current PHP production app yet. These are for rewrite staging/prod.

### App

- `NEXT_PUBLIC_APP_URL`
- `APP_ENV`
- `APP_SECRET`
- `TRUSTED_HOSTS`

### Database

- `DATABASE_URL`
- `SHADOW_DATABASE_URL` if Prisma needs it.

### Auth

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Redis and Queues

- `REDIS_URL`
- `PDF_QUEUE_CONCURRENCY`
- `WEBSITE_QUEUE_CONCURRENCY`
- `EMAIL_QUEUE_CONCURRENCY`

### R2

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PRIVATE_BUCKET`
- `R2_PUBLIC_BUCKET`
- `R2_TEMP_BUCKET`
- `R2_LOGS_BUCKET`
- `R2_PUBLIC_BASE_URL`

### Email

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPPORT_EMAIL`

### Billing

- PayHere variables if kept.
- Any new provider variables if added.

### Analytics and Errors

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` for build/release, if used.

### Security

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `RATE_LIMIT_SECRET`

## Stage 1 Scaffold Gate

Before Stage 1 code starts:

- Repository strategy confirmed.
- Package manager confirmed.
- Current PHP app remains deployable.
- No root-level production files are moved.
- New app can build independently.
- No new production env vars are required.
- No current MySQL migrations are required.

## Stage 1 Acceptance Criteria

- App shell exists in separate rewrite workspace.
- Top bar, left nav, center workspace, and right status panel render.
- Placeholder pages exist for:
  - Home
  - Academic Profile
  - Build CV
  - Academic Website
  - Publications
  - Files
  - Billing
  - Settings
- No backend/auth/database/PDF/billing implementation yet.
- Current PHP app remains untouched except documentation and new rewrite workspace files.
