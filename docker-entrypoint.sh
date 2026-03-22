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

# Start Apache
echo "Starting Apache..."
exec apache2-foreground
