<?php
/**
 * Deploy probe — no auth, no DB.
 * Open https://your-domain/version.php after Portainer rebuild.
 * Expected: layout_version = classic-layout-v6 (or newer).
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$root = dirname(__DIR__);
$rendererFile = $root . '/app/services/LatexRenderer.php';
$controllerFile = $root . '/app/controllers/CVController.php';

$layoutVersion = null;
$demoCacheVersion = null;
if (is_file($rendererFile)) {
    $src = (string) file_get_contents($rendererFile);
    if (preg_match("/LAYOUT_VERSION\\s*=\\s*'([^']+)'/", $src, $m)) {
        $layoutVersion = $m[1];
    }
    if (preg_match("/DEMO_CACHE_VERSION\\s*=\\s*'([^']+)'/", $src, $m)) {
        $demoCacheVersion = $m[1];
    }
}

$hasLayoutJsonField = is_file($controllerFile)
    && str_contains((string) file_get_contents($controllerFile), 'layout_version');

$gitSha = null;
$headFile = $root . '/.git/HEAD';
if (is_file($headFile)) {
    $head = trim((string) file_get_contents($headFile));
    if (str_starts_with($head, 'ref:')) {
        $ref = trim(substr($head, 4));
        $refFile = $root . '/.git/' . $ref;
        if (is_file($refFile)) {
            $gitSha = trim((string) file_get_contents($refFile));
        }
    } else {
        $gitSha = $head;
    }
}

echo json_encode([
    'ok' => true,
    'service' => 'cvscholar-php',
    'layout_version' => $layoutVersion,
    'demo_cache_version' => $demoCacheVersion,
    'compile_json_has_layout_version' => $hasLayoutJsonField,
    'git_sha' => $gitSha ? substr($gitSha, 0, 12) : null,
    'php' => PHP_VERSION,
    'time' => date('c'),
    'deploy_ok' => $layoutVersion === 'classic-layout-v6' && $hasLayoutJsonField === true,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
