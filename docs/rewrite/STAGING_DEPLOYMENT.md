# Rewrite Staging Deployment

This deploys the new Next.js rewrite as a separate live test stack. It does not replace the current PHP production stack at `cvscholar.com`.

## Target

- Current production: existing PHP app remains on the current production stack.
- Rewrite staging: new Portainer stack using `docker-compose.rewrite.yml`.
- Suggested public hostname: `rewrite.cvscholar.com` or `staging.cvscholar.com`.

## Stack Contents

`docker-compose.rewrite.yml` currently runs:

- `rewrite-db`: PostgreSQL for the rewrite staging app only.
- `rewrite-web`: the standalone Next.js app from `apps/web`.
- `rewrite-tunnel`: a separate Cloudflare Tunnel container for the rewrite hostname.

Redis, workers, R2, and billing are intentionally not added yet. They will be added as the rewrite backend stages continue.

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
```

## Production Impact

- No current PHP app behavior changes.
- No current MySQL migration.
- No current production environment variable is required.
- No current cron, queue, or worker changes.
- No current `cvscholar.com` DNS change.

## Rollback

Remove or stop the rewrite Portainer stack. The current PHP production stack remains separate.
