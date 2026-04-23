#!/bin/bash
set -e

echo "=== CVScholar Container Starting ==="

# Wait for MySQL to be ready
echo "Waiting for MySQL..."
max_tries=30
count=0
until php -r "try { new PDO('mysql:host=${DB_HOST};port=${DB_PORT}', '${DB_USER}', '${DB_PASS}'); echo 'OK'; } catch(Exception \$e) { exit(1); }" 2>/dev/null; do
    count=$((count + 1))
    if [ $count -ge $max_tries ]; then
        echo "ERROR: MySQL not ready after ${max_tries} attempts. Exiting."
        exit 1
    fi
    echo "  MySQL not ready yet... (attempt $count/$max_tries)"
    sleep 2
done
echo "MySQL is ready!"

# Run database migrations
echo "Running database migrations..."
php /var/www/html/migrations/migrate.php
echo "Migrations complete."

# Set up cron job for subscription expiry
echo "Setting up cron jobs..."
cat <<'CRON' | crontab -
0 * * * * php /var/www/html/cron/expire_subscriptions.php >> /var/www/html/storage/logs/cron.log 2>&1
30 8 * * * php /var/www/html/cron/email_retention.php >> /var/www/html/storage/logs/cron.log 2>&1
CRON
service cron start 2>/dev/null || true
echo "Cron jobs configured."

# Start Apache
echo "Starting Apache..."
exec apache2-foreground
