<?php
/**
 * FallbackRenderer unit test.
 *
 * Uses in-memory stub renderers so we never touch MySQL or xelatex.
 */

define('BASE_PATH', realpath(__DIR__ . '/..'));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
require APP_PATH . '/config.php';

spl_autoload_register(function ($class) {
    foreach ([
        APP_PATH . '/' . $class . '.php',
        APP_PATH . '/services/' . $class . '.php',
        APP_PATH . '/contracts/' . $class . '.php',
    ] as $p) {
        if (file_exists($p)) { require_once $p; return; }
    }
});

$pass = 0; $fail = 0;
function ok(string $label, bool $cond, string $detail = ''): void
{
    global $pass, $fail;
    if ($cond) { $pass++; echo "  OK   $label\n"; }
    else       { $fail++; echo "  FAIL $label -- $detail\n"; }
}

class StubRenderer implements RendererInterface
{
    public string $stubName;
    public array $stubResult;
    public int $callCount = 0;
    public function __construct(string $name, array $result)
    {
        $this->stubName = $name;
        $this->stubResult = $result;
    }
    public function name(): string { return $this->stubName; }
    public function compile(int $profileId): array
    {
        $this->callCount++;
        return $this->stubResult;
    }
}

echo "[FallbackRenderer]\n";

// --- Case 1: primary succeeds — fallback must NOT be invoked.
$primary = new StubRenderer('xelatex', ['success' => true, 'pdf_path' => '/tmp/a.pdf', 'engine' => 'xelatex']);
$secondary = new StubRenderer('fpdf', ['success' => true, 'pdf_path' => '/tmp/b.pdf', 'engine' => 'fpdf']);
// Cast secondary to FpdfRenderer would be ideal, but the constructor signature
// accepts ?FpdfRenderer specifically. Use reflection trick: skip secondary and
// rely on the lazy `new FpdfRenderer()` path being unreachable when primary
// succeeds.
$fb = new FallbackRenderer($primary);
$res = $fb->compile(1);
ok('primary success returned verbatim', ($res['pdf_path'] ?? null) === '/tmp/a.pdf');
ok('primary success: no fallback flag', !isset($res['fallback']));
ok('primary called exactly once on success', $primary->callCount === 1);

// --- Case 2: primary fails — secondary is invoked, result tagged.
class StubFpdfRenderer extends FpdfRenderer
{
    public int $callCount = 0;
    public array $stubResult;
    public function __construct(array $result) { $this->stubResult = $result; }
    public function compile(int $profileId): array
    {
        $this->callCount++;
        return $this->stubResult;
    }
}

$failingPrimary = new StubRenderer('xelatex', ['success' => false, 'error' => 'compile timeout', 'engine' => 'xelatex']);
$workingSecondary = new StubFpdfRenderer(['success' => true, 'pdf_path' => '/tmp/fallback.pdf', 'engine' => 'fpdf']);
$fb2 = new FallbackRenderer($failingPrimary, $workingSecondary);
$res2 = $fb2->compile(42);

ok('failing primary triggers secondary',     ($res2['pdf_path'] ?? null) === '/tmp/fallback.pdf');
ok('result tagged fallback=true',            ($res2['fallback'] ?? false) === true);
ok('result records primary_engine',          ($res2['primary_engine'] ?? null) === 'xelatex');
ok('result records primary_error',           ($res2['primary_error'] ?? null) === 'compile timeout');
ok('secondary called exactly once on failure', $workingSecondary->callCount === 1);

// --- Case 3: name() reports the primary's name (admin diagnostics).
ok('name() reflects primary identity', $fb2->name() === 'xelatex');

// --- Case 4: never recurse — wrapping fpdf in FallbackRenderer should not
//     attempt a second fpdf render.
$failingFpdf = new StubFpdfRenderer(['success' => false, 'error' => 'disk full']);
$shouldNotBeCalled = new StubFpdfRenderer(['success' => true, 'pdf_path' => '/tmp/x.pdf']);
// We can't easily build a FallbackRenderer wrapping fpdf because the primary
// is typed as RendererInterface; we use a stub with name "fpdf" instead.
$fpdfPrimary = new StubRenderer('fpdf', ['success' => false, 'error' => 'disk full']);
$fb3 = new FallbackRenderer($fpdfPrimary, $shouldNotBeCalled);
$res3 = $fb3->compile(99);
ok('fpdf primary failure is NOT retried (no recursion)',
    ($res3['error'] ?? null) === 'disk full' && $shouldNotBeCalled->callCount === 0);

echo "\n========================================\n";
echo "$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
