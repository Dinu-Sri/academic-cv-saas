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

### Reset everything (CAUTION: deletes all data)
```bash
docker compose down -v
docker compose up -d --build
```
