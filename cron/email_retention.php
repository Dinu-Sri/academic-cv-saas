<?php
/**
 * Cron Job: Retention Emails
 *
 * Sends lifecycle nudges:
 * - Day 3: users with no CV created yet
 * - Day 7: inactive users re-engagement
 *
 * Example crontab:
 *   30 8 * * * php /var/www/html/cron/email_retention.php >> /var/www/html/storage/logs/cron.log 2>&1
 */

// Bootstrap the application
define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('PUBLIC_PATH', BASE_PATH . '/public');

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

$timestamp = date('Y-m-d H:i:s');
echo "[$timestamp] Running retention email cron...\n";

$cronKey = 'email_retention';
$output  = '';

try {
    $db = Database::getInstance()->getConnection();

    // Mark cron as running
    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'running' WHERE job_key = ?")->execute([$cronKey]);

    $tableCheck = $db->query("SHOW TABLES LIKE 'user_events'");
    if (!$tableCheck->fetchColumn()) {
        $line = "[$timestamp] user_events table missing. Apply migration 024 first.\n";
        echo $line;
        $db->prepare("UPDATE cron_jobs SET last_status = 'failed', last_output = ? WHERE job_key = ?")->execute([$line, $cronKey]);
        exit(0);
    }

    $sentFirstCvReminder = 0;
    $sentReEngagement = 0;

    // Day-3 reminder: account created 3-4 days ago, no CVs yet, not already emailed
    $day3 = $db->query(
        "SELECT u.id, u.email, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS display_name
         FROM users u
         LEFT JOIN cv_profiles cp ON cp.user_id = u.id
         WHERE cp.id IS NULL
           AND u.created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
           AND u.created_at > DATE_SUB(NOW(), INTERVAL 4 DAY)
           AND NOT EXISTS (
               SELECT 1 FROM user_events ue
               WHERE ue.user_id = u.id AND ue.event_key = 'email_first_cv_reminder_sent'
           )
         GROUP BY u.id, u.email, display_name"
    )->fetchAll();

    foreach ($day3 as $user) {
        $ok = EmailService::sendFirstCvReminder($user['email'], $user['display_name']);
        if ($ok) {
            EventLogger::logForUser((int) $user['id'], 'email_first_cv_reminder_sent', ['campaign' => 'day_3']);
            $sentFirstCvReminder++;
        }
    }

    // Day-7 re-engagement: inactive for at least 7 days, not already emailed
    $day7 = $db->query(
        "SELECT u.id, u.email, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS display_name
         FROM users u
         WHERE u.created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
           AND (u.last_login_at IS NULL OR u.last_login_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
           AND NOT EXISTS (
               SELECT 1 FROM user_events ue
               WHERE ue.user_id = u.id AND ue.event_key = 'email_reengagement_sent'
           )"
    )->fetchAll();

    foreach ($day7 as $user) {
        $ok = EmailService::sendReEngagement($user['email'], $user['display_name']);
        if ($ok) {
            EventLogger::logForUser((int) $user['id'], 'email_reengagement_sent', ['campaign' => 'day_7']);
            $sentReEngagement++;
        }
    }

    $summary = "[$timestamp] Done. day3_sent={$sentFirstCvReminder}, day7_sent={$sentReEngagement}\n";
    echo $summary;
    $output = $summary;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $summary, FILE_APPEND | LOCK_EX);

    // Mark cron success
    $db->prepare("UPDATE cron_jobs SET last_status = 'success', last_output = ? WHERE job_key = ?")
       ->execute([substr($output, 0, 1000), $cronKey]);

} catch (Throwable $e) {
    $error = "[$timestamp] ERROR in retention email cron: " . $e->getMessage() . "\n";
    echo $error;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $error, FILE_APPEND | LOCK_EX);
    try {
        $db->prepare("UPDATE cron_jobs SET last_status = 'failed', last_output = ? WHERE job_key = ?")
           ->execute([substr($error, 0, 1000), $cronKey]);
    } catch (Throwable $_) {}
    exit(1);
}
