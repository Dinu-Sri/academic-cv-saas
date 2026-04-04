<?php
/**
 * Cron Job: Expire Subscriptions
 * 
 * Checks for users whose subscription has expired and downgrades them to the free plan.
 * Run this via cron every hour or daily:
 *   php /path/to/academic-cv-saas/cron/expire_subscriptions.php
 * 
 * Docker: Add to crontab or run via a scheduled task
 *   0 * * * * php /var/www/html/cron/expire_subscriptions.php >> /var/www/html/storage/logs/cron.log 2>&1
 */

// Bootstrap the application
define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('PUBLIC_PATH', BASE_PATH . '/public');

// Autoload
spl_autoload_register(function ($class) {
    $paths = [
        APP_PATH . '/' . $class . '.php',
        APP_PATH . '/controllers/' . $class . '.php',
        APP_PATH . '/models/' . $class . '.php',
        APP_PATH . '/services/' . $class . '.php',
    ];
    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// Load .env for local dev
$envFile = BASE_PATH . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        if (!getenv(trim($key))) {
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

// =========================================
// Main: Find and downgrade expired users
// =========================================

$timestamp = date('Y-m-d H:i:s');
echo "[$timestamp] Running subscription expiry check...\n";

try {
    $db = Database::getInstance()->getConnection();

    // Find users with expired subscriptions who are NOT on the free plan
    $stmt = $db->prepare(
        "SELECT id, email, username, full_name, subscription_plan, subscription_expires_at 
         FROM users 
         WHERE subscription_plan != 'free' 
           AND subscription_expires_at IS NOT NULL 
           AND subscription_expires_at < NOW()"
    );
    $stmt->execute();
    $expiredUsers = $stmt->fetchAll();

    if (empty($expiredUsers)) {
        echo "[$timestamp] No expired subscriptions found.\n";
        exit(0);
    }

    echo "[$timestamp] Found " . count($expiredUsers) . " expired subscription(s).\n";

    $updateStmt = $db->prepare(
        "UPDATE users SET subscription_plan = 'free', subscription_expires_at = NULL WHERE id = ?"
    );

    $cancelSubStmt = $db->prepare(
        "UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'"
    );

    foreach ($expiredUsers as $user) {
        $name = $user['full_name'] ?: $user['username'] ?: $user['email'];
        echo "[$timestamp] Expiring: {$name} ({$user['email']}) — was '{$user['subscription_plan']}', expired at {$user['subscription_expires_at']}\n";

        // Downgrade to free
        $updateStmt->execute([$user['id']]);

        // Mark subscription records as expired
        $cancelSubStmt->execute([$user['id']]);
    }

    echo "[$timestamp] Done. Downgraded " . count($expiredUsers) . " user(s) to free plan.\n";

    // Log to file as well
    $logFile = STORAGE_PATH . '/logs/cron.log';
    $logMsg = "[$timestamp] Expired " . count($expiredUsers) . " subscription(s): " .
              implode(', ', array_column($expiredUsers, 'email')) . "\n";
    file_put_contents($logFile, $logMsg, FILE_APPEND | LOCK_EX);

} catch (Exception $e) {
    $errorMsg = "[$timestamp] ERROR: " . $e->getMessage() . "\n";
    echo $errorMsg;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $errorMsg, FILE_APPEND | LOCK_EX);
    exit(1);
}
