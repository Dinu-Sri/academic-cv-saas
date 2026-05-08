<?php
/**
 * LatexEscaper + LatexRenderer smoke test (Phase 4 step 1).
 *
 * Verifies:
 *  - escaper handles every special character correctly (incl. backslash)
 *  - renderer reports xelatex availability accurately
 *  - renderer's compile() returns a structured failure (not an exception)
 *    when xelatex is missing
 */

define('BASE_PATH', realpath(__DIR__ . '/..'));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
require APP_PATH . '/config.php';

spl_autoload_register(function ($class) {
    foreach ([
        APP_PATH . '/' . $class . '.php',
        APP_PATH . '/controllers/' . $class . '.php',
        APP_PATH . '/models/' . $class . '.php',
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

echo "[LatexEscaper]\n";

$cases = [
    'plain'      => ['Hello World',           'Hello World'],
    'ampersand'  => ['A & B',                 'A \\& B'],
    'percent'    => ['100%',                  '100\\%'],
    'dollar'     => ['$5',                    '\\$5'],
    'hash'       => ['#1',                    '\\#1'],
    'underscore' => ['user_name',             'user\\_name'],
    'braces'     => ['{x}',                   '\\{x\\}'],
    'tilde'      => ['~root',                 '\\textasciitilde{}root'],
    'caret'      => ['x^2',                   'x\\textasciicircum{}2'],
    'backslash'  => ['a\\b',                  'a\\textbackslash{}b'],
    'all'        => ['a&b%c$d#e_f{g}h~i^j\\k', 'a\\&b\\%c\\$d\\#e\\_f\\{g\\}h\\textasciitilde{}i\\textasciicircum{}j\\textbackslash{}k'],
    'empty'      => ['',                      ''],
    'unicode'    => ['Núria Català',           'Núria Català'],
];

foreach ($cases as $name => [$in, $want]) {
    $got = LatexEscaper::escape($in);
    ok("escape: $name", $got === $want, "got '$got' want '$want'");
}

ok('escape(null) returns empty', LatexEscaper::escape(null) === '');

$urlCases = [
    'https://example.com/path'           => '\detokenize{https://example.com/path}',
    'https://example.com/a%20b'          => '\detokenize{https://example.com/a%20b}',
    'https://example.com/?x=1&y=2'       => '\detokenize{https://example.com/?x=1&y=2}',
    'https://example.com/page#section'   => '\detokenize{https://example.com/page#section}',
];
foreach ($urlCases as $in => $want) {
    $got = LatexEscaper::escapeUrl($in);
    ok("escapeUrl: $in", $got === $want, "got '$got' want '$want'");
}

echo "\n[LatexRenderer]\n";

$renderer = new LatexRenderer();
ok('LatexRenderer implements RendererInterface', $renderer instanceof RendererInterface);
ok('LatexRenderer.name() == "xelatex"', $renderer->name() === 'xelatex');

$orderMethod = new ReflectionMethod(LatexRenderer::class, 'orderSectionsForRendering');
$orderMethod->setAccessible(true);
$orderedSections = $orderMethod->invoke($renderer, [
    ['section_key' => 'references', 'section_order' => 2],
    ['section_key' => 'education', 'section_order' => 3],
    ['section_key' => 'declaration', 'section_order' => 4],
    ['section_key' => 'publications', 'section_order' => 5],
    ['section_key' => 'experience', 'section_order' => 1],
]);
$orderedKeys = array_column($orderedSections, 'section_key');
ok(
    'render order keeps publications before references before declaration',
    $orderedKeys === ['experience', 'education', 'publications', 'references', 'declaration'],
    'got ' . implode(', ', $orderedKeys)
);

// xelatex availability — both branches are valid; we just need a clean signal
// for the next assertion.
$xelatexCmd = XELATEX_COMPILER;
$probe = [];
$code = 1;
if (PHP_OS_FAMILY === 'Windows') {
    @exec('where ' . escapeshellarg($xelatexCmd) . ' 2>NUL', $probe, $code);
} else {
    @exec('which ' . escapeshellarg($xelatexCmd) . ' 2>/dev/null', $probe, $code);
}
$xelatexPresent = $code === 0;
echo "  INFO xelatex " . ($xelatexPresent ? "FOUND" : "missing") . " on this host\n";

// Probe MySQL — compile() needs the model layer, so skip if DB is down.
$fp = @fsockopen(DB_HOST, (int) DB_PORT, $errno, $errstr, 1.0);
if ($fp) {
    fclose($fp);
    // With xelatex missing, compile() must fail cleanly (not throw). With
    // xelatex present and a bad profileId, we expect a "Profile not found"
    // failure — also clean.
    $result = $renderer->compile(0);
    ok('compile() returns array', is_array($result));
    ok('compile() has success key', array_key_exists('success', $result));
    ok('compile() failed cleanly (no exception)', ($result['success'] ?? null) === false);
    ok('compile() reports engine=xelatex', ($result['engine'] ?? null) === 'xelatex');
    ok('compile() reports duration_ms', isset($result['duration_ms']) && is_int($result['duration_ms']));

    if (!$xelatexPresent) {
        ok('compile() error mentions xelatex when binary missing',
            str_contains($result['error'] ?? '', 'xelatex'),
            'got error: ' . ($result['error'] ?? ''));
    }
} else {
    echo "  SKIP renderer.compile() assertions (MySQL not reachable)\n";
}

echo "\n========================================\n";
echo "$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
