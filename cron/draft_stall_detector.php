<?php
/**
 * Cron Job: Draft Stall Detector
 *
 * Emits `draft_stalled_24h` when a CV has save activity but no compile for >= 24h.
 * Runs hourly and deduplicates per profile until new save activity happens.
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
echo "[$timestamp] Running draft stall detector...\n";

$cronKey = 'draft_stall_detector';
$output = '';

try {
    $db = Database::getInstance()->getConnection();

    // Mark cron as running
    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'running' WHERE job_key = ?")
       ->execute([$cronKey]);

    $sql = "
        SELECT
            cp.id AS profile_id,
            cp.user_id,
            MAX(ue.created_at) AS last_save_at,
            cp.last_compiled_at
        FROM cv_profiles cp
        JOIN user_events ue
            ON ue.user_id = cp.user_id
           AND ue.event_key = 'cv_section_saved'
           AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ue.metadata, '$.profile_id')) AS UNSIGNED) = cp.id
        GROUP BY cp.id, cp.user_id, cp.last_compiled_at
        HAVING MAX(ue.created_at) <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
           AND (cp.last_compiled_at IS NULL OR cp.last_compiled_at < MAX(ue.created_at))
           AND NOT EXISTS (
                SELECT 1
                FROM user_events du
                WHERE du.user_id = cp.user_id
                  AND du.event_key = 'draft_stalled_24h'
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(du.metadata, '$.profile_id')) AS UNSIGNED) = cp.id
                  AND du.created_at >= MAX(ue.created_at)
           )
    ";

    $candidates = $db->query($sql)->fetchAll();
    $sent = 0;

    foreach ($candidates as $row) {
        $profileId = (int) ($row['profile_id'] ?? 0);
        $userId = (int) ($row['user_id'] ?? 0);
        $lastSaveAt = (string) ($row['last_save_at'] ?? '');
        $lastCompiledAt = (string) ($row['last_compiled_at'] ?? '');

        if ($profileId <= 0 || $userId <= 0 || $lastSaveAt === '') {
            continue;
        }

        $hours = max(24, (int) floor((time() - strtotime($lastSaveAt)) / 3600));
        $days = max(1, (int) floor($hours / 24));

        EventLogger::logForUser($userId, 'draft_stalled_24h', [
            'profile_id' => $profileId,
            'hours_since_last_save' => $hours,
            'days_since_last_save' => $days,
            'has_compiled' => ($lastCompiledAt !== ''),
        ]);

        $sent++;
    }

    $summary = "[$timestamp] Done. candidates=" . count($candidates) . ", sent={$sent}\n";
    echo $summary;
    $output = $summary;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $summary, FILE_APPEND | LOCK_EX);

    $db->prepare("UPDATE cron_jobs SET last_status = 'success', last_output = ? WHERE job_key = ?")
       ->execute([substr($output, 0, 1000), $cronKey]);
} catch (Throwable $e) {
    $error = "[$timestamp] ERROR in draft stall detector: " . $e->getMessage() . "\n";
    echo $error;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $error, FILE_APPEND | LOCK_EX);
    try {
        $db->prepare("UPDATE cron_jobs SET last_status = 'failed', last_output = ? WHERE job_key = ?")
           ->execute([substr($error, 0, 1000), $cronKey]);
    } catch (Throwable $_) {}
    exit(1);
}
