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

// 2. LatexRenderer is the only production renderer.
$renderer = new LatexRenderer();
ok('LatexRenderer implements RendererInterface', $renderer instanceof RendererInterface);
ok('LatexRenderer name() == "xelatex"', $renderer->name() === 'xelatex');

// 3. Removed legacy renderers stay removed.
ok('FpdfRenderer class is absent', !class_exists('FpdfRenderer'));
ok('FallbackRenderer class is absent', !class_exists('FallbackRenderer'));

// 4. Factory resolution: default and legacy overrides normalize to latex.
ok('Factory default engine resolves to latex',
    RendererFactory::resolveEngine(null) === RendererFactory::ENGINE_LATEX);

$default = RendererFactory::make(null);
ok('Factory.make(null) returns LatexRenderer', $default instanceof LatexRenderer);

$forcedLatex = RendererFactory::make(null, RendererFactory::ENGINE_LATEX);
ok('Factory honors explicit latex override', $forcedLatex instanceof LatexRenderer);

$legacyFpdf = RendererFactory::make(null, 'fpdf');
ok('Factory maps legacy fpdf override to LatexRenderer', $legacyFpdf instanceof LatexRenderer);

$legacyXelatex = RendererFactory::make(null, 'xelatex');
ok('Factory maps legacy xelatex override to LatexRenderer', $legacyXelatex instanceof LatexRenderer);

echo "\n========================================\n";
echo "$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
