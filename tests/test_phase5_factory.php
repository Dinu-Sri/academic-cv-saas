<?php
/**
 * Phase 5 — site_settings + circuit-breaker resolution.
 *
 * Run: php tests/test_phase5_factory.php
 *
 * Pure-unit assertions that don't require a live DB. Verifies:
 *   - resolveEngine() returns 'fpdf' when DB is unreachable (graceful default)
 *   - explicit override via make() bypasses all resolution
 *   - PdfRenderMetrics::record() doesn't throw with DB down
 *   - PdfRenderMetrics::recentFailureRate() returns 0.0 with DB down
 */

define('BASE_PATH', realpath(__DIR__ . '/..'));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
require_once APP_PATH . '/config.php';
require_once APP_PATH . '/Database.php';

spl_autoload_register(function ($class) {
    foreach (['/contracts/', '/services/', '/models/', '/controllers/', '/'] as $sub) {
        $f = APP_PATH . $sub . $class . '.php';
        if (file_exists($f)) { require_once $f; return; }
    }
});

$pass = 0; $fail = 0;
$assert = function (string $name, bool $ok) use (&$pass, &$fail) {
    echo ($ok ? "  OK   " : "  FAIL ") . $name . PHP_EOL;
    $ok ? $pass++ : $fail++;
};

echo "[Phase 5 factory + metrics]\n";

// 1. Default resolution falls back to fpdf without DB
$assert('resolveEngine(null) returns fpdf default', RendererFactory::resolveEngine(null) === 'fpdf');

$dbReachable = @fsockopen(DB_HOST, (int) DB_PORT, $en, $es, 0.5);
if ($dbReachable) { fclose($dbReachable); $dbReachable = true; } else { $dbReachable = false; }

if ($dbReachable) {
    // 2. Override bypasses lookup and returns the specified engine
    $renderer = RendererFactory::make(null, 'fpdf');
    $assert('make(null, "fpdf") returns FpdfRenderer', $renderer instanceof FpdfRenderer);

    // 3. Latex override returns FallbackRenderer-wrapped LatexRenderer
    $renderer = RendererFactory::make(null, 'latex');
    $assert('make(null, "latex") wraps in FallbackRenderer', $renderer instanceof FallbackRenderer);
} else {
    echo "  SKIP make() instantiation (MySQL not reachable at " . DB_HOST . ":" . DB_PORT . ")\n";
}

// 4. Metrics: record() must not throw even when DB is down
$threw = false;
try {
    PdfRenderMetrics::record(1, 1, ['success' => true, 'engine' => 'fpdf', 'duration_ms' => 42]);
} catch (\Throwable $e) {
    $threw = true;
}
$assert('PdfRenderMetrics::record() never throws', $threw === false);

// 5. recentFailureRate returns 0.0 (fail-open) when DB is unreachable
$rate = PdfRenderMetrics::recentFailureRate('latex', 60);
$assert('recentFailureRate fails open (returns 0.0)', $rate === 0.0);

// 6. Circuit breaker on fpdf is a no-op (always returns fpdf)
$ref = new ReflectionMethod('RendererFactory', 'circuitBreak');
$ref->setAccessible(true);
$assert('circuitBreak("fpdf") == fpdf', $ref->invoke(null, 'fpdf') === 'fpdf');

echo "\n========================================\n";
echo "{$pass} passed, {$fail} failed\n";
exit($fail > 0 ? 1 : 0);
