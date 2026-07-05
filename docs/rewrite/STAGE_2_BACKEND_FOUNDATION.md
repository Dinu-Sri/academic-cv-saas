# Stage 2 Backend Foundation

Stage 2 starts the real rewrite backend inside the separate staging stack. It does not change the current PHP/MySQL production app.

## Added

- PostgreSQL service in `docker-compose.rewrite.yml`.
- Prisma 7 schema and initial migration under `apps/web/prisma`.
- Better Auth API route at `/api/auth/[...all]`.
- Email/password login and signup in the app shell modal.
- First real rewrite tables:
  - Better Auth: `user`, `session`, `account`, `verification`.
  - Product: `workspaces`, `workspace_members`, `academic_profiles`, `profile_sections`, `credit_wallets`.
- Academic Profile screen now saves basic profile data and reusable section data to the rewrite database after login.
- The profile editor supports autosave through `/api/profile` and keeps a manual Save button.
- Profile section keys now cover:
  - Research interests.
  - Education.
  - Experience.
  - Publications.
  - Projects.
  - Teaching.
  - Awards.
  - Grants.
  - Conferences.
  - Supervision.
  - Memberships.
  - Languages.
  - References.
- Profile completeness score is calculated on save.

## Required Rewrite Stack Environment Variables

```env
NEXT_PUBLIC_APP_URL=https://rewrite.cvscholar.com
BETTER_AUTH_URL=https://rewrite.cvscholar.com
BETTER_AUTH_SECRET=<random 64 character secret>
REWRITE_WEB_PORT=3240
CF_REWRITE_TUNNEL_TOKEN=<rewrite tunnel token>
REWRITE_DB_NAME=cvscholar_rewrite
REWRITE_DB_USER=cvscholar_rewrite
REWRITE_DB_PASSWORD=<strong database password>
```

The compose file builds with placeholder secrets, then uses the real values only at runtime.

## Deploy Behavior

When `rewrite-web` starts, it runs:

```bash
pnpm --filter @cvscholar/web prisma:deploy
pnpm --filter @cvscholar/web start
```

That applies pending Prisma migrations to the rewrite PostgreSQL database before Next.js starts.

## Verified

Using local dummy rewrite env values:

```bash
pnpm web:typecheck
pnpm web:lint
pnpm web:build
pnpm --filter @cvscholar/web exec prisma validate
```

Applied Prisma migrations:

- `202607050001_stage_2_foundation`
- `202607050002_profile_sections`

## Still Not Added

- Redis/BullMQ.
- PDF workers.
- R2 file storage.
- Google OAuth.
- Billing checkout.
- Data migration from the PHP app.
- Public website publishing.
