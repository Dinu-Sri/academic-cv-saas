# Rewrite Staging Deployment

This deploys the new Next.js rewrite as a separate live test stack. It does not replace the current PHP production stack at `cvscholar.com`.

## Target

- Current production: existing PHP app remains on the current production stack.
- Rewrite staging: new Portainer stack using `docker-compose.rewrite.yml`.
- Suggested public hostname: `rewrite.cvscholar.com` or `staging.cvscholar.com`.

## Stack Contents

`docker-compose.rewrite.yml` currently runs:

- `rewrite-db`: PostgreSQL for the rewrite staging app only.
- `rewrite-redis`: Redis queue backend for rewrite jobs.
- `rewrite-web`: the standalone Next.js app from `apps/web`.
- `rewrite-pdf-worker`: BullMQ worker that renders Classic LaTeX PDFs with Tectonic.
- `rewrite-import-worker`: BullMQ worker that reads old CV PDFs with OpenAI vision and maps them into profile fields.
- `rewrite-tunnel`: a separate Cloudflare Tunnel container for the rewrite hostname.

R2 is optional. If R2 variables are empty, generated PDFs are stored in the shared Docker volume `rewrite_file_storage`.
Billing is intentionally not added yet.

`rewrite-web` is built from the repository Dockerfile. It does not declare a registry image name, so Portainer should build it instead of trying to pull `cvscholar-rewrite-web` from Docker Hub.

## Required Portainer Environment Variables

Set these on the rewrite stack in Portainer:

```env
NEXT_PUBLIC_APP_URL=https://rewrite.cvscholar.com
BETTER_AUTH_URL=https://rewrite.cvscholar.com
REWRITE_WEB_PORT=3240
CF_REWRITE_TUNNEL_TOKEN=<paste the rewrite tunnel token in Portainer>
REWRITE_DB_NAME=cvscholar_rewrite
REWRITE_DB_USER=cvscholar_rewrite
REWRITE_DB_PASSWORD=<create a strong rewrite database password>
BETTER_AUTH_SECRET=<create a random 64 character secret>
PDF_WORKER_CONCURRENCY=1
CVSCHOLAR_CV_IMPORT_WORKER_CONCURRENCY=1
CVSCHOLAR_CV_IMPORT_MAX_UPLOAD_MB=8
CVSCHOLAR_CV_IMPORT_PAGE_LIMIT=10
CVSCHOLAR_CV_IMPORT_TIMEOUT_MS=90000
CVSCHOLAR_CV_IMPORT_MODEL=gpt-5.4-mini
OPENAI_API_KEY=<paste OpenAI key for old CV imports>

# Optional R2 storage; leave empty to use rewrite_file_storage.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PRIVATE_BUCKET=
```

Do not reuse the current production PHP app tunnel token unless you intentionally configure that same tunnel to route the rewrite hostname.

## Cloudflare Setup

1. In Cloudflare Zero Trust, create a new tunnel for the rewrite staging app.
2. Add a public hostname:
   - Hostname: `rewrite.cvscholar.com`
   - Service type: `HTTP`
   - Service URL: `http://cvscholar-rewrite-web:3000`
3. Copy the tunnel token into `CF_REWRITE_TUNNEL_TOKEN` in the Portainer rewrite stack.

The tunnel container and web container share the same Docker network, so the service URL uses the container name.

## Portainer Deployment

1. Go to Portainer > Stacks > Add stack.
2. Choose repository deployment for this GitHub repo.
3. Set compose path to:

```text
docker-compose.rewrite.yml
```

4. Add the environment variables listed above.
5. Deploy the stack. The web container runs Prisma migrations before starting Next.js.
6. Open the rewrite hostname and confirm the app shell loads.

## Local Build Commands

```bash
pnpm install
pnpm web:typecheck
pnpm web:lint
pnpm web:build
```

Docker build:

```bash
docker compose -f docker-compose.rewrite.yml build rewrite-web
docker compose -f docker-compose.rewrite.yml build rewrite-pdf-worker
docker compose -f docker-compose.rewrite.yml build rewrite-import-worker
```

## Production Impact

- No current PHP app behavior changes.
- No current MySQL migration.
- No current production environment variable is required.
- Rewrite-only Redis and worker containers are added.
- Old CV import requires the rewrite import worker plus `OPENAI_API_KEY`.
- No current `cvscholar.com` DNS change.

## Rollback

Remove or stop the rewrite Portainer stack. The current PHP production stack remains separate.
