# CVScholar — VS Code Copilot Instructions

> **Derived from `AGENTS.md`** — the canonical source. This file contains the subset relevant to VS Code Copilot sessions. For full context, read `AGENTS.md`.

## Architecture
- Pure PHP 8.2 MVC (no framework), MySQL 8.0, Bootstrap 5.3.3
- Rewrite academic websites use `apps/web/src/lib/website/composition-engine.ts` and `section-registry.ts` to build adaptive Research, Academic Journey, and Contributions pages.
- Production CV PDF compilation is LaTeX-only via `app/services/RendererFactory.php` → `LatexRenderer.php` (xelatex)
- AI reasoning uses DeepSeek V4 Pro thinking mode; OpenAI is reserved for PDF/image extraction.
- `FpdfRenderer` and `FallbackRenderer` were removed. Legacy `fpdf` config values are normalized to `latex` at runtime.
- `LatexService.php` is legacy/helper code — do not treat it as the production renderer.
- Old Python/Reflex/PostgreSQL files are legacy — ignore them.

## Production-First Mandate
- **Never hardcode** localhost URLs, local file paths (`C:\xampp\htdocs\...`), passwords, API keys, or secrets.
- **Always use environment variables** — read from `$_ENV` / `getenv()` / docker-compose `environment:` block.
- **Preserve existing working features.** Additive changes preferred over rewrites.
- **Every change must consider**: env var update? migration? container rebuild? Portainer redeploy? cron update?

## Two Environments
### Local (XAMPP)
- URL: `http://localhost/academic-cv-saas/public`
- MySQL: localhost:3306, root, no password, database `academic_cv`
- PHP: `C:\xampp\php\php.exe` (may not be in PATH)

### Live (Docker via Portainer)
- Docker: PHP 8.2 Apache + MySQL 8.0 + phpMyAdmin
- Compose file: `docker-compose.yml` (root) — env vars set directly (not env_file)
- Entrypoint: `docker-entrypoint.sh` — waits for MySQL, runs migrations, starts Apache + cron
- Portainer doesn't support `env_file:` — use direct `environment:` block
- Rewrite `/admin` cockpit is gated by `CVSCHOLAR_ADMIN_EMAILS` in the rewrite web container environment.

## Deployment Workflow
1. Develop locally on XAMPP → test at `http://localhost/academic-cv-saas/public`
2. `git push origin master`
3. Portainer: Stack → Pull and redeploy (toggle ON "Re-pull image and redeploy")
4. Migrations auto-run on container start

## Migration System
- Location: `migrations/*.sql`, runner: `migrations/migrate.php`
- Tracking table: `_migrations`
- No transaction wrapping (MySQL auto-commits DDL)
- Uses INSERT IGNORE / IF NOT EXISTS for idempotency
- Test locally: `C:\xampp\php\php.exe migrations/migrate.php`

## Template System
- 6 templates: Classic (id=1), Modern (id=2), Detailed (id=3), Classic Faculty (id=4, Pro), European Formal (id=5, Pro), Research Dossier (id=6, Pro)
- `fields_schema` format: JSON array `[{"name":"...","label":"...","type":"...","required":true}]`
- Uses `"name"` key (NOT `"key"`) — critical for editor forms

## Key Files
| File | Purpose |
|------|---------|
| `app/config.php` | Config constants, env vars with XAMPP defaults |
| `app/Auth.php` | Session auth (`Auth::user()`, `Auth::check()`, `Auth::requireLogin()`) |
| `app/Database.php` | PDO singleton |
| `app/Router.php` | Pattern-based URL router |
| `app/helpers.php` | `e()` (nullable-safe), `old()`, flash messages |
| `public/index.php` | Entry point, autoloader, routes |
| `app/services/LatexRenderer.php` | Production xelatex renderer |
| `app/services/RendererFactory.php` | Engine selection + normalization |
| `app/models/CVProfile.php` | CV profiles, central profile sync |
| `docker-compose.yml` | Service definitions + env vars |
| `docker-entrypoint.sh` | Container startup script |
| `Dockerfile` | PHP 8.2 Apache + TeX Live |

## Common Gotchas
- Rewrite website navigation is content-qualified; weak categories merge into Home or Academic Journey instead of publishing empty pages.
- `e()` helper in `app/helpers.php` accepts `?string` (nullable) — fields can be null
- MySQL DDL auto-commits — never wrap migrations in transactions
- Portainer doesn't support `env_file:` — use direct `environment:` block
- Rewrite `/admin` cockpit access requires `CVSCHOLAR_ADMIN_EMAILS` (comma-separated admin emails)
- CV compile/download entitlement should use the current user row from `Auth::user()` and the plan-feature matrix, not stale session plan data
- `LatexService.php` is LEGACY — do not treat as production renderer

## Per-Change Checklist
For every change, check: env var? migration? Dockerfile? rebuild? redeploy? cache clear? cron? queue?
