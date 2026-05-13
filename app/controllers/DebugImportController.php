<?php
// Temporary debug controller for direct PDF import and log/status retrieval
class DebugImportController
{
    // POST /debug-import
    public function upload()
    {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No PDF uploaded or upload error']);
            exit;
        }
        $tmpDir = __DIR__ . '/../../storage/debug_import/';
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0777, true);
        $jobId = uniqid('debug_', true);
        $pdfPath = $tmpDir . $jobId . '.pdf';
        $logPath = $tmpDir . $jobId . '.log';
        if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save PDF']);
            exit;
        }
        // Run import synchronously, capture output/errors
        $cmd = escapeshellcmd(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../services/AiCvImportService.php') . ' ' . escapeshellarg($pdfPath) . ' > ' . escapeshellarg($logPath) . ' 2>&1';
        $status = null;
        $output = null;
        exec($cmd, $output, $status);
        // Save status to a status file
        file_put_contents($tmpDir . $jobId . '.status', json_encode(['status' => $status, 'time' => time()]));
        echo json_encode(['job_id' => $jobId, 'status' => $status]);
    }

    // GET /debug-import/status/{id}
    public function status($jobId)
    {
        header('Content-Type: application/json');
        $tmpDir = __DIR__ . '/../../storage/debug_import/';
        $logPath = $tmpDir . $jobId . '.log';
        $statusPath = $tmpDir . $jobId . '.status';
        if (!file_exists($statusPath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Job not found']);
            exit;
        }
        $status = json_decode(file_get_contents($statusPath), true);
        $log = file_exists($logPath) ? file_get_contents($logPath) : '';
        echo json_encode([
            'job_id' => $jobId,
            'status' => $status['status'],
            'time' => $status['time'],
            'log' => $log
        ]);
    }
}