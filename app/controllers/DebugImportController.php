    // POST /debug-import/server-file
    public function importServerFile()
    {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['file_path'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing file_path']);
            exit;
        }
        $filePath = $input['file_path'];
        // Only allow files within BASE_PATH for safety
        $realBase = realpath(__DIR__ . '/../../');
        $realFile = realpath($filePath);
        if (!$realFile || strpos($realFile, $realBase) !== 0 || !is_file($realFile)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or unsafe file path']);
            exit;
        }
        $tmpDir = __DIR__ . '/../../storage/debug_import/';
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0777, true);
        $jobId = uniqid('debug_', true);
        $logPath = $tmpDir . $jobId . '.log';
        // Run import synchronously, capture output/errors
        $cmd = escapeshellcmd(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../services/AiCvImportService.php') . ' ' . escapeshellarg($realFile) . ' > ' . escapeshellarg($logPath) . ' 2>&1';
        $status = null;
        $output = null;
        exec($cmd, $output, $status);
        // Save status to a status file
        file_put_contents($tmpDir . $jobId . '.status', json_encode(['status' => $status, 'time' => time()]));
        echo json_encode(['job_id' => $jobId, 'status' => $status]);
    }

    // GET /debug-import/list-files?dir=relative/path
    public function listFiles()
    {
        header('Content-Type: application/json');
        $base = realpath(__DIR__ . '/../../');
        $dir = isset($_GET['dir']) ? $_GET['dir'] : '.';
        $target = realpath($base . '/' . $dir);
        if (!$target || strpos($target, $base) !== 0 || !is_dir($target)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or unsafe directory']);
            exit;
        }
        $files = array_values(array_filter(scandir($target), function($f) use ($target) {
            return is_file($target . '/' . $f);
        }));
        echo json_encode(['dir' => $dir, 'files' => $files]);
    }
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