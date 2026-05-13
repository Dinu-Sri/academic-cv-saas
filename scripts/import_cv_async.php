<?php
/**
 * Async CV import worker.
 * Usage: php /var/www/html/scripts/import_cv_async.php <job_id>
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

$jobId = $argv[1] ?? '';
if (!preg_match('/^[a-f0-9]{32}$/', $jobId)) {
    fwrite(STDERR, "Invalid job id\n");
    exit(1);
}

$jobDir = STORAGE_PATH . '/temp/import_jobs';
$jobPath = $jobDir . '/' . $jobId . '.json';
if (!is_file($jobPath)) {
    fwrite(STDERR, "Job file not found\n");
    exit(1);
}

$readJob = static function () use ($jobPath): array {
    $raw = file_get_contents($jobPath);
    $job = json_decode((string) $raw, true);
    return is_array($job) ? $job : [];
};

$writeJob = static function (array $job) use ($jobPath): void {
    file_put_contents($jobPath, json_encode($job, JSON_UNESCAPED_UNICODE));
};

$job = $readJob();
if (empty($job['pdf_path'])) {
    $job['status'] = 'failed';
    $job['error'] = 'Missing PDF path for job.';
    $job['updated_at'] = date('c');
    $writeJob($job);
    exit(1);
}

try {
    $job['status'] = 'processing';
    $job['stage'] = 'extracting';
    $job['updated_at'] = date('c');
    $writeJob($job);

    $service = new AiCvImportService();
    $result = $service->importStoredPdf((string) $job['pdf_path'], [
        'ocr_mode' => (string) ($job['ocr_mode'] ?? AI_CV_IMPORT_OCR_MODE),
    ]);

    $job['status'] = !empty($result['success']) ? 'completed' : 'failed';
    $job['stage'] = !empty($result['success']) ? 'completed' : 'failed';
    $job['result'] = $result;
    $job['error'] = $result['error'] ?? null;
    $job['updated_at'] = date('c');
    $writeJob($job);
} catch (Throwable $e) {
    $job['status'] = 'failed';
    $job['stage'] = 'failed';
    $job['error'] = $e->getMessage();
    $job['updated_at'] = date('c');
    $writeJob($job);
}
