# CVScholar - Deployment Guide (Portainer + GitHub)

## Architecture

```
Portainer Stack
+---------------------------------------------+
|                                             |
|  +--------------+    +------------------+   |
|  | cvscholar-   |    | cvscholar-db     |   |
|  | app          |--->| MySQL 8.0        |   |
|  | PHP 8.2      |    | Volume: data     |   |
|  | Apache       |    +------------------+   |
|  | :8080        |                           |
|  +--------------+    +------------------+   |
|                      | cvscholar-pma    |   |
|                      | phpMyAdmin       |   |
|                      | :8081            |   |
|                      +------------------+   |
+---------------------------------------------+
```

## First-Time Setup

### 1. Push Code to GitHub

```bash
cd /path/to/academic-cv-saas
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/academic-cv-saas.git
git push -u origin main
```

### 2. Clone on Your Server

```bash
ssh your-server
cd /opt
git clone https://github.com/YOUR_USER/academic-cv-saas.git
cd academic-cv-saas
```

### 3. Create .env File

```bash
cp .env.example .env
nano .env
```

Fill in your values:
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://YOUR_SERVER_IP:8080

MYSQL_ROOT_PASSWORD=your_strong_root_password
MYSQL_DATABASE=academic_cv
MYSQL_USER=cvscholar
MYSQL_PASSWORD=your_strong_db_password

DB_HOST=db
DB_PORT=3306
DB_NAME=academic_cv
DB_USER=cvscholar
DB_PASS=your_strong_db_password
```

### 4. Deploy with Docker Compose

```bash
docker compose up -d --build
```

This will:
- Build the PHP app image
- Start MySQL 8.0 with persistent volume
- Start phpMyAdmin on port 8081
- Auto-run database migrations on app start

### 5. Verify

```bash
docker compose ps
docker compose logs app
curl http://localhost:8080
```

## Deploying via Portainer

### Option A: Git Repository (Recommended)

1. Open Portainer > Stacks > Add Stack
2. Select Repository
3. Enter your GitHub repo URL
4. Set Compose path: docker-compose.yml
5. Add environment variables (same as .env) under Environment variables
6. Click Deploy the stack

### Option B: Upload Compose File

1. Open Portainer > Stacks > Add Stack
2. Select Web editor
3. Paste the contents of docker-compose.yml
4. Add environment variables
5. Click Deploy the stack

## Updating the App

### Quick Update (from server)

```bash
cd /opt/academic-cv-saas
bash update.sh
```

This pulls latest code, rebuilds the app container, and restarts it. Database stays untouched. Migrations run automatically.

### Manual Update

```bash
cd /opt/academic-cv-saas
git pull origin main
docker compose build app
docker compose up -d app
```

### From Portainer

If using Git Repository deployment:
1. Go to Stacks > your stack
2. Click Pull and redeploy
3. Check "Re-pull image and redeploy"
4. Click Update

## Database Migrations

Migrations run automatically on every container start. The system:

1. Tracks applied migrations in _migrations table
2. Scans migrations/*.sql files in sorted order
3. Applies only new (unapplied) migrations
4. Uses transactions - if a migration fails, it rolls back

### Adding a New Migration

Create a new .sql file in migrations/:

```
migrations/
  001_initial_schema.sql     <- Already applied
  002_seed_templates.sql     <- Already applied
  003_add_new_column.sql     <- New - will be applied on next deploy
```

Naming convention: NNN_description.sql (e.g., 003_add_profile_photo.sql)

Rules for safe migrations:
- Use CREATE TABLE IF NOT EXISTS
- Use INSERT IGNORE for seed data
- Never use DROP TABLE or DROP COLUMN without a backup
- Never use TRUNCATE on user tables

### Manual Migration Run

```bash
docker exec -it cvscholar-app php migrations/migrate.php
```

## Accessing phpMyAdmin

- URL: http://YOUR_SERVER_IP:8081
- Server: db
- Username: value of MYSQL_USER (e.g., cvscholar)
- Password: value of MYSQL_PASSWORD

## Ports

| Service     | Port | Purpose            |
|-------------|------|--------------------|
| App         | 8080 | CVScholar web app  |
| phpMyAdmin  | 8081 | Database admin     |
| MySQL       | 3307 | DB (mapped to 3307 to avoid conflicts) |

## Backup and Restore

### Backup Database

```bash
docker exec cvscholar-db mysqldump -u root -p academic_cv > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker exec -i cvscholar-db mysql -u root -p academic_cv < backup_20240101.sql
```

## Troubleshooting

### App won't start
```bash
docker compose logs app
docker compose logs db
```

### Migration failed
```bash
docker exec -it cvscholar-app php migrations/migrate.php
```

### Static files not updating after deploy (Cloudflare cache)

Since CVScholar uses Cloudflare Tunnel, Cloudflare aggressively caches static assets (SVGs, CSS, JS, images). If you update static files and they don't appear after redeploying:

1. Go to **Cloudflare Dashboard** > your domain > **Caching** > **Configuration**
2. Click **Purge Everything**
3. Alternatively, use `?v=N` query strings on asset URLs in templates (bump the number to bust cache)

If you also need to update files directly inside the running container (quick fix without rebuild):
```bash
docker exec -it cvscholar-app bash
curl -o /var/www/html/public/assets/path/to/file.svg https://source-url/file.svg
```
Then purge Cloudflare cache.

### Editor incident rollback playbook (Add Entry/Compile broken)

Use this when users report editor buttons doing nothing or behavior logs show `js_error` spikes on `/cv/edit/*`.

1. Confirm incident quickly
```bash
curl -s https://cvscholar.com/assets/js/editor.js | sed -n '228,238p'
```
Check for suspicious orphan chains like a leading `.then(...)` after a closed block.

2. Verify latest fix exists on GitHub
```bash
git fetch origin
git log origin/master --oneline -5
```

3. Redeploy cleanly (no stale build context)
```bash
cd /opt/academic-cv-saas
git checkout master
git pull origin master
docker compose build --no-cache app
docker compose up -d app
```

4. Purge CDN cache for editor asset
- Cloudflare Dashboard -> Caching -> Purge
- Purge URL: `/assets/js/editor.js` (or Purge Everything during incidents)

5. Smoke test critical path
- Open `/cv/edit/{id}`
- Click `Add Entry` in at least one section
- Click `Compile PDF`
- Confirm preview/update works and no console syntax errors appear

6. Verify telemetry recovery
- Check behavior analytics for last 30 minutes:
   - `js_error` on `/cv/edit/*` returns to baseline
   - `rage_click` trend declines

7. If still failing
- Roll forward with a hotfix commit (preferred) and redeploy.
- Avoid container file edits as a permanent solution; if used as emergency patch, mirror same change in git immediately.

### Reset everything (CAUTION: deletes all data)
```bash
docker compose down -v
docker compose up -d --build
```

---

## Custom Domain with Cloudflare Tunnel

This allows you to expose CVScholar via `https://cvscholar.com` without opening any ports on your server.

### How It Works

```
User → cvscholar.com → Cloudflare CDN (SSL) → Cloudflare Tunnel → cvscholar-tunnel container → cvscholar-app:80
```

No ports (8080, 8082, 3307) need to be exposed to the internet. The tunnel creates an outbound-only connection from your server to Cloudflare.

### Step-by-Step Setup

#### 1. Buy Domain & Add to Cloudflare
1. Purchase `cvscholar.com` from any registrar (Namecheap, Porkbun, etc.)
2. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com)
3. Add Site → enter `cvscholar.com` → select Free plan
4. Cloudflare gives you 2 nameservers (e.g. `aria.ns.cloudflare.com`)
5. Go to your domain registrar → update nameservers to the Cloudflare ones
6. Wait for DNS propagation (usually 5-30 minutes)

#### 2. Create a Cloudflare Tunnel
1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Networks → Tunnels
2. Click **Create a tunnel** → select **Cloudflared** → Next
3. Name it: `cvscholar`
4. On the Install page, **don't install anything** — just copy the **tunnel token** (the long string after `--token`)
5. Click Next → Add a **Public Hostname**:
   - Subdomain: *(leave empty for root domain)*
   - Domain: `cvscholar.com`
   - Type: `HTTP`
   - URL: `cvscholar-app:80` *(this is the Docker container name)*
6. Save the tunnel

#### 3. (Optional) Add www redirect
In the same tunnel, add another public hostname:
   - Subdomain: `www`
   - Domain: `cvscholar.com`
   - Type: `HTTP`
   - URL: `cvscholar-app:80`

Or use Cloudflare Rules → Redirect Rules to redirect `www.cvscholar.com` → `cvscholar.com`.

#### 4. Update Portainer Environment Variables
In Portainer → Stacks → cvscholar → Environment variables, update/add:

| Variable | Value |
|----------|-------|
| `APP_URL` | `https://cvscholar.com` |
| `CF_TUNNEL_TOKEN` | *(the token from step 2.4)* |
| `JWT_SECRET` | *(generate: `openssl rand -hex 32`)* |

#### 5. Pull & Redeploy
In Portainer:
1. Go to Stacks → cvscholar
2. Click **Pull and redeploy**
3. Check **Re-pull image and redeploy**
4. Click **Update**

The `cvscholar-tunnel` container will start and connect to Cloudflare automatically.

#### 6. Lock Down Server Ports (Recommended)
Once the tunnel is working, you can stop exposing ports to the internet via your server firewall:

```bash
# Only allow SSH + Portainer, block app ports from public
sudo ufw allow 22/tcp
sudo ufw allow 9443/tcp    # Portainer
sudo ufw deny 8080/tcp     # App (now via tunnel)
sudo ufw deny 8082/tcp     # phpMyAdmin
sudo ufw deny 3307/tcp     # MySQL
sudo ufw enable
```

Or remove the `ports:` mappings from `docker-compose.yml` for app/phpmyadmin (they'll still work internally via the Docker network).

#### 7. Cloudflare SSL Settings
In Cloudflare dashboard → SSL/TLS:
- Set mode to **Full** (not Full Strict, since the app container uses HTTP internally)
- Enable **Always Use HTTPS**
- Enable **Automatic HTTPS Rewrites**

### Verify
```bash
# Check tunnel is running
docker logs cvscholar-tunnel

# Test the domain
curl -I https://cvscholar.com
```

### Update Google OAuth (if using)
If you have Google Login enabled, update the OAuth redirect URI in Google Cloud Console:
- Old: `http://109.199.125.98:8080/auth/google/callback`
- New: `https://cvscholar.com/auth/google/callback`
