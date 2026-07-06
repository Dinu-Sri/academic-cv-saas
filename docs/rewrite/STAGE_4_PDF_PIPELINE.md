# Stage 4 PDF Pipeline

Stage 4 moves rewrite PDF generation from the web request path to a queued worker path.

## Added

- Redis service in `docker-compose.rewrite.yml`.
- `apps/pdf-worker` BullMQ worker.
- Tectonic LaTeX in the PDF worker container.
- Prisma tables:
  - `cv_templates`
  - `pdf_render_jobs`
  - `file_assets`
- Classic Academic template registry row.
- `/api/cv/compile` now creates a `pdf_render_jobs` row and enqueues BullMQ work.
- `/api/cv/jobs/{id}` reports queued, processing, completed, and failed states.
- `/api/cv/download` downloads the latest generated file asset.
- R2 storage support through S3-compatible Cloudflare R2 environment variables.
- Local Docker volume fallback through `rewrite_file_storage` when R2 is not configured.

## Required / Optional Environment Variables

Required for queue processing:

```env
REDIS_URL=redis://rewrite-redis:6379
PDF_WORKER_CONCURRENCY=1
CVSCHOLAR_FILE_STORAGE_DIR=/app/storage
```

Optional but recommended for production-like staging:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PRIVATE_BUCKET=
R2_PUBLIC_BUCKET=
R2_TEMP_BUCKET=
R2_LOGS_BUCKET=
R2_PUBLIC_BASE_URL=
```

If R2 variables are empty, generated PDFs stay in the shared Docker volume.

## Deploy Behavior

Portainer must rebuild and redeploy the rewrite stack because the compose file and worker image changed.

Services involved:

- `rewrite-web`: enqueues PDF jobs and serves downloads.
- `rewrite-redis`: BullMQ queue backend.
- `rewrite-pdf-worker`: consumes PDF jobs, compiles LaTeX, stores file assets.
- `rewrite-db`: stores job, template, document, and file records.

## Rollback

Stop/remove the rewrite stack or `git revert` the Stage 4 commit and redeploy. The current PHP production app is unaffected.
