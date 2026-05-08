# CVScholar - Project Context for AI

## Architecture
- Pure PHP 8.2 MVC (no framework), MySQL 8.0, Bootstrap 5.3.3
- Production CV PDF compilation is LaTeX-only via `app/services/RendererFactory.php` → `LatexRenderer.php` (xelatex)
- `FpdfRenderer` and `FallbackRenderer` were removed. Legacy `fpdf` config values are normalized to `latex` at runtime.
- `LatexService.php` is legacy/helper code for LaTeX text/demo flows and still contains old FPDF routines; do not treat it as the production renderer.
- Old Python/Reflex/PostgreSQL files are legacy — ignore them

## Two Environments
### Local (XAMPP)
- URL: `http://localhost/academic-cv-saas/public`
- MySQL: localhost:3306, root, no password, database `academic_cv`

### Live (Docker via Portainer)
- Docker: PHP 8.2 Apache + MySQL 8.0 + phpMyAdmin
- Compose file: `docker-compose.yml` (root) — env vars set directly (not env_file)
- Entrypoint: `docker-entrypoint.sh` — waits for MySQL, runs migrations, starts Apache

## Deployment Workflow
1. Develop locally on XAMPP
2. `git push origin master`
3. Portainer: Stack → Pull and redeploy (toggle ON "Re-pull image and redeploy")
4. Migrations auto-run on container start

## Migration System
- Location: `migrations/*.sql`, runner: `migrations/migrate.php`
- Tracking table: `_migrations`
- No transaction wrapping (MySQL auto-commits DDL)
- Uses INSERT IGNORE / IF NOT EXISTS for idempotency

## Template System
- 3 templates: Classic (id=1), Modern (id=2), Detailed (id=3)
- 7 sections each: personal_info, education, experience, publications, skills, awards, references
- `fields_schema` format: JSON array `[{"name":"...","label":"...","type":"...","required":true}]`
- Uses `"name"` key (NOT `"key"`)

## Common Gotchas
- `e()` helper in `app/helpers.php` accepts `?string` (nullable) — fields can be null
- MySQL DDL auto-commits — never wrap migrations in transactions
- Portainer doesn't support `env_file:` — use direct `environment:` block
- CV compile/download entitlement should use the current user row from `Auth::user()` and the plan-feature matrix, not stale session plan data.
