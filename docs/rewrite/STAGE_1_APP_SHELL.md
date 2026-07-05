# Stage 1 App Shell Scaffold

Stage 1 adds a separate Next.js app shell under `apps/web`. It does not replace, move, or modify the current PHP production application.

## What Was Added

- Root workspace metadata:
  - `package.json`
  - `pnpm-workspace.yaml`
- Web app scaffold:
  - `apps/web/package.json`
  - `apps/web/next.config.mjs`
  - `apps/web/tsconfig.json`
  - `apps/web/tailwind.config.ts`
  - `apps/web/postcss.config.mjs`
  - `apps/web/components.json`
  - `apps/web/src/app/*`
  - `apps/web/src/components/*`
  - `apps/web/src/lib/*`

## Product Shape

The scaffold implements the blueprint app shell:

- Top bar with brand, credits, plan, notifications, and login action.
- Left navigation:
  - Home
  - Academic Profile
  - Build CV
  - Academic Website
  - Publications
  - Files / PDFs
  - Billing
  - Settings
- Center workspace with placeholder screens.
- Right status panel with job/status placeholders.
- Login modal placeholder for Phase 2 Better Auth.

## Intentional Non-Goals

Stage 1 does not implement:

- Authentication.
- Database.
- Prisma.
- Redis/BullMQ.
- PDF rendering.
- R2 storage.
- Billing.
- Email.
- Data migration.
- Public website publishing.

## Local Commands

Dependencies were installed with pnpm and `pnpm-lock.yaml` is committed with the scaffold. For local development:

```bash
pnpm install
pnpm web:dev
pnpm web:build
pnpm web:typecheck
```

If using npm instead of pnpm, either add npm workspaces or run commands inside `apps/web` after installing dependencies there.

## Current Sandbox Note

During scaffolding, `pnpm install` succeeded with elevated filesystem access and generated the lockfile. Running `pnpm web:typecheck` inside the restricted sandbox failed before project code executed because Node could not read a Windows user-directory path (`EPERM` while reading `C:\Users\User`). Elevated validation was then blocked by the environment approval limit, so `pnpm web:typecheck`, `pnpm web:lint`, and `pnpm web:build` still need to be rerun when approvals are available.

Tailwind resolved to v4.3.2. Stage 1 uses authored CSS and design tokens, so the PostCSS config only runs Autoprefixer for now. When shadcn components are added, wire Tailwind v4 through the current `@tailwindcss/postcss` integration or pin Tailwind to the compatible v3 toolchain before enabling utility generation.

## Production Impact

- No current PHP routes, controllers, models, migrations, or templates were changed.
- No current production PHP environment variables are required.
- The separate rewrite staging stack uses `NEXT_PUBLIC_APP_URL`, `REWRITE_WEB_PORT`, and `CF_REWRITE_TUNNEL_TOKEN`.
- No current Docker/Portainer service changes are required unless you choose to deploy the separate rewrite staging stack.
- The current XAMPP app remains the production app.
- Live rewrite testing steps are documented in `docs/rewrite/STAGING_DEPLOYMENT.md`.

## Next Stage

Before Phase 2:

1. Rerun `pnpm web:typecheck`, `pnpm web:lint`, and `pnpm web:build`.
2. Start `pnpm web:dev` and visually review the app shell.
3. Then add Better Auth, PostgreSQL, Prisma, and workspace models.
