<?php
/**
 * Cron queue worker for CV import jobs.
 * Safe fallback when shell_exec/proc_open are disabled in PHP runtime.
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
        APP_PATH . '/contracts/' . $class . '.php',
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
        $key = trim($key);
        $value = trim($value);
        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

$jobDir = STORAGE_PATH . '/temp/import_jobs';
if (!is_dir($jobDir)) {
    exit(0);
}

$files = glob($jobDir . '/*.json') ?: [];
sort($files);

foreach ($files as $filePath) {
    $lockPath = $filePath . '.lock';
    $lockHandle = @fopen($lockPath, 'c');
    if (!$lockHandle) {
        continue;
    }

    if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
        @fclose($lockHandle);
        continue;
    }

    try {
        $raw = file_get_contents($filePath);
        $job = json_decode((string) $raw, true);
        if (!is_array($job)) {
            continue;
        }

        if (($job['status'] ?? '') !== 'queued') {
            continue;
        }

        $job['status'] = 'processing';
        $job['stage'] = 'extracting';
        $job['started_at'] = $job['started_at'] ?? date('c');
        $job['updated_at'] = date('c');
        file_put_contents($filePath, json_encode($job, JSON_UNESCAPED_UNICODE));

        try {
            $pdfPath = (string) ($job['pdf_path'] ?? '');
            if ($pdfPath === '' || !is_file($pdfPath)) {
                throw new RuntimeException('Queued PDF file is missing.');
            }

            $result = (new AiCvImportService())->importStoredPdf($pdfPath, [
                'ocr_mode' => (string) ($job['ocr_mode'] ?? AI_CV_IMPORT_OCR_MODE),
            ]);
            $job['status'] = !empty($result['success']) ? 'completed' : 'failed';
            $job['stage'] = !empty($result['success']) ? 'completed' : 'failed';
            $job['result'] = $result;
            $job['error'] = $result['error'] ?? null;
            $job['completed_at'] = date('c');
            $job['duration_seconds'] = max(0, time() - strtotime((string) ($job['started_at'] ?? $job['created_at'] ?? date('c'))));
            $job['updated_at'] = date('c');
            file_put_contents($filePath, json_encode($job, JSON_UNESCAPED_UNICODE));
        } catch (Throwable $e) {
            $job['status'] = 'failed';
            $job['stage'] = 'failed';
            $job['error'] = $e->getMessage();
            $job['completed_at'] = date('c');
            $job['duration_seconds'] = max(0, time() - strtotime((string) ($job['started_at'] ?? $job['created_at'] ?? date('c'))));
            $job['updated_at'] = date('c');
            file_put_contents($filePath, json_encode($job, JSON_UNESCAPED_UNICODE));
        }

        // Process one job per run to keep cron execution bounded.
        break;
    } finally {
        @flock($lockHandle, LOCK_UN);
        @fclose($lockHandle);
    }
}
