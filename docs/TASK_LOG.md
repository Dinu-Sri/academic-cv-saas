# CVScholar — Task Log

Template for tracking changes. Fill a new row for each significant change.

| Date | Task | Type | Files Changed | Migration? | Env Var? | Rebuild? | Redeploy? | Cron? | Rollback Notes |
|------|------|------|---------------|------------|----------|----------|-----------|-------|----------------|
| YYYY-MM-DD | Brief description | feature/fix/docs/infra | `path/file.php` | NNN | yes/no | yes/no | yes/no | yes/no | `git revert` or manual steps |

---

## Legend

- **Type**: `feature` (new capability), `fix` (bug fix), `docs` (documentation), `infra` (Docker/CI/deployment), `refactor` (code restructure)
- **Migration?**: Migration number if new migration created, or `no`
- **Env Var?**: `yes` if new/changed environment variables
- **Rebuild?**: `yes` if Docker image must be rebuilt
- **Redeploy?**: `yes` if Portainer stack must be redeployed
- **Cron?**: `yes` if cron jobs changed
- **Rollback Notes**: How to undo the change safely

---

## Log Entries

| Date | Task | Type | Files Changed | Migration? | Env Var? | Rebuild? | Redeploy? | Cron? | Rollback Notes |
|------|------|------|---------------|------------|----------|----------|-----------|-------|----------------|
| 2026-07-07 | Simplify managed CV layout and field popups | fix | `apps/web/src/components/*`, `apps/web/src/app/cv/*`, `apps/web/src/app/globals.css`, `docs/TASK_LOG.md` | no | no | yes | yes | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-07 | Add managed CV versions and sharper popup PDF preview | feature | `apps/web/prisma/*`, `apps/web/src/app/api/cv/*`, `apps/web/src/app/cv/*`, `apps/web/src/app/profile/*`, `apps/web/src/components/*`, `apps/web/src/lib/*`, `docs/TASK_LOG.md` | Prisma `202607070001_cv_document_versions` | no | yes | yes | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-06 | Expand rewrite CV fields and section picker UX | feature | `apps/web/src/components/*`, `apps/web/src/lib/*`, `apps/web/src/app/api/profile/sections/visibility/*`, `apps/web/src/app/globals.css`, `docs/TASK_LOG.md` | no | no | yes | yes | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-06 | Polish rewrite CV workspace navigation and PDF preview | fix | `apps/web/src/components/*`, `apps/web/src/app/globals.css`, `apps/web/package.json`, `pnpm-lock.yaml`, `docs/TASK_LOG.md` | no | no | yes | yes | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-06 | Add rewrite Phase 4 queued PDF pipeline | feature | `apps/web/*`, `apps/pdf-worker/*`, `docker-compose.rewrite.yml`, `.env.example`, `docs/rewrite/*`, `docs/TASK_LOG.md` | Prisma `202607060001_phase_4_pdf_pipeline` | yes | yes | yes | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Complete rewrite Stage 2 profile sections editor | feature | `apps/web/prisma/*`, `apps/web/src/app/profile/*`, `apps/web/src/components/academic-profile-form.tsx`, `apps/web/src/lib/profile-sections.ts`, `apps/web/src/lib/workspace.ts`, `docs/rewrite/*`, `docs/TASK_LOG.md` | Prisma `202607050002_profile_sections` | no | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Center rewrite screens and add profile save feedback | fix | `apps/web/src/app/profile/*`, `apps/web/src/components/academic-profile-form.tsx`, `apps/web/src/app/globals.css`, `docs/TASK_LOG.md` | no | no | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Add rewrite Stage 2 backend foundation | feature | `apps/web/prisma/*`, `apps/web/src/app/api/auth/*`, `apps/web/src/app/profile/*`, `apps/web/src/lib/*`, `docker-compose.rewrite.yml`, `.env.example`, `.gitignore`, `docs/rewrite/*` | Prisma `202607050001_stage_2_foundation` | yes | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Fix rewrite staging Portainer build and restore status panel | fix | `docker-compose.rewrite.yml`, `apps/web/*`, `docs/rewrite/*`, `docs/TASK_LOG.md` | no | no | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Simplify rewrite app shell navigation and screens | fix | `apps/web/*`, `docs/rewrite/STAGE_1_APP_SHELL.md`, `docs/TASK_LOG.md` | no | no | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-07-05 | Rewrite Stage 1 app shell and staging stack scaffold | feature | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/web/*`, `docker-compose.rewrite.yml`, `docs/rewrite/*`, `.gitignore`, `.env.example` | no | yes | yes | no | no | Stop/remove rewrite Portainer stack, then `git revert` |
| 2026-06-06 | AI agent memory system setup | docs | `AGENTS.md`, `.github/copilot-instructions.md`, `ai/start-session.prompt.md`, `docs/KNOWN_ERRORS.md`, `docs/TASK_LOG.md`, `docs/PRODUCTION_RULES.md`, `.env.example`, `.github/workflows/production-check.yml`, `README.md` | no | no | no | no | no | `git revert` |
| | | | | | | | | | |
