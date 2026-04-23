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

$cronKey = 'expire_subscriptions';
$output  = '';
$exitStatus = 'success';

try {
    $db = Database::getInstance()->getConnection();

    // Mark cron as running
    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'running' WHERE job_key = ?")->execute([$cronKey]);

    // ── 7-day renewal reminder ──────────────────────────────────────────────
    $stmt7 = $db->prepare(
        "SELECT u.id, u.email, u.full_name, u.username, u.subscription_plan, u.subscription_expires_at
         FROM users u
         WHERE u.subscription_plan != 'free'
           AND u.subscription_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 8 DAY)
           AND NOT EXISTS (
               SELECT 1 FROM user_events e
               WHERE e.user_id = u.id AND e.event_type = 'renewal_reminder_7d_sent'
                 AND e.created_at > DATE_SUB(NOW(), INTERVAL 8 DAY)
           )"
    );
    $stmt7->execute();
    $reminder7Users = $stmt7->fetchAll();

    foreach ($reminder7Users as $u) {
        $name = $u['full_name'] ?: $u['username'] ?: $u['email'];
        $expiresAt = date('F j, Y', strtotime($u['subscription_expires_at']));
        EmailService::sendRenewalReminder($u['email'], $name, $expiresAt);
        EventLogger::logForUser($u['id'], 'renewal_reminder_7d_sent', ['plan' => $u['subscription_plan']]);
        $line = "[$timestamp] Sent 7-day renewal reminder to: {$u['email']}\n";
        echo $line;
        $output .= $line;
    }

    // ── 1-day urgent reminder ───────────────────────────────────────────────
    $stmt1 = $db->prepare(
        "SELECT u.id, u.email, u.full_name, u.username, u.subscription_plan, u.subscription_expires_at
         FROM users u
         WHERE u.subscription_plan != 'free'
           AND u.subscription_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 25 HOUR)
           AND NOT EXISTS (
               SELECT 1 FROM user_events e
               WHERE e.user_id = u.id AND e.event_type = 'renewal_reminder_1d_sent'
                 AND e.created_at > DATE_SUB(NOW(), INTERVAL 25 HOUR)
           )"
    );
    $stmt1->execute();
    $reminder1Users = $stmt1->fetchAll();

    foreach ($reminder1Users as $u) {
        $name = $u['full_name'] ?: $u['username'] ?: $u['email'];
        $expiresAt = date('F j, Y', strtotime($u['subscription_expires_at']));
        EmailService::sendRenewalUrgent($u['email'], $name, $expiresAt);
        EventLogger::logForUser($u['id'], 'renewal_reminder_1d_sent', ['plan' => $u['subscription_plan']]);
        $line = "[$timestamp] Sent 1-day urgent reminder to: {$u['email']}\n";
        echo $line;
        $output .= $line;
    }

    // ── Downgrade expired subscriptions ────────────────────────────────────
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
        $line = "[$timestamp] No expired subscriptions found.\n";
        echo $line;
        $output .= $line;
    } else {
        $line = "[$timestamp] Found " . count($expiredUsers) . " expired subscription(s).\n";
        echo $line;
        $output .= $line;

        $updateStmt = $db->prepare(
            "UPDATE users SET subscription_plan = 'free', subscription_expires_at = NULL WHERE id = ?"
        );
        $cancelSubStmt = $db->prepare(
            "UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'"
        );

        foreach ($expiredUsers as $user) {
            $name = $user['full_name'] ?: $user['username'] ?: $user['email'];
            $line = "[$timestamp] Expiring: {$name} ({$user['email']}) — was '{$user['subscription_plan']}'\n";
            echo $line;
            $output .= $line;

            $updateStmt->execute([$user['id']]);
            $cancelSubStmt->execute([$user['id']]);

            // Send expiry notification (once per expiry event)
            $notified = $db->prepare(
                "SELECT 1 FROM user_events WHERE user_id = ? AND event_type = 'subscription_expired_email_sent'
                 AND created_at > DATE_SUB(NOW(), INTERVAL 2 DAY)"
            );
            $notified->execute([$user['id']]);
            if (!$notified->fetchColumn()) {
                EmailService::sendSubscriptionExpired($user['email'], $name);
                EventLogger::logForUser($user['id'], 'subscription_expired_email_sent', ['plan' => $user['subscription_plan']]);
            }
        }

        $line = "[$timestamp] Done. Downgraded " . count($expiredUsers) . " user(s) to free plan.\n";
        echo $line;
        $output .= $line;

        // Log to file
        $logFile = STORAGE_PATH . '/logs/cron.log';
        file_put_contents($logFile,
            "[$timestamp] Expired " . count($expiredUsers) . " subscription(s): " .
            implode(', ', array_column($expiredUsers, 'email')) . "\n",
            FILE_APPEND | LOCK_EX
        );
    }

    // Mark cron success
    $db->prepare("UPDATE cron_jobs SET last_status = 'success', last_output = ? WHERE job_key = ?")
       ->execute([substr($output, 0, 1000), $cronKey]);

} catch (Exception $e) {
    $errorMsg = "[$timestamp] ERROR: " . $e->getMessage() . "\n";
    echo $errorMsg;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $errorMsg, FILE_APPEND | LOCK_EX);
    try {
        $db->prepare("UPDATE cron_jobs SET last_status = 'failed', last_output = ? WHERE job_key = ?")
           ->execute([substr($errorMsg, 0, 1000), $cronKey]);
    } catch (Throwable $_) {}
    exit(1);
}
