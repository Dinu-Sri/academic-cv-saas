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

# xelatex smoke test (only when the LaTeX-enabled image is in use).
# Validates the toolchain can produce a PDF before any user request hits it.
# Failures are logged loudly but never abort boot; PDF requests will return
# a structured LaTeX renderer error until the toolchain is fixed.
if [ "${CVSCHOLAR_LATEX_ENABLED:-0}" = "1" ]; then
    echo "Running xelatex smoke test..."
    SMOKE_DIR=$(mktemp -d)
    cat > "${SMOKE_DIR}/smoke.tex" <<'TEX'
\documentclass{article}
\usepackage{fontspec}
\begin{document}
CVScholar xelatex smoke test ok.
\end{document}
TEX
    if xelatex -interaction=nonstopmode -halt-on-error -no-shell-escape \
        -output-directory="${SMOKE_DIR}" "${SMOKE_DIR}/smoke.tex" \
        > "${SMOKE_DIR}/smoke.log" 2>&1 \
        && [ -f "${SMOKE_DIR}/smoke.pdf" ]; then
        echo "  xelatex OK ($(wc -c < "${SMOKE_DIR}/smoke.pdf") bytes)"
    else
        echo "  WARNING: xelatex smoke test FAILED — PDF rendering will report a LaTeX error."
        echo "  ---- xelatex log (last 20 lines) ----"
        tail -n 20 "${SMOKE_DIR}/smoke.log" 2>/dev/null || true
        echo "  -------------------------------------"
    fi
    rm -rf "${SMOKE_DIR}"
fi

# Set up cron job for subscription expiry
echo "Setting up cron jobs..."
cat <<'CRON' | crontab -
0 * * * * php /var/www/html/cron/expire_subscriptions.php >> /var/www/html/storage/logs/cron.log 2>&1
30 8 * * * php /var/www/html/cron/email_retention.php >> /var/www/html/storage/logs/cron.log 2>&1
10 * * * * php /var/www/html/cron/draft_stall_detector.php >> /var/www/html/storage/logs/cron.log 2>&1
*/15 * * * * php /var/www/html/cron/editor_reliability_guard.php >> /var/www/html/storage/logs/cron.log 2>&1
CRON
service cron start 2>/dev/null || true
echo "Cron jobs configured."

# Start Apache
echo "Starting Apache..."
exec apache2-foreground
