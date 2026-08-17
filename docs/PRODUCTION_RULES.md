# CVScholar — Production Rules

Distilled checklist from `AGENTS.md`. Every change must pass these rules before commit.

---

## Hard Prohibitions

- [ ] No hardcoded localhost URLs (e.g., `http://localhost/...`)
- [ ] No hardcoded local file paths (e.g., `C:\xampp\htdocs\...`)
- [ ] No hardcoded passwords, API keys, or secrets
- [ ] No `.env` file committed (it's in `.gitignore`)
- [ ] No `env_file:` in docker-compose.yml (Portainer doesn't support it)
- [ ] No Python/Reflex/PostgreSQL code (legacy stack, not used)
- [ ] No `FpdfRenderer` or `FallbackRenderer` reintroduction
- [ ] No treatment of `LatexService.php` as production renderer

---

## Per-Change Checklist

### 1. Code Changes
- [ ] Uses environment variables for all config values (not hardcoded)
- [ ] Preserves existing working features (additive, not destructive)
- [ ] User input goes through `LatexEscaper::escape()` for LaTeX contexts
- [ ] HTML output uses `e()` helper (nullable-safe)
- [ ] `fields_schema` uses `"name"` key (not `"key"`)
- [ ] CV entitlements use `Auth::user()` (not stale session data)

### 2. Database Changes
- [ ] New migration file: `migrations/NNN_description.sql`
- [ ] Uses `IF NOT EXISTS` / `INSERT IGNORE` for idempotency
- [ ] No transaction wrapping (MySQL DDL auto-commits)
- [ ] Tested locally: `C:\xampp\php\php.exe migrations/migrate.php`
- [ ] Migration number is next in sequence

### 3. Environment Variables
- [ ] New/updated in `.env.example`
- [ ] New/updated in the relevant compose `environment:` block (`docker-compose.yml` or `docker-compose.rewrite.yml`)
- [ ] New/updated in `app/config.php` or rewrite runtime helpers with proper defaults
- [ ] No secrets in committed files

### 4. Docker / Deployment
- [ ] Dockerfile updated if new packages/extensions needed
- [ ] docker-entrypoint.sh updated if new cron jobs or startup steps
- [ ] docker-compose.yml ports/volumes correct

### 5. Documentation
- [ ] `AGENTS.md` updated if architecture/stack/errors change
- [ ] `docs/KNOWN_ERRORS.md` updated for new gotchas
- [ ] `docs/TASK_LOG.md` entry added for this change
- [ ] Meta ads: if changing conversion events, update `docs/META_ADS_TRACKING.md`

### 6. Meta ads (when touching tracking)
- [ ] No CV field values / PDF content in Meta payloads
- [ ] Purchase only on real paid completion (not invites/admin grants)
- [ ] Browser + CAPI share the same `event_id` for dual-path events
- [ ] Pixel never loads on scholar public sites
- [ ] Secrets only in Portainer env (`META_CAPI_ACCESS_TOKEN`); client only gets `NEXT_PUBLIC_META_PIXEL_ID`

### 7. Mobile flow (when touching `/m` or product gates)
- [ ] Phone power routes redirect to `/m` unless `cvscholar_mobile_mode=full`
- [ ] Full editor stays desktop-first; do not rebuild dense desks for phone
- [ ] Guest path works; email handoff requires login
- [ ] See `docs/MOBILE_UX.md`

---

## Local Test Steps

1. **PHP Lint**: `C:\xampp\php\php.exe -l path/to/changed/file.php`
2. **Migration test**: `C:\xampp\php\php.exe migrations/migrate.php`
3. **Browser test**: Visit `http://localhost/academic-cv-saas/public`
4. **Full flow**: Test the changed feature end-to-end on XAMPP

---

## Git Commit & Push

```bash
git add -A
git commit -m "type: brief description

- Detail 1
- Detail 2
- Migration: NNN_description (if applicable)
- Env vars: VAR1, VAR2 (if applicable)"
git push origin master
```

Commit types: `feat`, `fix`, `docs`, `infra`, `refactor`, `style`, `perf`

---

## Production Deploy

1. **Portainer**: Stacks → select `academic-cv-saas` → "Re-pull image and redeploy" (toggle ON)
2. **Monitor**: `docker compose logs app` (or Portainer container logs)
3. **Verify**: Check production URL, test critical paths
4. **Migrations**: Auto-run on container start — check logs for "Migrations complete."

---

## Rollback (Risky Changes)

### Safe Rollback
```bash
git revert <commit-hash>
git push origin master
# Portainer → Re-pull and redeploy
```
Migrations are idempotent — no manual rollback needed for DDL changes.

### Destructive Schema Changes
1. **Before deploy**: Back up production database (phpMyAdmin export or `mysqldump`)
2. **Rollback SQL**: Provide explicit `DROP TABLE` / `ALTER TABLE` statements in commit message
3. Or create a companion migration that undoes the change

### Data Migrations
1. **Always back up** the production database before deploying data-changing migrations
2. Test migration on a copy of production data locally if possible

---

## Quick Reference

| Need | Action |
|------|--------|
| New table/column | Create `migrations/NNN_description.sql` |
| New env var | Update `.env.example` + `docker-compose.yml` + `app/config.php` |
| Rewrite admin cockpit access | Set `CVSCHOLAR_ADMIN_EMAILS` in Portainer / rewrite web env |
| New PHP extension | Update `Dockerfile` RUN apt-get + docker-php-ext-install |
| New cron job | Update `docker-entrypoint.sh` crontab |
| Architecture change | Update `AGENTS.md` section 1, sync derived files |
| New gotcha discovered | Append to `docs/KNOWN_ERRORS.md` + `AGENTS.md` section 7 |
