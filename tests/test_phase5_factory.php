<?php
/**
 * Phase 5 — site_settings + circuit-breaker resolution.
 *
 * Run: php tests/test_phase5_factory.php
 *
 * Pure-unit assertions that don't require a live DB. Verifies:
 *   - resolveEngine() returns 'latex' when DB is unreachable
 *   - legacy engine values normalize to the LaTeX renderer
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

// 1. Default resolution falls back to latex without DB
$assert('resolveEngine(null) returns latex default', RendererFactory::resolveEngine(null) === RendererFactory::ENGINE_LATEX);

// 2. make() does not need the DB when no profile id is supplied.
$renderer = RendererFactory::make(null);
$assert('make(null) returns LatexRenderer', $renderer instanceof LatexRenderer);

$renderer = RendererFactory::make(null, 'latex');
$assert('make(null, "latex") returns LatexRenderer', $renderer instanceof LatexRenderer);

$renderer = RendererFactory::make(null, 'fpdf');
$assert('make(null, legacy "fpdf") returns LatexRenderer', $renderer instanceof LatexRenderer);

$renderer = RendererFactory::make(null, 'xelatex');
$assert('make(null, legacy "xelatex") returns LatexRenderer', $renderer instanceof LatexRenderer);

// 3. Removed legacy renderers stay removed.
$assert('FpdfRenderer class is absent', !class_exists('FpdfRenderer'));
$assert('FallbackRenderer class is absent', !class_exists('FallbackRenderer'));

// 4. Metrics: record() must not throw even when DB is down
$threw = false;
try {
    PdfRenderMetrics::record(1, 1, ['success' => true, 'engine' => 'xelatex', 'duration_ms' => 42]);
} catch (\Throwable $e) {
    $threw = true;
}
$assert('PdfRenderMetrics::record() never throws', $threw === false);

// 5. recentFailureRate returns 0.0 (fail-open) when DB is unreachable
$rate = PdfRenderMetrics::recentFailureRate('latex', 60);
$assert('recentFailureRate fails open (returns 0.0)', $rate === 0.0);

echo "\n========================================\n";
echo "{$pass} passed, {$fail} failed\n";
exit($fail > 0 ? 1 : 0);
