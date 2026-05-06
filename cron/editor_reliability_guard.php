<?php
/**
 * Cron Job: Editor Reliability Guard
 *
 * Purpose:
 * - Detect broken editor.js patterns before users report issues.
 * - Detect js_error spikes on /cv/edit/* in near real time.
 * - Alert admins by email with cooldown to avoid spam.
 *
 * Recommended schedule:
 *   Every 15 minutes: php /var/www/html/cron/editor_reliability_guard.php >> /var/www/html/storage/logs/cron.log 2>&1
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

$cronKey = 'editor_reliability_guard';
$timestamp = date('Y-m-d H:i:s');
$output = '';

function guardLine(string $msg): string
{
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    echo $line;
    return $line;
}

try {
    $db = Database::getInstance()->getConnection();
    $settings = new SiteSetting();

    // Respect admin toggle in cron_jobs table.
    $jobStmt = $db->prepare('SELECT is_enabled FROM cron_jobs WHERE job_key = ? LIMIT 1');
    $jobStmt->execute([$cronKey]);
    $job = $jobStmt->fetch();
    if ($job && (int)($job['is_enabled'] ?? 1) !== 1) {
        $line = guardLine('Editor reliability guard is disabled. Skipping run.');
        $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'success', last_output = ? WHERE job_key = ?")
            ->execute([substr(trim($line), 0, 1000), $cronKey]);
        exit(0);
    }

    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), last_status = 'running' WHERE job_key = ?")
        ->execute([$cronKey]);

    $conf = $settings->getMultiple([
        'editor_guard_enabled',
        'editor_guard_window_minutes',
        'editor_guard_js_error_threshold',
        'editor_guard_alert_cooldown_minutes',
        'editor_guard_alert_emails',
        'editor_guard_last_alert_at',
    ]);

    $enabled = ($conf['editor_guard_enabled'] ?? '1') === '1';
    if (!$enabled) {
        $line = guardLine('editor_guard_enabled=0. Skipping checks.');
        $db->prepare("UPDATE cron_jobs SET last_status = 'success', last_output = ? WHERE job_key = ?")
            ->execute([substr(trim($line), 0, 1000), $cronKey]);
        exit(0);
    }

    $windowMin = max(5, min(240, (int)($conf['editor_guard_window_minutes'] ?? 30)));
    $errorThreshold = max(1, min(1000, (int)($conf['editor_guard_js_error_threshold'] ?? 8)));
    $cooldownMin = max(5, min(1440, (int)($conf['editor_guard_alert_cooldown_minutes'] ?? 60)));

    $editorPath = PUBLIC_PATH . '/assets/js/editor.js';
    $jsSyntaxIssue = false;
    $integrityNotes = [];
    $localHash = '';
    $remoteNoVersionHash = '';

    if (!file_exists($editorPath)) {
        $jsSyntaxIssue = true;
        $integrityNotes[] = 'editor.js not found on disk';
    } else {
        $js = (string)file_get_contents($editorPath);
        $localHash = hash('sha256', $js);

        // Guard against known broken pattern: orphaned .then after closure.
        if (preg_match('/\n\s*\}\);\s*\n\s*\.then\(r\s*=>\s*r\.json\(\)\)/', $js) === 1) {
            $jsSyntaxIssue = true;
            $integrityNotes[] = 'Suspicious orphaned .then(...) chain pattern detected';
        }

        if (!str_contains($js, "document.querySelectorAll('.btn-add-entry')")) {
            $integrityNotes[] = 'Missing Add Entry handler marker';
        }
        if (!str_contains($js, "const compileBtn = document.getElementById('btn-compile');")) {
            $integrityNotes[] = 'Missing Compile button handler marker';
        }

        // Optional syntax check when node exists.
        $nodeBin = trim((string)@shell_exec('command -v node 2>/dev/null'));
        if ($nodeBin !== '') {
            $cmd = escapeshellarg($nodeBin) . ' --check ' . escapeshellarg($editorPath) . ' 2>&1';
            $nodeOut = trim((string)@shell_exec($cmd));
            if ($nodeOut !== '') {
                $jsSyntaxIssue = true;
                $integrityNotes[] = 'node --check failed: ' . substr($nodeOut, 0, 250);
            }
        }

        // Compare live URL without cache-buster to local file hash to detect stale CDN risk.
        $assetUrl = rtrim(APP_URL, '/') . '/assets/js/editor.js';
        $ctx = stream_context_create([
            'http' => ['timeout' => 8, 'ignore_errors' => true],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        $remoteNoVersion = @file_get_contents($assetUrl, false, $ctx);
        if ($remoteNoVersion !== false && $remoteNoVersion !== '') {
            $remoteNoVersionHash = hash('sha256', $remoteNoVersion);
            if ($localHash !== '' && $remoteNoVersionHash !== $localHash) {
                $integrityNotes[] = 'Live editor.js hash differs from local hash (possible CDN stale cache)';
            }
        }
    }

    $jsCountStmt = $db->prepare(
        "SELECT COUNT(*) AS cnt, COUNT(DISTINCT user_id) AS users
         FROM behavior_events
         WHERE event_type = 'js_error'
           AND path LIKE '/cv/edit/%'
           AND event_at >= DATE_SUB(NOW(), INTERVAL :win MINUTE)"
    );
    $jsCountStmt->bindValue(':win', $windowMin, PDO::PARAM_INT);
    $jsCountStmt->execute();
    $jsStats = $jsCountStmt->fetch() ?: ['cnt' => 0, 'users' => 0];

    $msgStmt = $db->prepare(
        "SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.metadata.message')), 'unknown') AS msg, COUNT(*) AS cnt
         FROM behavior_events
         WHERE event_type = 'js_error'
           AND path LIKE '/cv/edit/%'
           AND event_at >= DATE_SUB(NOW(), INTERVAL :win MINUTE)
         GROUP BY msg
         ORDER BY cnt DESC
         LIMIT 3"
    );
    $msgStmt->bindValue(':win', $windowMin, PDO::PARAM_INT);
    $msgStmt->execute();
    $topMessages = $msgStmt->fetchAll();

    $pathStmt = $db->prepare(
        "SELECT path, COUNT(*) AS cnt
         FROM behavior_events
         WHERE event_type = 'js_error'
           AND path LIKE '/cv/edit/%'
           AND event_at >= DATE_SUB(NOW(), INTERVAL :win MINUTE)
         GROUP BY path
         ORDER BY cnt DESC
         LIMIT 5"
    );
    $pathStmt->bindValue(':win', $windowMin, PDO::PARAM_INT);
    $pathStmt->execute();
    $topPaths = $pathStmt->fetchAll();

    $jsErrCount = (int)($jsStats['cnt'] ?? 0);
    $jsErrUsers = (int)($jsStats['users'] ?? 0);
    $spikeDetected = $jsErrCount >= $errorThreshold;

    $line = guardLine("Window={$windowMin}m, js_error={$jsErrCount}, users={$jsErrUsers}, threshold={$errorThreshold}");
    $output .= $line;

    if (!empty($integrityNotes)) {
        foreach ($integrityNotes as $note) {
            $output .= guardLine('Integrity: ' . $note);
        }
    }

    $shouldAlert = $jsSyntaxIssue || $spikeDetected;

    if ($shouldAlert) {
        $lastAlertAt = $conf['editor_guard_last_alert_at'] ?? null;
        $cooldownPassed = true;
        if (!empty($lastAlertAt)) {
            $cooldownPassed = (strtotime($lastAlertAt) <= strtotime('-' . $cooldownMin . ' minutes'));
        }

        if ($cooldownPassed) {
            $alertEmails = [];
            $manualList = trim((string)($conf['editor_guard_alert_emails'] ?? ''));
            if ($manualList !== '') {
                $parts = array_map('trim', explode(',', $manualList));
                foreach ($parts as $email) {
                    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $alertEmails[] = strtolower($email);
                    }
                }
            }

            if (empty($alertEmails)) {
                $adminRows = $db->query("SELECT email FROM users WHERE is_admin = 1 AND is_active = 1")->fetchAll();
                foreach ($adminRows as $row) {
                    $email = trim((string)($row['email'] ?? ''));
                    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $alertEmails[] = strtolower($email);
                    }
                }
            }

            $alertEmails = array_values(array_unique($alertEmails));

            $subject = '[CVScholar Alert] Editor Reliability Guard Triggered';
            $topMsgTxt = 'none';
            if (!empty($topMessages)) {
                $parts = [];
                foreach ($topMessages as $m) {
                    $parts[] = ($m['msg'] ?? 'unknown') . ' (' . (int)($m['cnt'] ?? 0) . ')';
                }
                $topMsgTxt = implode('; ', $parts);
            }

            $pathTxt = 'none';
            if (!empty($topPaths)) {
                $parts = [];
                foreach ($topPaths as $p) {
                    $parts[] = ($p['path'] ?? 'unknown') . ' (' . (int)($p['cnt'] ?? 0) . ')';
                }
                $pathTxt = implode('; ', $parts);
            }

            $integrityTxt = empty($integrityNotes) ? 'none' : implode('; ', $integrityNotes);
            $body = "Editor reliability guard triggered.\n\n"
                . "Time: {$timestamp}\n"
                . "APP_URL: " . APP_URL . "\n"
                . "Window: {$windowMin} minutes\n"
                . "js_error count: {$jsErrCount}\n"
                . "Affected users: {$jsErrUsers}\n"
                . "Threshold: {$errorThreshold}\n"
                . "Syntax issue detected: " . ($jsSyntaxIssue ? 'yes' : 'no') . "\n"
                . "Top messages: {$topMsgTxt}\n"
                . "Top paths: {$pathTxt}\n"
                . "Integrity notes: {$integrityTxt}\n"
                . "Local hash: {$localHash}\n"
                . "Live hash (no-version URL): {$remoteNoVersionHash}\n\n"
                . "Suggested actions:\n"
                . "1) Verify /assets/js/editor.js on live matches latest commit.\n"
                . "2) Purge CDN cache for editor.js if hashes differ.\n"
                . "3) Smoke test Add Entry and Compile on /cv/edit/{id}.\n";

            $sent = 0;
            foreach ($alertEmails as $email) {
                if (EmailService::sendRaw($email, 'Admin', $subject, $body)) {
                    $sent++;
                }
            }

            $settings->set('editor_guard_last_alert_at', date('Y-m-d H:i:s'));
            $output .= guardLine('Alert sent to ' . $sent . ' recipient(s).');
        } else {
            $output .= guardLine('Alert suppressed by cooldown window.');
        }
    }

    $status = 'success';
    $db->prepare("UPDATE cron_jobs SET last_status = ?, last_output = ? WHERE job_key = ?")
        ->execute([$status, substr(trim($output), 0, 1000), $cronKey]);

    file_put_contents(STORAGE_PATH . '/logs/cron.log', $output, FILE_APPEND | LOCK_EX);
} catch (Throwable $e) {
    $err = '[' . $timestamp . '] ERROR in editor reliability guard: ' . $e->getMessage() . "\n";
    echo $err;
    file_put_contents(STORAGE_PATH . '/logs/cron.log', $err, FILE_APPEND | LOCK_EX);

    try {
        $db = Database::getInstance()->getConnection();
        $db->prepare("UPDATE cron_jobs SET last_status = 'failed', last_output = ? WHERE job_key = ?")
            ->execute([substr(trim($err), 0, 1000), $cronKey]);
    } catch (Throwable $_) {
    }

    exit(1);
}
