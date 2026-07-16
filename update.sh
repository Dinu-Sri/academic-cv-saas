#!/bin/bash
# ===========================================
# CVScholar - Update & Redeploy
# Run this on your server after pushing changes to GitHub
# ===========================================
set -e

echo "=== CVScholar Update ==="

# Pull latest code
echo "[1/4] Pulling latest code..."
git fetch origin
git checkout master
git pull origin master

# Rebuild the app container (picks up code changes)
# --no-cache forces a full rebuild so Portainer/Docker cannot keep an old COPY layer
echo "[2/4] Rebuilding app container (no cache)..."
docker compose build --no-cache app

# Restart with zero-downtime (db stays up, app restarts)
echo "[3/4] Restarting app container..."
docker compose up -d --force-recreate app

# Migrations run automatically on container start via docker-entrypoint.sh
echo "[4/4] Waiting for migrations to complete..."
sleep 5
docker compose logs --tail=20 app

echo ""
echo "=== Update Complete ==="
echo "App: http://$(hostname -I | awk '{print $1}'):8080"
