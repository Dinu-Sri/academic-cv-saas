<?php
// Temporary debug controller - direct PDF import via proper job queue flow
class DebugImportController
{
    private function getPhpBinary(): string
    {
        // PHP_BINARY may be empty in some Docker containers; use known fallbacks
        if (!empty(PHP_BINARY) && is_executable(PHP_BINARY)) {
            return PHP_BINARY;
        }
        foreach (['/usr/local/bin/php', '/usr/bin/php', 'php'] as $b) {
            if (@is_executable($b)) return $b;
        }
        return 'php';
    }

    // POST /debug-import ? upload a PDF, create a job, run the worker, return job id
    public function upload()
    {
        header('Content-Type: application/json');
        if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No PDF uploaded or upload error', 'files' => $_FILES]);
            exit;
        }
        $basePath = realpath(__DIR__ . '/../../');
        $uploadDir = $basePath . '/storage/temp/debug_uploads/';
        $jobDir    = $basePath . '/storage/temp/import_jobs/';
        foreach ([$uploadDir, $jobDir] as $d) {
            if (!is_dir($d)) mkdir($d, 0777, true);
        }
        $jobId  = md5(uniqid('debug_', true));
        $pdfPath = $uploadDir . $jobId . '.pdf';
        if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save PDF']);
            exit;
        }
        $job = [
            'id'         => $jobId,
            'user_id'    => 0,
            'pdf_path'   => $pdfPath,
            'status'     => 'queued',
            'created_at' => date('c'),
            'updated_at' => date('c'),
        ];
        file_put_contents($jobDir . $jobId . '.json', json_encode($job, JSON_UNESCAPED_UNICODE));

        // Run the async worker synchronously so we get full output
        $php    = $this->getPhpBinary();
        $script = $basePath . '/scripts/import_cv_async.php';
        $logPath = $uploadDir . $jobId . '.log';
        $cmd = $php . ' ' . escapeshellarg($script) . ' ' . escapeshellarg($jobId) . ' > ' . escapeshellarg($logPath) . ' 2>&1';
        exec($cmd, $out, $exitCode);

        // Read the updated job file for the result
        $jobResult = json_decode(file_get_contents($jobDir . $jobId . '.json'), true);
        $log = file_exists($logPath) ? file_get_contents($logPath) : implode("\n", $out);

        echo json_encode([
            'job_id'    => $jobId,
            'exit_code' => $exitCode,
            'php_binary'=> $php,
            'job'       => $jobResult,
            'log'       => $log,
        ]);
    }

    // GET /debug-import/status/{id}
    public function status($jobId)
    {
        header('Content-Type: application/json');
        if (!preg_match('/^[a-f0-9]{32}$/', $jobId)) {
            http_response_code(400); echo json_encode(['error' => 'Invalid job id']); exit;
        }
        $basePath = realpath(__DIR__ . '/../../');
        $jobDir   = $basePath . '/storage/temp/import_jobs/';
        $logPath  = $basePath . '/storage/temp/debug_uploads/' . $jobId . '.log';
        $jobPath  = $jobDir . $jobId . '.json';
        if (!file_exists($jobPath)) {
            http_response_code(404); echo json_encode(['error' => 'Job not found']); exit;
        }
        $job = json_decode(file_get_contents($jobPath), true);
        $log = file_exists($logPath) ? file_get_contents($logPath) : '';
        echo json_encode(['job' => $job, 'log' => $log]);
    }

    // GET /debug-import/list-files?dir=relative/path
    public function listFiles()
    {
        header('Content-Type: application/json');
        $base   = realpath(__DIR__ . '/../../');
        $dir    = isset($_GET['dir']) ? $_GET['dir'] : '.';
        $target = realpath($base . '/' . $dir);
        if (!$target || strpos($target, $base) !== 0 || !is_dir($target)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid directory', 'base' => $base, 'dir' => $dir]);
            exit;
        }
        $files = array_values(array_filter(scandir($target), function ($f) use ($target) {
            return is_file($target . '/' . $f);
        }));
        echo json_encode(['dir' => $dir, 'base' => $base, 'files' => $files, 'php_binary' => PHP_BINARY]);
    }

    // GET /debug-import/env ? show PHP environment info
    public function env()
    {
        header('Content-Type: application/json');
        $base = realpath(__DIR__ . '/../../');
        $doclingUrl = defined('AI_CV_IMPORT_DOCLING_URL') ? trim((string) AI_CV_IMPORT_DOCLING_URL) : '';
        $doclingHealthUrl = '';
        $doclingHealth = ['ok' => false, 'status' => null, 'error' => 'Docling URL not configured'];
        if ($doclingUrl !== '') {
            $doclingHealthUrl = rtrim($doclingUrl, '/');
            if (!str_ends_with($doclingHealthUrl, '/healthz')) {
                $doclingHealthUrl .= '/healthz';
            }

            $ch = curl_init($doclingHealthUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_CONNECTTIMEOUT => 4,
            ]);
            $resp = curl_exec($ch);
            $err = curl_error($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($resp !== false && $status >= 200 && $status < 300) {
                $doclingHealth = [
                    'ok' => true,
                    'status' => $status,
                    'response' => json_decode((string) $resp, true) ?: trim((string) $resp),
                ];
            } else {
                $doclingHealth = [
                    'ok' => false,
                    'status' => $status,
                    'error' => $err !== '' ? $err : 'HTTP ' . $status,
                    'raw' => trim((string) $resp),
                ];
            }
        }

        echo json_encode([
            'php_binary'  => PHP_BINARY,
            'php_version' => PHP_VERSION,
            'base_path'   => $base,
            'exec_enabled'=> function_exists('exec'),
            'pdftotext'   => trim(shell_exec('which pdftotext 2>/dev/null') ?? ''),
            'tesseract'   => trim(shell_exec('which tesseract 2>/dev/null') ?? ''),
            'php_path'    => trim(shell_exec('which php 2>/dev/null') ?? ''),
            'docling_url' => $doclingUrl,
            'docling_health_url' => $doclingHealthUrl,
            'docling_health' => $doclingHealth,
        ]);
    }
}