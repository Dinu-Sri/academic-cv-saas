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

- Top bar with brand, credit balance, and login action.
- Left navigation:
  - Academic Profile
  - Build CV
  - Academic Website
  - Publications
  - Billing
  - Settings
- `/` redirects to Academic Profile so users start on a useful task.
- Each screen has one main action and one simple task panel.
- Desktop keeps a compact status panel with only profile, CV, and website status.
- Login modal placeholder for Phase 2 authentication.

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
pnpm web:typecheck
pnpm web:lint
pnpm web:build
```

If using npm instead of pnpm, either add npm workspaces or run commands inside `apps/web` after installing dependencies there.

## Current Sandbox Note

During scaffolding, `pnpm install` succeeded with elevated filesystem access and generated the lockfile. Running pnpm scripts inside the restricted sandbox can fail before project code executes because Node cannot read a Windows user-directory path (`EPERM` while reading `C:\Users\User`). With elevated filesystem access, `pnpm web:typecheck`, `pnpm web:lint`, and `pnpm web:build` pass.

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

1. Redeploy the rewrite staging stack and visually review the simplified shell.
2. Then add Better Auth, PostgreSQL, Prisma, and workspace models.
