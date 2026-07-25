# CVScholar — AI Agent Instructions

> **Single source of truth.** All other AI instruction files (`.github/copilot-instructions.md`, `ai/start-session.prompt.md`) derive from this document. When architecture, deployment, environment variables, known errors, or stack details change, update this file **in the same commit** and sync the derived files.

---

## 0. Production-First Mandate

This is a **production SaaS application** with paying users. Every change must treat the system as production-first, never local-only.

### Hard Rules

1. **Never hardcode** localhost URLs, local file paths (e.g., `C:\xampp\htdocs\...`), passwords, API keys, or secrets.
2. **Always use environment variables** — read from `$_ENV` / `getenv()` / docker-compose `environment:` block.
3. **Preserve existing working features.** Do not rewrite or refactor unless necessary. Additive changes preferred.
4. **Document database changes** with a numbered migration file in `migrations/`.
5. **Every change must answer:** does this require an environment variable update, dependency installation, container rebuild, Portainer stack redeploy, cache clear, queue/worker restart, cron update, or database migration?

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | PHP 8.2, vanilla MVC (no framework) |
| Database | MySQL 8.0 |
| Frontend | Bootstrap 5.3.3, vanilla JavaScript |
| PDF Engine | **LaTeX-only** via `xelatex` (`LatexRenderer.php`) |
| Auth | Session-based (`app/Auth.php`) + Google OAuth (`GoogleAuthService.php`) |
| Payments | PayHere (Sri Lanka) |
| Analytics | PostHog, Google Analytics |
| AI Import | OpenAI vision extraction + DeepSeek V4 Pro reasoning/mapping |
| Container | Docker (PHP 8.2 Apache + TeX Live) |
| Orchestration | Portainer |


### Rendering Architecture (Critical)

- **Production renderer**: `app/services/LatexRenderer.php` — builds LaTeX from scratch, compiles with xelatex.
- **Factory**: `app/services/RendererFactory.php` — resolves engine preference; normalizes legacy `"fpdf"` to `"latex"` at runtime.
- **LEGACY (do NOT use for production)**: `app/services/LatexService.php` — old FPDF helper code, kept for demo/text flows only.
- `FpdfRenderer` and `FallbackRenderer` are **removed**. Do not reintroduce them.
- LaTeX fragments stored in DB (`latex_header`, `latex_footer`, `latex_code`) are **NOT used** by the production renderer.

---

## 2. Two Environments

### Local Development (XAMPP)

- URL: `http://localhost/academic-cv-saas/public`
- MySQL: `localhost:3306`, user `root`, no password, database `academic_cv`
- Config: `app/config.php` reads `.env` if it exists; otherwise hardcoded XAMPP defaults
- PHP: `C:\xampp\php\php.exe` (may not be in PATH — use full path for lint/scripts)
- **Never commit `.env`** — it's in `.gitignore`

### Production (Docker via Portainer)

- Docker Compose services: `cvscholar-app` (PHP Apache :8080), `cvscholar-db` (MySQL :3307), `cvscholar-pma` (phpMyAdmin :8082), `cvscholar-tunnel` (Cloudflare, optional)
- Environment variables set directly in `docker-compose.yml` `environment:` block — **Portainer does NOT support `env_file:`**
- Entrypoint `docker-entrypoint.sh`: configures PHP limits from env vars → waits for MySQL → runs migrations → smoke-tests xelatex → starts cron → starts Apache
- Cron jobs (in-container): `expire_subscriptions.php` (hourly), `email_retention.php` (daily 8:30), `draft_stall_detector.php` (hourly), `editor_reliability_guard.php` (every 15min), `process_import_queue.php` (every minute + dedicated loop runner)

---

## 3. Deployment Workflow

```
1. Develop & test locally on XAMPP
2. git add -A && git commit -m "message" && git push origin master
3. Portainer → Stacks → select stack → "Re-pull image and redeploy" (toggle ON)
4. Container auto-runs migrations on start (docker-entrypoint.sh)
```

- **GitHub**: `https://github.com/Dinu-Sri/academic-cv-saas` (public, branch `master`)
- **Portainer**: `https://109.199.125.98:9443`
- **Rollback**: `git revert` the commit, push, redeploy in Portainer. Migrations are idempotent with `INSERT IGNORE` / `IF NOT EXISTS` — no manual rollback needed for DDL in most cases. For destructive schema changes, provide explicit rollback SQL.

---

## 4. Migration System

- **Location**: `migrations/*.sql`
- **Runner**: `php migrations/migrate.php` (local) or auto-runs in Docker entrypoint
- **Tracking table**: `_migrations` (`id`, `filename`, `applied_at`)
- **Naming**: `NNN_descriptive_name.sql` (lexicographic sort order determines execution)
- **Idempotency**: Use `INSERT IGNORE`, `IF NOT EXISTS`, `IF EXISTS` — MySQL DDL auto-commits, so **never wrap migrations in transactions**
- **Multistatement**: Runner enables `PDO::ATTR_EMULATE_PREPARES = true`

### Creating a New Migration

1. Create `migrations/NNN_description.sql` with the next number
2. Use `IF NOT EXISTS` / `INSERT IGNORE` for idempotency
3. Test locally: `C:\xampp\php\php.exe migrations/migrate.php`
4. Include in commit; migrations auto-run on next deploy

---

## 5. Template System

- **6 templates**: Classic (id=1), Modern (id=2), Detailed (id=3), Classic Faculty (id=4, Pro), European Formal (id=5, Pro), Research Dossier (id=6, Pro)
- Free plan: templates 1-3, max 2 CVs. Pro plan: all 6, max 20 CVs.
- **`fields_schema` JSON format**: `[{"name":"field_name","label":"...","type":"text","required":true}]`
- **Uses `"name"` key — NOT `"key"`** (critical for editor forms)
- Sections vary by template; see `migrations/002_seed_templates.sql` and `migrations/013_pro_templates.sql`

---

## 6. Key Files Reference

| File | Purpose |
|------|---------|
| `app/config.php` | All config constants, reads env vars with XAMPP fallbacks |
| `app/Database.php` | PDO singleton |
| `app/Auth.php` | Session auth (`Auth::user()`, `Auth::check()`, `Auth::requireLogin()`) |
| `app/Router.php` | Pattern-based URL router |
| `app/helpers.php` | `e()` (nullable-safe HTML escape), `old()`, flash messages |
| `public/index.php` | Entry point, autoloader, route definitions, `.env` loading |
| `app/services/LatexRenderer.php` | **Production** xelatex PDF renderer |
| `app/services/RendererFactory.php` | PDF engine selection + normalization |
| `app/services/CvDataNormalizer.php` | CV data cleaning before rendering |
| `app/services/LatexEscaper.php` | User input escaping for LaTeX |
| `app/services/ProfileImportService.php` | ORCID/Scholar import + master data sync |
| `app/services/AiCvImportService.php` | OpenAI CV PDF import |
| `app/models/CVProfile.php` | CV profiles, central profile (archive), sync logic |
| `app/models/Template.php` | Template access + plan gating |
| `app/controllers/CVController.php` | CV CRUD + compilation |
| `docker-compose.yml` | Service definitions + env vars |
| `docker-compose.rewrite.yml` | Rewrite staging stack services + Next.js/worker env vars |
| `apps/web/src/lib/website/composition-engine.ts` | Rewrite academic website page qualification, sparse-content merging, and adaptive navigation |
| `apps/web/src/lib/website/site-engine/` | Site Composition Engine: deterministic CV→Site IR pipeline (`buildSiteIR`) |
| `apps/web/src/lib/website/themes/` | Theme registry (`paper-academic-v1` default; multi-theme ready) |
| `apps/web/src/components/website/site-ir-renderer.tsx` | Thin IR + theme renderer (no composition logic) |
| `apps/web/src/lib/website/section-registry.ts` | Rewrite mapping from academic profile sections to Research, Academic Journey, and Contributions |
| `docs/rewrite/SITE_COMPOSITION_ENGINE.md` | Architecture: draft live IR, publish freezes IR + themeId |
| `content/blog/*.md` | Product blog posts (YAML frontmatter + markdown); served by rewrite at `/blog` |
| `content/legal/*.md` | Product privacy/terms/cookies/refund policies; served at `/privacy`, `/terms`, `/cookie-policy`, `/refund-policy` |
| `apps/web/src/lib/content/` | Rewrite loaders for blog + legal markdown (`blog.ts`, `legal.ts`, `markdown.ts`) |
| `apps/web/src/lib/support/` | Support portal service, emails, types (tickets + image attachments) |
| `apps/web/src/app/support/` | Logged-in user support UI |
| `apps/web/src/app/admin/support/` | Admin support ticket queue + reply UI |
| `docker-entrypoint.sh` | Container startup: PHP config, MySQL wait, migrations, cron |
| `Dockerfile` | PHP 8.2 Apache + TeX Live xelatex (~1.2 GB image) |

---

## 7. Common Gotchas

1. **`e()` helper** in `app/helpers.php` accepts `?string` (nullable) — fields can be `null`.
2. **MySQL DDL auto-commits** — never wrap migrations in transactions.
3. **Portainer doesn't support `env_file:`** — use direct `environment:` block in compose.
4. **CV compile/download entitlement** — use `Auth::user()` and the plan-feature matrix, **not** stale session plan data.
5. **xelatex smoke test** on container start is non-fatal — if it fails, PDF requests return structured LaTeX errors until the toolchain is fixed.
6. **`LatexService.php` is LEGACY** — do not treat it as the production renderer.
7. **Old Python/Reflex/PostgreSQL files** are legacy artifacts — ignore them. This is a pure PHP project.
8. **Migrations use `INSERT IGNORE`** — they silently skip duplicates. If you need upsert behavior, use `ON DUPLICATE KEY UPDATE`.
9. **Section rendering order**: declarations → references → publications → others (special ordering in `LatexRenderer`).
10. **Rewrite admin cockpit access**: `/admin` in the Next.js rewrite is gated by `CVSCHOLAR_ADMIN_EMAILS` (comma-separated emails, with `ADMIN_EMAIL` fallback). Set it in Portainer before expecting the cockpit to open.
12. **Google login (rewrite)**: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in Portainer (`docker-compose.rewrite.yml`). Callback URL must allow `{BETTER_AUTH_URL}/api/auth/callback/google`. Password reset emails need `RESEND_API_KEY` + `EMAIL_FROM`.
13. **Custom domains (Scholar Annual)**: users CNAME hostname to `CVSCHOLAR_CUSTOM_DOMAIN_CNAME_TARGET` (default `sites.cvscholar.com`) + TXT `_cvscholar-verify.{host}` token. Middleware resolves via `/api/public/domain-lookup`. Optional Cloudflare Custom Hostnames: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CVSCHOLAR_CUSTOM_DOMAIN_CF_ENABLED=1`. Domains auto-pause when Scholar Annual expires.
11. **Rewrite academic websites are composition-driven**: public navigation must come from `composition-engine.ts` via Site IR (`site-engine/buildSiteIR`). Do not reintroduce one-route-per-profile-section checks or render empty category pages. Draft previews recompose live; published sites freeze IR in the snapshot. Theme default is `paper-academic-v1` (multi-theme ready).

---

## 8. Per-Change Checklist

For every code change, check which of these apply:

- [ ] **Environment variable** — new or changed? Update `.env.example`, the relevant compose `environment:` block (`docker-compose.yml` or `docker-compose.rewrite.yml`), and app config/runtime helpers.
- [ ] **Database migration** — new table, column, or seed data? Create `migrations/NNN_description.sql`.
- [ ] **Dependency** — new PHP extension or apt package? Update `Dockerfile`.
- [ ] **Container rebuild** — Dockerfile changed? Requires `docker compose build` or Portainer redeploy.
- [ ] **Portainer redeploy** — any production config or code change requires stack redeploy.
- [ ] **Cache clear** — template/view changes may need `storage/temp/*` cleared.
- [ ] **Cron update** — new scheduled task? Update `docker-entrypoint.sh` crontab.
- [ ] **Queue/worker restart** — import queue runner changes? Update `docker-entrypoint.sh`.

### Commit & Deploy Steps

1. **Local test**: Verify on XAMPP at `http://localhost/academic-cv-saas/public`
2. **PHP lint**: `C:\xampp\php\php.exe -l app/path/to/file.php`
3. **Git**: `git add -A && git commit -m "type: description" && git push origin master`
4. **Deploy**: Portainer → Stack → Re-pull image and redeploy
5. **Verify**: Check live at production URL, check `docker compose logs app` for errors

### Rollback (Risky Changes)

- **Safe**: `git revert <commit>`, push, redeploy. Migrations are idempotent.
- **Destructive schema changes**: Provide explicit rollback SQL in the commit message or a companion migration.
- **Data migrations**: Always back up the production database before deploying (`mysqldump` or phpMyAdmin export).

---

## 9. Update Process

When any of the following change, update `AGENTS.md` **in the same commit** and sync `README.md` if needed:

- Tech stack or architecture
- Deployment workflow or Portainer config
- Environment variables (add/remove/rename)
- Known errors or gotchas
- Key file paths or service responsibilities
- Rendering pipeline or template system rules

Derived files to keep in sync:
- `.github/copilot-instructions.md` — VS Code Copilot context (subset of AGENTS.md)
- `ai/start-session.prompt.md` — reference list only (file paths, no content duplication)
- `docs/KNOWN_ERRORS.md` — append new errors as discovered
- `docs/PRODUCTION_RULES.md` — distill rule changes into checklist format

---

## 10. Start-of-Session Instructions for AI

When starting a new AI coding session on this project, the assistant should:

1. Read `AGENTS.md` (this file)
2. Read `.github/copilot-instructions.md`
3. Read `docs/PRODUCTION_RULES.md`
4. Read `docs/KNOWN_ERRORS.md`
5. Read `DEPLOYMENT.md` (if deployment-related work)
6. Check `migrations/` for the latest migration number

Use `ai/start-session.prompt.md` as a reusable prompt template for any AI tool.
