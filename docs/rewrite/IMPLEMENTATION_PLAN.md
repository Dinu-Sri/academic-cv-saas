# CVScholar Rewrite Implementation Plan

Source: `CVScholar_Rewrite_UI_UX_Technical_Blueprint.pdf` in the repository root.

This plan treats the blueprint as a parallel rewrite, not an in-place refactor of the current PHP/MySQL production app. The existing PHP app should keep serving paying users until the new system passes data migration, feature parity, and rollout gates.

## Ground Rules

- Keep the current PHP app deployable throughout the rewrite.
- Build the new stack in parallel and migrate users gradually.
- Do not change production billing, rendering, or website behavior until the new system has staging parity.
- Every rewrite phase must answer: env vars, database migrations, dependencies, container rebuild, Portainer redeploy, queue/worker restart, cron changes, cache clears, and rollback path.
- Use structured academic profile data as the source of truth for CV PDFs, academic websites, publications pages, short bios, and future institution features.
- Do not let normal users submit raw LaTeX. Generate LaTeX from controlled templates and escaped structured data.
- Preserve existing public URLs where possible: CV shares, `/u/{slug}` academic websites, and generated PDF access.

## Target Architecture

The blueprint target is an app-first SaaS:

- Frontend/app: Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS.
- Auth: Better Auth, workspace-aware session checks.
- Database: PostgreSQL with Prisma first.
- Queues: Redis + BullMQ.
- PDF engine: Tectonic LaTeX in isolated worker containers.
- Storage: Cloudflare R2 for private files, public website assets, generated PDFs, temp artifacts, and logs.
- Email: Resend.
- Analytics/errors: PostHog, Sentry, structured logs, queue monitoring.
- Billing: hybrid credits + subscriptions.
- Public websites: unique scholar/customer subdomain later, with `/u/{slug}` compatibility during migration.

## Phase 0: Rewrite Preparation

Goal: make the rewrite measurable and reversible before coding the new system.

Deliverables:

- Freeze a feature inventory of the current app:
  - Auth and Google OAuth.
  - CV profile creation/editing.
  - Six CV templates and plan gating.
  - LaTeX PDF rendering and metrics.
  - Academic website draft/publish flow.
  - Contact messages.
  - Credits, payments, subscriptions.
  - Imports, mobile handoff, sharing, admin, support, retention jobs.
- Create staging database backup and restore workflow.
- Create target PostgreSQL schema draft from the migration map.
- Decide billing provider strategy:
  - Keep PayHere for Sri Lanka payments, or add/replace with another provider.
  - Preserve current `payments` and `subscriptions` history.
- Decide R2 bucket names and retention policies.
- Decide domain plan:
  - Keep current app domain for dashboard.
  - Keep `/u/{slug}` initially.
  - Add wildcard subdomains only after DNS and abuse protections are ready.
- Define cutover strategy and rollback criteria.

Exit criteria:

- Current-to-target data migration map is reviewed.
- Production backup/restore path is tested.
- Target environment variables are listed but not yet required by production.
- A rewrite branch or separate app workspace is selected.

Production impact:

- No production behavior change.
- No database migration required in the current PHP app.
- No Portainer redeploy required unless docs are deployed.

## Phase 1: App Shell Foundation

Goal: build the Next.js app shell without backend risk.

Deliverables:

- New app workspace, preferably:
  - `apps/web`
  - `apps/workers/pdf-worker`
  - `apps/workers/website-worker`
  - `apps/workers/email-worker`
  - `packages/database`
  - `packages/shared-types`
  - `packages/template-registry`
  - `packages/ui`
- App shell with:
  - Top bar: logo, credits placeholder, plan placeholder, login/account.
  - Left nav: Home, Academic Profile, Build CV, Academic Website, Publications, Files, Billing, Settings.
  - Center workspace.
  - Right status panel.
- Placeholder pages and empty states.
- Design tokens for color, spacing, radius, typography, shadows, forms, status colors.
- Basic responsive behavior: sidebar on desktop, drawer or bottom nav on mobile.

Exit criteria:

- App shell matches the blueprint layout.
- No backend writes.
- Static pages can be built in CI.

Production impact:

- New dependencies and containers only for rewrite workspace.
- No current app migration.

## Phase 2: Auth, Workspaces, and Core Profile

Goal: establish workspace-scoped identity and structured profile data.

Deliverables:

- PostgreSQL + Prisma setup.
- Better Auth integration.
- Tables:
  - `users`
  - `workspaces`
  - `workspace_members`
  - `academic_profiles`
  - `profile_sections`
- Dashboard route protection.
- Login/signup modal from the app shell.
- Auth redirect back to attempted action.
- Academic profile editor:
  - Basics.
  - Personal links.
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
- React Hook Form + Zod validation.
- Autosave and profile completeness score.

Exit criteria:

- Every query is scoped through workspace membership.
- Existing PHP profile data can be imported into staging.
- Profile editor can save all current system-supported section keys.

Production impact:

- New PostgreSQL database and env vars for rewrite only.
- No current production app change.

## Phase 3: Data Migration MVP

Goal: prove current MySQL data can safely migrate to the new structured model.

Deliverables:

- Read-only MySQL extraction script.
- PostgreSQL import script with idempotency.
- Legacy ID mapping tables or metadata:
  - `legacyUserId`
  - `legacyCvProfileId`
  - `legacyUserEntryId`
  - `legacyPublicationId`
  - `legacyWebsiteId`
- Migration report:
  - Counts by table.
  - Failed rows.
  - JSON validation errors.
  - Missing files.
  - Duplicate emails/slugs.
- Staging migration from a copy of production data.

Exit criteria:

- A staging user can log in and see migrated profile, publications, CV configs, websites, credits, and files.
- Migration can be rerun without duplicating records.

Production impact:

- Requires production database backup copy.
- No direct production writes until final cutover.

## Phase 4: PDF Pipeline

Goal: replace synchronous/request-bound rendering with queued rendering.

Deliverables:

- Tables:
  - `cv_templates`
  - `cv_documents`
  - `pdf_render_jobs`
  - `file_assets`
- Redis + BullMQ.
- `pdf-worker` container with Tectonic.
- Controlled template package for one migrated CV template first.
- R2 upload of generated PDFs.
- Job status in right panel and Files screen.
- Friendly user errors, technical admin logs.
- Render timeout, retry policy, input hash, template version.
- Template smoke test for every active template as templates are ported.

Exit criteria:

- PDF generation request enqueues a job and returns immediately.
- Worker completes PDF and stores output in R2.
- Failed jobs are visible and retryable by admin.
- At least one template matches acceptable visual parity.

Production impact:

- New env vars: Redis, R2, worker config.
- New containers: Redis, PDF worker.
- Container rebuild required for Tectonic worker.

## Phase 5: Files and Outputs

Goal: make generated and uploaded assets first-class records.

Deliverables:

- Files screen for generated PDFs, uploaded CVs, website assets, logs where allowed.
- Signed R2 URLs for private downloads.
- Public URLs only for explicitly public website assets/downloads.
- Delete/archive behavior.
- Storage usage display.
- Migration of current `cv_profiles.pdf_path`, mobile uploads, ticket attachments if in scope.

Exit criteria:

- Users can find, download, and delete generated outputs.
- Private files are not directly exposed.
- Missing legacy file paths are reported but do not block unrelated migration.

Production impact:

- R2 buckets and lifecycle policies required.

## Phase 6: Academic Website MVP

Goal: recreate and improve the current academic website feature from structured profile data.

Deliverables:

- Tables:
  - `academic_websites`
  - `website_publish_jobs`
  - optional `website_published_snapshots`
- Website settings page:
  - slug/subdomain.
  - template.
  - headline.
  - profile image.
  - section visibility.
  - private field visibility.
  - single-page/multi-page mode.
  - downloadable CV selection.
  - contact form toggle.
- Public route:
  - keep `/u/{slug}`.
  - later add `username.cvscholar.com`.
- Reserved slug/subdomain validation.
- Contact form:
  - rate limiting.
  - spam protection.
  - Resend forwarding.
  - do not expose owner email by default.
- Port the approved website template design.
- SEO: title, description, canonical URL, Open Graph.

Exit criteria:

- Migrated websites render from migrated profile data.
- Draft and published states work.
- Published websites can be previewed and served publicly.
- Current `/u/{slug}` links remain functional or redirect cleanly.

Production impact:

- Website worker is optional for MVP if publish is a database snapshot operation, but required before heavy asset generation.
- DNS/wildcard subdomain work is deferred until after `/u/{slug}` parity.

## Phase 7: Billing and Credits

Goal: separate plan access from usage credits.

Deliverables:

- Tables:
  - `credit_wallets`
  - `credit_transactions`
  - `subscriptions`
  - `usage_events`
  - plan/template access records.
- Import current `users.credit_balance`, `credit_transactions`, `payments`, `subscriptions`.
- Billing screen:
  - credit balance.
  - plan.
  - usage history.
  - receipts/invoices if available.
- Transaction-safe credit deduction for selected actions.
- Free preview / charge on final export or publish where appropriate.

Exit criteria:

- Ledger balances reconcile with current app balances.
- Credit deduction is idempotent.
- Refund/grant path exists for admin.
- Users do not lose paid access during migration.

Production impact:

- Payment provider decision required before checkout implementation.
- Billing cutover needs extra manual verification and rollback plan.

## Phase 8: Admin, Monitoring, and QA

Goal: make the rewrite operable.

Deliverables:

- Admin areas:
  - users and workspaces.
  - PDF jobs.
  - website jobs.
  - templates.
  - billing/credits.
  - abuse.
  - system health.
- Sentry for frontend, API, workers.
- PostHog product events:
  - activation.
  - profile completion.
  - template selection.
  - PDF generation funnel.
  - website publishing funnel.
  - billing funnel.
- Queue dashboard.
- Uptime checks.
- Tests:
  - unit tests for transforms/validation/billing/subdomain validation.
  - API tests for profile/CV/website/files/billing.
  - worker tests for PDF and website jobs.
  - Playwright tests for login modal, profile creation, PDF request, website publish.
  - template smoke tests.

Exit criteria:

- Admin can inspect and retry failed jobs.
- Core flows are covered in CI.
- Release has a clear version tag in Sentry/logs.

Production impact:

- New env vars for Sentry/PostHog.
- Test and monitoring tooling added to deploy process.

## Phase 9: Staging Parity and Cutover

Goal: move from parallel rewrite to production safely.

Deliverables:

- Full staging migration from production backup.
- Parity checklist:
  - user login.
  - profile data.
  - CV PDFs.
  - files/downloads.
  - academic websites.
  - credits/subscriptions.
  - admin/support workflows.
- Beta group.
- DNS and route plan.
- Read-only window or dual-write decision for final migration.
- Rollback procedure.

Exit criteria:

- Beta users can complete their core workflows.
- No critical data mismatch in migration report.
- Production backup is verified.
- Rollback to PHP app is documented and tested.

## Recommended First Build Prompt

Start with a small, non-destructive first prompt:

> Build the CVScholar Next.js app shell in a separate rewrite workspace. Use Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui. Create top bar, left navigation, central workspace, and right status panel. Add placeholder screens for Home, Academic Profile, Build CV, Academic Website, Publications, Files, Billing, and Settings. Do not implement backend, auth, database, PDF rendering, billing, or deployment yet.

## Current App Features That Must Not Be Lost

- PHP session auth and Google OAuth.
- Existing users, plans, and credits.
- Current six CV templates and plan gating.
- LaTeX-only production PDF renderer.
- CV sharing links.
- Academic website draft/publish flow and contact messages.
- Mobile CV flow.
- Import queue and AI CV import.
- Support tickets and admin tools.
- Email retention and reminder cron jobs.
- Analytics events and behavior tracking.
- PayHere payment history.

## Deployment Notes

- The current production workflow remains: push to `master`, then Portainer stack redeploy.
- The rewrite should not replace that workflow until Phase 9.
- The rewrite can initially deploy as a separate Portainer stack or staging domain.
- Any Dockerfile, compose, env var, or worker change requires explicit deployment notes in the related commit.
