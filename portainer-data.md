# CVScholar — Portainer Deployment Data

## Server Info

| Item | Value |
|------|-------|
| Server IP | `109.199.125.98` |
| Portainer URL | `https://109.199.125.98:9443` |
| Portainer User | `clossyan` |
| GitHub Repo | `https://github.com/Dinu-Sri/academic-cv-saas` |
| Branch | `master` |

## Ports Used

| Port | Service | URL |
|------|---------|-----|
| 8080 | CVScholar App | `http://109.199.125.98:8080` |
| 8082 | phpMyAdmin | `http://109.199.125.98:8082` |
| 3307 | MySQL (direct) | `109.199.125.98:3307` |
| 8081 | Filebrowser (existing) | Already in use |
| 9443 | Portainer | Already in use |

## Environment Variables

These are set inside the Portainer stack. `MYSQL_PASSWORD` and `DB_PASS` must always match.

```
APP_ENV=production
APP_DEBUG=false
APP_URL=http://109.199.125.98:8080
MYSQL_ROOT_PASSWORD=<your root password>
MYSQL_DATABASE=academic_cv
MYSQL_USER=cvscholar
MYSQL_PASSWORD=<your db password>
DB_HOST=db
DB_PORT=3306
DB_NAME=academic_cv
DB_USER=cvscholar
DB_PASS=<same as MYSQL_PASSWORD>
```

---

## How We Deployed (First Time)

1. Pushed code from local XAMPP to GitHub:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create academic-cv-saas --public --source=. --push
   ```

2. In Portainer:
   - Stacks → **+ Add stack**
   - Name: `cvscholar`
   - Build method: **Repository**
   - Repository URL: `https://github.com/Dinu-Sri/academic-cv-saas`
   - Reference: `refs/heads/master`
   - Compose path: `docker-compose.yml`
   - Added all environment variables (table above)
   - Clicked **Deploy the stack**

3. Three containers created automatically:
   - `cvscholar-app` (PHP 8.2 + Apache)
   - `cvscholar-db` (MySQL 8.0)
   - `cvscholar-pma` (phpMyAdmin)

4. Database migrations ran automatically on first start (001_initial_schema.sql + 002_seed_templates.sql).

---

## How to Push Updates (Future)

### From VS Code (local):

```bash
# Make your code changes, then:
git add .
git commit -m "describe what changed"
git push
```

### Then in Portainer:

1. Go to **Stacks** → `cvscholar`
2. Click **"Pull and redeploy"**
3. Check **"Re-pull image and redeploy"**
4. Click **Update**

That's it. Migrations run automatically on restart.

---

## How to Add a Database Change (Future)

1. Create a new SQL file in `migrations/` folder:
   ```
   migrations/003_your_change.sql
   ```
   Use `CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`, `ALTER TABLE` — never `DROP TABLE`.

2. Commit and push:
   ```bash
   git add migrations/003_your_change.sql
   git commit -m "Add migration: your change"
   git push
   ```

3. In Portainer: **Pull and redeploy** — migration runs automatically.

---

## Useful Commands (SSH into server)

```bash
# View app logs
docker logs cvscholar-app

# View DB logs
docker logs cvscholar-db

# Run migrations manually
docker exec -it cvscholar-app php migrations/migrate.php

# Backup database
docker exec cvscholar-db mysqldump -u root -p academic_cv > backup.sql

# Restore database
docker exec -i cvscholar-db mysql -u root -p academic_cv < backup.sql

# Restart app only (DB stays up)
docker restart cvscholar-app

# Nuclear reset (DELETES ALL DATA)
# docker compose -f /path/to/docker-compose.yml down -v
# Then redeploy from Portainer
```

---

## phpMyAdmin Login

- URL: `http://109.199.125.98:8082`
- Server: `db`
- Username: `cvscholar` (or `root`)
- Password: your `MYSQL_PASSWORD` (or `MYSQL_ROOT_PASSWORD` for root)
