<?php
/**
 * Legacy compatibility cron.
 *
 * Subscriptions have been replaced by credits. Keep this file so existing cron
 * schedules remain harmless until removed from deployment configuration.
 */

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

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

$timestamp = date('Y-m-d H:i:s');
$output = "[$timestamp] Legacy subscription expiry skipped; credits do not expire.\n";
echo $output;

try {
    $db = Database::getInstance()->getConnection();
    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'success', last_output = ? WHERE job_key = ?")
        ->execute([substr($output, 0, 1000), 'expire_subscriptions']);
} catch (Throwable $e) {
    echo "[$timestamp] Could not update cron status: " . $e->getMessage() . "\n";
}
