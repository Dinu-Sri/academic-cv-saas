<?php

/**
 * Local CV design preview — production-faithful PDF generation.
 *
 * Uses the same stack as live compile:
 *   Template + DemoCvDataFactory | real CVProfile
 *   → CvDataNormalizer
 *   → LatexRenderer::buildDocument
 *   → xelatex (two passes)
 *
 * Usage (from repo root, XAMPP PHP):
 *   C:\xampp\php\php.exe scripts/design/preview_cv_template.php --template=classic
 *   C:\xampp\php\php.exe scripts/design/preview_cv_template.php --template=1
 *   C:\xampp\php\php.exe scripts/design/preview_cv_template.php --template=classic --profile-id=12
 *   C:\xampp\php\php.exe scripts/design/preview_cv_template.php --list
 *
 * Output:
 *   storage/design-previews/{label}/cv.pdf
 *   storage/design-previews/{label}/cv.tex
 *   storage/design-previews/{label}/meta.json
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

define('BASE_PATH', dirname(__DIR__, 2));
define('APP_PATH', BASE_PATH . '/app');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('PUBLIC_PATH', BASE_PATH . '/public');

spl_autoload_register(static function (string $class): void {
    $paths = [
        APP_PATH . '/' . $class . '.php',
        APP_PATH . '/controllers/' . $class . '.php',
        APP_PATH . '/models/' . $class . '.php',
        APP_PATH . '/services/' . $class . '.php',
        APP_PATH . '/contracts/' . $class . '.php',
    ];
    foreach ($paths as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
});

$envFile = BASE_PATH . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\"'");
        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

/** @var array<string, int> */
const TEMPLATE_ALIASES = [
    'classic' => 1,
    'classic-academic' => 1,
    '1' => 1,
    'modern' => 2,
    '2' => 2,
    'detailed' => 3,
    '3' => 3,
    'classic-faculty' => 4,
    'faculty' => 4,
    '4' => 4,
    'european' => 5,
    'european-formal' => 5,
    'eu' => 5,
    '5' => 5,
    'research-dossier' => 6,
    'dossier' => 6,
    '6' => 6,
];

$args = parseArgs($argv);
if (!empty($args['help']) || (!empty($args['list']) === false && empty($args['template']) && empty($args['profile-id']))) {
    printUsage();
    if (empty($args['list']) && empty($args['template']) && empty($args['profile-id'])) {
        // Default to classic when no args: most common design loop.
        $args['template'] = 'classic';
        echo "No --template given; defaulting to classic (id=1).\n\n";
    } elseif (!empty($args['help'])) {
        exit(0);
    }
}

if (!empty($args['list'])) {
    listTemplates();
    exit(0);
}

$renderer = new LatexRenderer();
$label = (string) ($args['label'] ?? '');
$outRoot = STORAGE_PATH . '/design-previews';
$forceOffline = !empty($args['offline']);

try {
    if (!empty($args['profile-id'])) {
        if ($forceOffline) {
            throw new RuntimeException('--profile-id requires MySQL; cannot use --offline.');
        }
        $profileId = (int) $args['profile-id'];
        if ($profileId <= 0) {
            throw new RuntimeException('Invalid --profile-id');
        }
        $label = $label !== '' ? $label : ('profile_' . $profileId);
        $result = $renderer->generateDesignPreviewFromProfile($profileId, [
            'label' => $label,
            'output_dir' => $outRoot . '/' . $label,
            'style_config_overrides' => parseStyleOverrides($args['style'] ?? null),
        ]);
    } else {
        $templateId = resolveTemplateId((string) ($args['template'] ?? 'classic'));
        $slug = array_search($templateId, TEMPLATE_ALIASES, true);
        $label = $label !== '' ? $label : ('template_' . $templateId . '_' . ($slug ?: 'id'));
        // Prefer stable folder for classic design loop.
        if ($templateId === 1 && empty($args['label'])) {
            $label = 'classic';
        }

        if ($forceOffline || !databaseIsReachable()) {
            if ($templateId !== 1) {
                throw new RuntimeException(
                    'Offline mode currently supports Classic (id=1) only. Start MySQL for other templates, or use --template=classic --offline.'
                );
            }
            if (!$forceOffline) {
                echo "MySQL unavailable — using offline Classic demo payload (same DemoCvDataFactory entries).\n";
            } else {
                echo "Offline Classic mode (no DB).\n";
            }
            $factory = new DemoCvDataFactory();
            $demo = $factory->buildClassicOffline();
            $result = $renderer->generateDesignPreviewFromPayload(
                $demo['personal_info'],
                $demo['sections'],
                DemoCvDataFactory::classicStyleConfig(),
                [
                    'label' => $label,
                    'output_dir' => $outRoot . '/' . $label,
                    'style_config_overrides' => parseStyleOverrides($args['style'] ?? null),
                    'tex_only' => !empty($args['tex-only']),
                    'template_id' => 1,
                    'template_slug' => 'classic',
                    'template_name' => 'Classic (offline fixture)',
                ]
            );
        } else {
            $result = $renderer->generateDesignPreview($templateId, [
                'label' => $label,
                'output_dir' => $outRoot . '/' . $label,
                'style_config_overrides' => parseStyleOverrides($args['style'] ?? null),
                'tex_only' => !empty($args['tex-only']),
            ]);
        }
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}

if (empty($result['success'])) {
    fwrite(STDERR, "PDF generation FAILED\n");
    fwrite(STDERR, ($result['error'] ?? 'unknown error') . "\n");
    if (!empty($result['log'])) {
        fwrite(STDERR, "--- xelatex log (tail) ---\n" . substr((string) $result['log'], -3000) . "\n");
    }
    if (!empty($result['tex_path'])) {
        fwrite(STDERR, "TeX kept at: {$result['tex_path']}\n");
    }
    if (!empty($result['output_dir']) && is_file($result['output_dir'] . '/xelatex_error.log')) {
        fwrite(STDERR, "Full log: {$result['output_dir']}/xelatex_error.log\n");
    }
    exit(2);
}

$compiled = !empty($result['compiled']) || (!empty($result['pdf_path']) && empty($result['tex_only']));
echo ($compiled ? "OK — production pipeline PDF written\n" : "OK — production pipeline TeX written (PDF not compiled)\n");
echo "  template:  " . ($result['template_name'] ?? '') . ' (id=' . ($result['template_id'] ?? '?') . ")\n";
echo "  source:    " . ($result['data_source'] ?? '') . "\n";
echo "  engine:    " . ($result['engine'] ?? 'xelatex') . "\n";
echo "  duration:  " . ($result['duration_ms'] ?? 0) . " ms\n";
echo "  PDF:       " . ($result['pdf_path'] ?? '(not compiled)') . "\n";
echo "  TeX:       " . ($result['tex_path'] ?? '') . "\n";
echo "  meta:      " . ($result['meta_path'] ?? ($result['output_dir'] ?? '') . '/meta.json') . "\n";
if (!empty($result['warning'])) {
    echo "  note:      " . $result['warning'] . "\n";
}
if ($compiled) {
    echo "\nOpen the PDF and compare with live compile (same LatexRenderer).\n";
} else {
    echo "\nInstall TeX Live (xelatex on PATH) or set XELATEX_COMPILER, then re-run for PDF.\n";
    echo "TeX is already production-identical; compile with: xelatex -interaction=nonstopmode cv.tex\n";
}
exit(0);

// ---------------------------------------------------------------------------

function printUsage(): void
{
    $php = 'C:\\xampp\\php\\php.exe';
    echo <<<TXT
CVScholar design preview (production LatexRenderer path)

Usage:
  {$php} scripts/design/preview_cv_template.php [--template=classic|1|modern|...]
  {$php} scripts/design/preview_cv_template.php --profile-id=12
  {$php} scripts/design/preview_cv_template.php --list
  {$php} scripts/design/preview_cv_template.php --template=classic --label=classic-v2
  {$php} scripts/design/preview_cv_template.php --template=classic --style=margins=1in,pageSize=a4

Options:
  --template=NAME   Template alias or numeric id (default: classic / 1)
  --profile-id=N    Use real CV profile from MySQL (same as live compile)
  --label=NAME      Output folder name under storage/design-previews/
  --style=k=v,...   Optional style_config overrides (does not change DB)
  --offline         Force Classic offline fixture (no MySQL)
  --tex-only        Write cv.tex only (skip PDF even if xelatex exists)
  --list            List known template aliases
  --help            Show this help

Requires: MySQL for live template rows / --profile-id (auto-falls back to Classic offline).
PDF requires xelatex on PATH (or XELATEX_COMPILER full path). Without xelatex, TeX is still written.

TXT;
}

function databaseIsReachable(): bool
{
    try {
        Database::getConnection();
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function listTemplates(): void
{
    echo "Template aliases → id\n";
    $seen = [];
    foreach (TEMPLATE_ALIASES as $alias => $id) {
        if (isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $names = array_keys(array_filter(TEMPLATE_ALIASES, static fn($v) => $v === $id));
        echo sprintf("  %d  %s\n", $id, implode(', ', $names));
    }
}

function resolveTemplateId(string $raw): int
{
    $key = strtolower(trim($raw));
    if ($key === '') {
        return 1;
    }
    if (isset(TEMPLATE_ALIASES[$key])) {
        return TEMPLATE_ALIASES[$key];
    }
    if (ctype_digit($key)) {
        return (int) $key;
    }
    throw new RuntimeException("Unknown template '{$raw}'. Use --list.");
}

/**
 * @return array<string, mixed>
 */
function parseStyleOverrides(?string $raw): array
{
    if ($raw === null || trim($raw) === '') {
        return [];
    }
    $out = [];
    foreach (explode(',', $raw) as $pair) {
        $pair = trim($pair);
        if ($pair === '' || !str_contains($pair, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $pair, 2);
        $k = trim($k);
        $v = trim($v);
        if ($k === '') {
            continue;
        }
        if (in_array(strtolower($v), ['true', 'false'], true)) {
            $out[$k] = strtolower($v) === 'true';
        } elseif (is_numeric($v)) {
            $out[$k] = str_contains($v, '.') ? (float) $v : (int) $v;
        } else {
            $out[$k] = $v;
        }
    }
    return $out;
}

/**
 * @return array<string, mixed>
 */
function parseArgs(array $argv): array
{
    $out = [];
    foreach (array_slice($argv, 1) as $arg) {
        if ($arg === '--help' || $arg === '-h') {
            $out['help'] = true;
            continue;
        }
        if ($arg === '--list') {
            $out['list'] = true;
            continue;
        }
        if (str_starts_with($arg, '--') && str_contains($arg, '=')) {
            [$k, $v] = explode('=', substr($arg, 2), 2);
            $out[$k] = $v;
            continue;
        }
        if (str_starts_with($arg, '--')) {
            $out[substr($arg, 2)] = true;
        }
    }
    return $out;
}
