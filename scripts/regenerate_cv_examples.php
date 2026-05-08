<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('PUBLIC_PATH', BASE_PATH . '/public');

spl_autoload_register(function ($class) {
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
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!getenv($key)) {
            putenv($key . '=' . $value);
        }
    }
}

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

$examples = [
    ['template_id' => 1, 'slug' => 'classic-academic-sample-cv', 'name' => 'Classic Academic', 'template' => 'Classic'],
    ['template_id' => 4, 'slug' => 'classic-faculty-cv', 'name' => 'Classic Faculty', 'template' => 'Classic'],
    ['template_id' => 2, 'slug' => 'modern-professional', 'name' => 'Modern Professional', 'template' => 'Modern'],
    ['template_id' => 3, 'slug' => 'detailed-academic', 'name' => 'Detailed Academic', 'template' => 'Detailed'],
    ['template_id' => 5, 'slug' => 'european-formal-academic-cv', 'name' => 'European Formal', 'template' => 'EU Formal'],
    ['template_id' => 6, 'slug' => 'research-dossier-cv', 'name' => 'Research Dossier', 'template' => 'Dossier'],
];

$assetDir = PUBLIC_PATH . '/assets/images/cv-examples';
$workDir = STORAGE_PATH . '/temp/cv_examples_' . date('Ymd_His');
@mkdir($assetDir, 0775, true);
@mkdir($workDir, 0775, true);

$ghostscript = getenv('GHOSTSCRIPT_BIN') ?: findCommand(PHP_OS_FAMILY === 'Windows' ? 'gswin64c.exe' : 'gs');
if (!$ghostscript) {
    fwrite(STDERR, "Ghostscript is required. Set GHOSTSCRIPT_BIN or install gs/gswin64c.\n");
    exit(1);
}

$webpMode = resolveWebpMode();
if ($webpMode === null) {
    fwrite(STDERR, "WebP conversion requires PHP GD imagewebp(), cwebp, or ImageMagick magick.\n");
    exit(1);
}

$renderer = new LatexRenderer();
$manifest = [];

try {
    foreach ($examples as $example) {
        $slug = $example['slug'];
        echo "Rendering {$example['name']}...\n";

        $pdfPath = STORAGE_PATH . '/demos/homepage_' . $slug . '_' . LatexRenderer::DEMO_CACHE_VERSION . '.pdf';
        $result = $renderer->generateDemoPDF((int) $example['template_id'], $pdfPath, true);
        if (empty($result['success'])) {
            throw new RuntimeException($example['name'] . ': ' . ($result['error'] ?? 'demo PDF generation failed'));
        }

        foreach (glob($assetDir . '/' . $slug . '-page-*.webp') ?: [] as $oldPage) {
            @unlink($oldPage);
        }
        @unlink($assetDir . '/' . $slug . '-cover.webp');

        $pngPattern = $workDir . '/' . $slug . '-page-%d.png';
        runCommand([
            $ghostscript,
            '-dSAFER',
            '-dBATCH',
            '-dNOPAUSE',
            '-sDEVICE=png16m',
            '-r170',
            '-dTextAlphaBits=4',
            '-dGraphicsAlphaBits=4',
            '-sOutputFile=' . $pngPattern,
            $pdfPath,
        ]);

        $pngPages = glob($workDir . '/' . $slug . '-page-*.png') ?: [];
        natsort($pngPages);
        $pageCount = count($pngPages);
        if ($pageCount < 1) {
            throw new RuntimeException($example['name'] . ': Ghostscript produced no page images');
        }

        $pageNumber = 1;
        foreach ($pngPages as $pngPage) {
            convertPngToWebp($pngPage, $assetDir . '/' . $slug . '-page-' . $pageNumber . '.webp', $webpMode);
            if ($pageNumber === 1) {
                convertPngToWebp($pngPage, $assetDir . '/' . $slug . '-cover.webp', $webpMode);
            }
            @unlink($pngPage);
            $pageNumber++;
        }

        $manifest[] = [
            'slug' => $slug,
            'name' => $example['name'],
            'pages' => $pageCount,
            'template' => $example['template'],
        ];

        echo "  {$pageCount} page(s) written.\n";
    }

    file_put_contents(
        $assetDir . '/manifest.json',
        json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
    );

    echo "Done. Updated {$assetDir}/manifest.json\n";
} finally {
    foreach (glob($workDir . '/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($workDir);
}

function findCommand(string $command): ?string
{
    $probe = PHP_OS_FAMILY === 'Windows'
        ? ['where.exe', $command]
        : ['sh', '-lc', 'command -v ' . escapeshellarg($command)];

    [$ok, $output] = runCommand($probe, false);
    if (!$ok) {
        return null;
    }

    $lines = preg_split('/\R/', trim($output)) ?: [];
    return $lines[0] ?? null;
}

function resolveWebpMode(): ?array
{
    if (function_exists('imagecreatefrompng') && function_exists('imagewebp')) {
        return ['type' => 'gd'];
    }

    $cwebp = findCommand(PHP_OS_FAMILY === 'Windows' ? 'cwebp.exe' : 'cwebp');
    if ($cwebp) {
        return ['type' => 'cwebp', 'bin' => $cwebp];
    }

    $magick = findCommand(PHP_OS_FAMILY === 'Windows' ? 'magick.exe' : 'magick');
    if ($magick) {
        return ['type' => 'magick', 'bin' => $magick];
    }

    return null;
}

function convertPngToWebp(string $pngPath, string $webpPath, array $mode): void
{
    if ($mode['type'] === 'gd') {
        $image = imagecreatefrompng($pngPath);
        if (!$image) {
            throw new RuntimeException('Unable to open PNG: ' . $pngPath);
        }
        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);
        if (!imagewebp($image, $webpPath, 86)) {
            imagedestroy($image);
            throw new RuntimeException('Unable to write WebP: ' . $webpPath);
        }
        imagedestroy($image);
        return;
    }

    if ($mode['type'] === 'cwebp') {
        runCommand([$mode['bin'], '-quiet', '-q', '86', $pngPath, '-o', $webpPath]);
        return;
    }

    runCommand([$mode['bin'], $pngPath, '-quality', '86', $webpPath]);
}

function runCommand(array $command, bool $throw = true): array
{
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $process = proc_open($command, $descriptors, $pipes, BASE_PATH);
    if (!is_resource($process)) {
        if ($throw) {
            throw new RuntimeException('Unable to start command: ' . implode(' ', $command));
        }
        return [false, ''];
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);
    $output = trim((string) $stdout . "\n" . (string) $stderr);
    if ($exitCode !== 0 && $throw) {
        throw new RuntimeException("Command failed ({$exitCode}): " . implode(' ', $command) . "\n" . $output);
    }

    return [$exitCode === 0, $output];
}