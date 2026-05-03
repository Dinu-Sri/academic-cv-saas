<?php
/**
 * Renderer abstraction smoke test.
 *
 * Phase 3 scope: confirm RendererInterface contract and RendererFactory
 * resolution rules without touching the database or generating real PDFs.
 *
 * Usage:
 *   C:\xampp\php\php.exe tests\test_renderer_factory.php
 */

// Standalone bootstrap (mirrors the autoloader used by public/index.php).
define('BASE_PATH', realpath(__DIR__ . '/..'));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
require APP_PATH . '/config.php';

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

$pass = 0;
$fail = 0;
function ok(string $label, bool $cond, string $detail = ''): void
{
    global $pass, $fail;
    if ($cond) {
        $pass++;
        echo "  OK   $label\n";
    } else {
        $fail++;
        echo "  FAIL $label -- $detail\n";
    }
}

echo "[Phase 3 renderer abstraction]\n";

// 1. Interface is loadable.
ok('RendererInterface is autoloaded', interface_exists('RendererInterface'));

// 2. FpdfRenderer implements it.
$fpdf = new FpdfRenderer(new class extends LatexService {
    // Stub LatexService::compile so we don't hit the database.
    public function compile(int $profileId): array
    {
        return ['success' => true, 'pdf_path' => '/tmp/fake.pdf'];
    }
    public function __construct() { /* skip parent boot */ }
});
ok('FpdfRenderer implements RendererInterface', $fpdf instanceof RendererInterface);
ok('FpdfRenderer name() == "fpdf"', $fpdf->name() === 'fpdf');

$result = $fpdf->compile(123);
ok('FpdfRenderer.compile returns success', ($result['success'] ?? false) === true);
ok('FpdfRenderer.compile tags engine', ($result['engine'] ?? null) === 'fpdf');
ok('FpdfRenderer.compile records duration_ms', isset($result['duration_ms']) && is_int($result['duration_ms']));
ok('FpdfRenderer.compile preserves pdf_path', ($result['pdf_path'] ?? null) === '/tmp/fake.pdf');

// 3. Factory resolution: default and override.
ok('Factory default engine resolves to fpdf',
    RendererFactory::resolveEngine(null) === RendererFactory::ENGINE_FPDF);

// Live instantiation requires MySQL (LatexService eagerly boots model
// singletons whose ctor connects via PDO and dies on failure, so we can't
// catch it). Probe the socket first and skip cleanly when unreachable.
$dbReachable = false;
$fp = @fsockopen(DB_HOST, (int) DB_PORT, $errno, $errstr, 1.0);
if ($fp) { $dbReachable = true; fclose($fp); }

if ($dbReachable) {
    $default = RendererFactory::make(null);
    ok('Factory.make(null) returns FpdfRenderer', $default instanceof FpdfRenderer);

    $forced = RendererFactory::make(null, RendererFactory::ENGINE_LATEX);
    if (class_exists('LatexRenderer')) {
        ok('Factory.make(latex) returns FallbackRenderer-wrapped LatexRenderer',
            $forced instanceof FallbackRenderer);
        ok('FallbackRenderer reports primary engine name',
            $forced->name() === 'xelatex');
    } else {
        ok('Factory falls back to FpdfRenderer when LatexRenderer is missing',
            $forced instanceof FpdfRenderer);
    }

    $forcedFpdf = RendererFactory::make(null, RendererFactory::ENGINE_FPDF);
    ok('Factory honors explicit fpdf override', $forcedFpdf instanceof FpdfRenderer);
} else {
    echo "  SKIP Factory live-instantiation (MySQL not reachable at "
        . DB_HOST . ':' . DB_PORT . ")\n";
}

echo "\n========================================\n";
echo "$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
