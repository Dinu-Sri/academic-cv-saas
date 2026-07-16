<?php
/**
 * LatexRenderer
 *
 * Production xelatex backend.
 *
 * Design contract:
 *  - Generates a self-contained .tex from normalized profile data; does NOT
 *    rely on any DB-stored LaTeX template fragments.
 *  - Always escapes user input via LatexEscaper before substitution.
 *  - Spawns xelatex via proc_open with hard timeout, captured stderr, and an
 *    output-size cap so a runaway compile cannot exhaust disk or CPU.
 *  - Never throws on missing binary or compile failure: returns a structured
 *    error payload for controller-safe JSON handling.
 *
 * Per-template LaTeX fragments in the DB are not used here; the renderer
 * builds a controlled document from normalized profile data.
 */
class LatexRenderer implements RendererInterface
{
    public const DEMO_CACHE_VERSION = 'xelatex-v5';

    private ?CVProfile $cvModel = null;
    private ?Template $templateModel = null;

    public function name(): string
    {
        return 'xelatex';
    }

    public function compile(int $profileId): array
    {
        $start = microtime(true);

        // 1. Verify xelatex availability up front — cheap check, lets the
        //    factory fall back without paying any tex generation cost.
        if (!$this->isCompilerAvailable()) {
            return $this->fail('xelatex binary not available on this host', $start);
        }

        $this->cvModel ??= new CVProfile();
        $this->templateModel ??= new Template();

        $profile = $this->cvModel->findById($profileId);
        if (!$profile) {
            return $this->fail('Profile not found.', $start);
        }
        $template = $this->templateModel->findById((int) $profile['template_id']);
        if (!$template) {
            return $this->fail('Template not found.', $start);
        }

        // 2. Normalize through the same data layer FPDF uses.
        $personalInfo = CvDataNormalizer::normalizePersonalInfo($profile['personal_info'] ?? []);
        $sections = CvDataNormalizer::normalizeSections($this->cvModel->getSections($profileId));
        $styleConfig = is_array($template['style_config'] ?? null) ? $template['style_config'] : [];

        // Per-CV settings (e.g. custom heading color) override template defaults.
        $profileSettings = [];
        if (!empty($profile['cv_settings'])) {
            $decoded = is_array($profile['cv_settings'])
                ? $profile['cv_settings']
                : json_decode((string) $profile['cv_settings'], true);
            if (is_array($decoded)) {
                $profileSettings = $decoded;
            }
        }
        if (!empty($profileSettings)) {
            $styleConfig = array_merge($styleConfig, $profileSettings);
        }

        // 3. Build the .tex string.
        $tex = $this->buildDocument($personalInfo, $sections, $styleConfig);

        // 4. Compile.
        $result = $this->runXelatex($tex, $profileId, (int) $profile['user_id']);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        return $result;
    }

    public function generateDemoPDF(int $templateId, ?string $outputPath = null, bool $force = false): array
    {
        $start = microtime(true);

        if (!$this->isCompilerAvailable()) {
            return $this->fail('xelatex binary not available on this host', $start);
        }

        $this->templateModel ??= new Template();
        $template = $this->templateModel->findById($templateId);
        if (!$template) {
            return $this->fail('Template not found.', $start);
        }

        $demoDir = STORAGE_PATH . '/demos';
        $outputPath ??= $demoDir . '/demo_template_' . $templateId . '_' . self::DEMO_CACHE_VERSION . '.pdf';
        if (!$force && is_file($outputPath) && filesize($outputPath) > 0) {
            return [
                'success' => true,
                'pdf_path' => $outputPath,
                'engine' => 'xelatex',
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'cached' => true,
            ];
        }

        $factory = new DemoCvDataFactory();
        $demo = $factory->buildForTemplate($templateId, $this->templateModel->getSections($templateId));
        $styleConfig = is_array($template['style_config'] ?? null) ? $template['style_config'] : [];
        $styleConfig['primaryColor'] = '#000000';

        $tex = $this->buildDocument($demo['personal_info'], $demo['sections'], $styleConfig);
        $result = $this->compileTexToPath($tex, 'demo_template_' . $templateId, $outputPath, 'demo_template_' . $templateId);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        $result['cached'] = false;
        return $result;
    }

    /**
     * Design-preview path used by local scripts.
     *
     * Uses the exact same data normalization + buildDocument + xelatex pipeline
     * as compile() / generateDemoPDF(), but always writes the intermediate .tex
     * next to the PDF so designers can iterate with fidelity to production.
     *
     * @param array{
     *   output_dir?: string,
     *   keep_tex?: bool,
     *   personal_info?: array,
     *   sections?: array,
     *   style_config_overrides?: array,
     *   label?: string
     * } $options
     */
    public function generateDesignPreview(int $templateId, array $options = []): array
    {
        $start = microtime(true);
        $texOnly = !empty($options['tex_only']);

        $this->templateModel ??= new Template();
        $template = $this->templateModel->findById($templateId);
        if (!$template) {
            return $this->fail('Template not found.', $start);
        }

        $label = preg_replace('/[^a-zA-Z0-9_-]+/', '_', (string) ($options['label'] ?? ($template['slug'] ?? ('template_' . $templateId)))) ?: 'template';
        $outputDir = rtrim((string) ($options['output_dir'] ?? (STORAGE_PATH . '/design-previews/' . $label)), '/\\');
        if (!is_dir($outputDir) && !@mkdir($outputDir, 0755, true)) {
            return $this->fail('Cannot create design preview output dir: ' . $outputDir, $start);
        }

        if (!empty($options['personal_info']) && !empty($options['sections'])) {
            $personalInfo = CvDataNormalizer::normalizePersonalInfo($options['personal_info']);
            $sections = CvDataNormalizer::normalizeSections($options['sections']);
            $dataSource = 'provided';
        } else {
            $factory = new DemoCvDataFactory();
            $demo = $factory->buildForTemplate($templateId, $this->templateModel->getSections($templateId));
            $personalInfo = CvDataNormalizer::normalizePersonalInfo($demo['personal_info']);
            $sections = CvDataNormalizer::normalizeSections($demo['sections']);
            $dataSource = 'demo_factory';
        }

        $styleConfig = is_array($template['style_config'] ?? null) ? $template['style_config'] : [];
        if (!empty($options['style_config_overrides']) && is_array($options['style_config_overrides'])) {
            $styleConfig = array_merge($styleConfig, $options['style_config_overrides']);
        }

        // Match production demo heading colour default for visual comparison.
        if (!array_key_exists('primaryColor', $styleConfig) || $styleConfig['primaryColor'] === '') {
            $styleConfig['primaryColor'] = '#000000';
        }

        $tex = $this->buildDocument($personalInfo, $sections, $styleConfig);
        $texPath = $outputDir . '/cv.tex';
        $pdfPath = $outputDir . '/cv.pdf';
        $metaPath = $outputDir . '/meta.json';

        file_put_contents($texPath, $tex);

        $compilerOk = $this->isCompilerAvailable();
        if ($texOnly || !$compilerOk) {
            $meta = [
                'generated_at' => date('c'),
                'template_id' => $templateId,
                'template_slug' => $template['slug'] ?? '',
                'template_name' => $template['name'] ?? '',
                'data_source' => $dataSource,
                'engine' => 'xelatex',
                'compiled' => false,
                'tex_only' => true,
                'compiler_available' => $compilerOk,
                'demo_cache_version' => self::DEMO_CACHE_VERSION,
                'pdf_path' => null,
                'tex_path' => $texPath,
                'style_config' => $styleConfig,
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'pipeline' => [
                    'normalizer' => 'CvDataNormalizer',
                    'renderer' => 'LatexRenderer::buildDocument',
                    'same_as_live_tex' => true,
                    'same_as_live_pdf' => false,
                    'note' => $compilerOk
                        ? 'tex_only flag set; PDF not compiled'
                        : 'xelatex not on PATH; wrote TeX only. Install TeX Live and re-run for PDF.',
                ],
            ];
            file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
            return [
                'success' => true,
                'compiled' => false,
                'tex_only' => true,
                'engine' => 'xelatex',
                'duration_ms' => $meta['duration_ms'],
                'template_id' => $templateId,
                'template_slug' => $template['slug'] ?? '',
                'template_name' => $template['name'] ?? '',
                'data_source' => $dataSource,
                'tex_path' => $texPath,
                'pdf_path' => null,
                'meta_path' => $metaPath,
                'style_config' => $styleConfig,
                'output_dir' => $outputDir,
                'warning' => $meta['pipeline']['note'],
            ];
        }

        $result = $this->compileTexToPath($tex, 'design_' . $label, $pdfPath, 'design_' . $label);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        $result['template_id'] = $templateId;
        $result['template_slug'] = $template['slug'] ?? '';
        $result['template_name'] = $template['name'] ?? '';
        $result['data_source'] = $dataSource;
        $result['tex_path'] = $texPath;
        $result['style_config'] = $styleConfig;
        $result['output_dir'] = $outputDir;
        $result['compiled'] = !empty($result['success']);

        if (empty($result['success'])) {
            @file_put_contents($outputDir . '/xelatex_error.log', (string) ($result['log'] ?? $result['error'] ?? ''));
            return $result;
        }

        $meta = [
            'generated_at' => date('c'),
            'template_id' => $templateId,
            'template_slug' => $template['slug'] ?? '',
            'template_name' => $template['name'] ?? '',
            'data_source' => $dataSource,
            'engine' => 'xelatex',
            'compiled' => true,
            'demo_cache_version' => self::DEMO_CACHE_VERSION,
            'pdf_path' => $pdfPath,
            'tex_path' => $texPath,
            'style_config' => $styleConfig,
            'duration_ms' => $result['duration_ms'],
            'pipeline' => [
                'normalizer' => 'CvDataNormalizer',
                'renderer' => 'LatexRenderer::buildDocument + runXelatex',
                'same_as_live' => true,
            ],
        ];
        file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $result['meta_path'] = $metaPath;
        $result['pdf_path'] = $pdfPath;
        return $result;
    }

    /**
     * Design preview from an in-memory payload (no Template DB row required).
     * Still uses CvDataNormalizer + buildDocument + xelatex — same as live.
     *
     * @param array{full_name?: string, title?: string, affiliation?: string, email?: string} $personalInfo
     * @param list<array{section_key: string, display_name?: string, section_order?: int, is_visible?: int|bool, entries: list<array{data: array}>}> $sections
     */
    public function generateDesignPreviewFromPayload(array $personalInfo, array $sections, array $styleConfig, array $options = []): array
    {
        $start = microtime(true);
        $texOnly = !empty($options['tex_only']);

        $label = preg_replace('/[^a-zA-Z0-9_-]+/', '_', (string) ($options['label'] ?? 'offline')) ?: 'offline';
        $outputDir = rtrim((string) ($options['output_dir'] ?? (STORAGE_PATH . '/design-previews/' . $label)), '/\\');
        if (!is_dir($outputDir) && !@mkdir($outputDir, 0755, true)) {
            return $this->fail('Cannot create design preview output dir: ' . $outputDir, $start);
        }

        $personalInfo = CvDataNormalizer::normalizePersonalInfo($personalInfo);
        $sections = CvDataNormalizer::normalizeSections($sections);
        if (!empty($options['style_config_overrides']) && is_array($options['style_config_overrides'])) {
            $styleConfig = array_merge($styleConfig, $options['style_config_overrides']);
        }
        if (!array_key_exists('primaryColor', $styleConfig) || $styleConfig['primaryColor'] === '') {
            $styleConfig['primaryColor'] = '#000000';
        }

        $tex = $this->buildDocument($personalInfo, $sections, $styleConfig);
        $texPath = $outputDir . '/cv.tex';
        $pdfPath = $outputDir . '/cv.pdf';
        $metaPath = $outputDir . '/meta.json';
        file_put_contents($texPath, $tex);

        $compilerOk = $this->isCompilerAvailable();
        $baseMeta = [
            'generated_at' => date('c'),
            'template_id' => (int) ($options['template_id'] ?? 0),
            'template_slug' => (string) ($options['template_slug'] ?? 'offline'),
            'template_name' => (string) ($options['template_name'] ?? 'Offline design payload'),
            'data_source' => 'offline_payload',
            'engine' => 'xelatex',
            'demo_cache_version' => self::DEMO_CACHE_VERSION,
            'tex_path' => $texPath,
            'style_config' => $styleConfig,
            'pipeline' => [
                'normalizer' => 'CvDataNormalizer',
                'renderer' => 'LatexRenderer::buildDocument',
                'same_as_live_tex' => true,
            ],
        ];

        if ($texOnly || !$compilerOk) {
            $baseMeta['compiled'] = false;
            $baseMeta['tex_only'] = true;
            $baseMeta['compiler_available'] = $compilerOk;
            $baseMeta['pdf_path'] = null;
            $baseMeta['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
            $baseMeta['pipeline']['same_as_live_pdf'] = false;
            $baseMeta['pipeline']['note'] = $compilerOk
                ? 'tex_only flag set; PDF not compiled'
                : 'xelatex not on PATH; wrote TeX only.';
            file_put_contents($metaPath, json_encode($baseMeta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
            return [
                'success' => true,
                'compiled' => false,
                'tex_only' => true,
                'engine' => 'xelatex',
                'duration_ms' => $baseMeta['duration_ms'],
                'template_id' => $baseMeta['template_id'],
                'template_slug' => $baseMeta['template_slug'],
                'template_name' => $baseMeta['template_name'],
                'data_source' => 'offline_payload',
                'tex_path' => $texPath,
                'pdf_path' => null,
                'meta_path' => $metaPath,
                'style_config' => $styleConfig,
                'output_dir' => $outputDir,
                'warning' => $baseMeta['pipeline']['note'],
            ];
        }

        $result = $this->compileTexToPath($tex, 'design_' . $label, $pdfPath, 'design_' . $label);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        $result['template_id'] = $baseMeta['template_id'];
        $result['template_slug'] = $baseMeta['template_slug'];
        $result['template_name'] = $baseMeta['template_name'];
        $result['data_source'] = 'offline_payload';
        $result['tex_path'] = $texPath;
        $result['style_config'] = $styleConfig;
        $result['output_dir'] = $outputDir;
        $result['compiled'] = !empty($result['success']);
        if (empty($result['success'])) {
            @file_put_contents($outputDir . '/xelatex_error.log', (string) ($result['log'] ?? $result['error'] ?? ''));
            return $result;
        }
        $baseMeta['compiled'] = true;
        $baseMeta['pdf_path'] = $pdfPath;
        $baseMeta['duration_ms'] = $result['duration_ms'];
        $baseMeta['pipeline']['renderer'] = 'LatexRenderer::buildDocument + runXelatex';
        $baseMeta['pipeline']['same_as_live'] = true;
        file_put_contents($metaPath, json_encode($baseMeta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $result['meta_path'] = $metaPath;
        $result['pdf_path'] = $pdfPath;
        return $result;
    }

    /**
     * Compile a real profile CV into a design folder (same as live compile path).
     */
    public function generateDesignPreviewFromProfile(int $profileId, array $options = []): array
    {
        $start = microtime(true);

        if (!$this->isCompilerAvailable()) {
            return $this->fail('xelatex binary not available on this host', $start);
        }

        $this->cvModel ??= new CVProfile();
        $this->templateModel ??= new Template();

        $profile = $this->cvModel->findById($profileId);
        if (!$profile) {
            return $this->fail('Profile not found.', $start);
        }
        $templateId = (int) $profile['template_id'];
        $template = $this->templateModel->findById($templateId);
        if (!$template) {
            return $this->fail('Template not found.', $start);
        }

        $personalInfo = CvDataNormalizer::normalizePersonalInfo($profile['personal_info'] ?? []);
        $sections = CvDataNormalizer::normalizeSections($this->cvModel->getSections($profileId));
        $styleConfig = is_array($template['style_config'] ?? null) ? $template['style_config'] : [];

        $profileSettings = [];
        if (!empty($profile['cv_settings'])) {
            $decoded = is_array($profile['cv_settings'])
                ? $profile['cv_settings']
                : json_decode((string) $profile['cv_settings'], true);
            if (is_array($decoded)) {
                $profileSettings = $decoded;
            }
        }
        if (!empty($profileSettings)) {
            $styleConfig = array_merge($styleConfig, $profileSettings);
        }
        if (!empty($options['style_config_overrides']) && is_array($options['style_config_overrides'])) {
            $styleConfig = array_merge($styleConfig, $options['style_config_overrides']);
        }

        $label = preg_replace('/[^a-zA-Z0-9_-]+/', '_', (string) ($options['label'] ?? ('profile_' . $profileId))) ?: 'profile';
        $outputDir = rtrim((string) ($options['output_dir'] ?? (STORAGE_PATH . '/design-previews/' . $label)), '/\\');
        if (!is_dir($outputDir) && !@mkdir($outputDir, 0755, true)) {
            return $this->fail('Cannot create design preview output dir: ' . $outputDir, $start);
        }

        $tex = $this->buildDocument($personalInfo, $sections, $styleConfig);
        $texPath = $outputDir . '/cv.tex';
        $pdfPath = $outputDir . '/cv.pdf';
        file_put_contents($texPath, $tex);

        $result = $this->compileTexToPath($tex, 'design_profile_' . $profileId, $pdfPath, 'design_profile_' . $profileId);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        $result['template_id'] = $templateId;
        $result['profile_id'] = $profileId;
        $result['data_source'] = 'profile';
        $result['tex_path'] = $texPath;
        $result['pdf_path'] = $result['success'] ? $pdfPath : null;
        $result['output_dir'] = $outputDir;
        $result['style_config'] = $styleConfig;

        file_put_contents($outputDir . '/meta.json', json_encode([
            'generated_at' => date('c'),
            'profile_id' => $profileId,
            'template_id' => $templateId,
            'template_slug' => $template['slug'] ?? '',
            'data_source' => 'profile',
            'engine' => 'xelatex',
            'same_as_live_compile' => true,
            'style_config' => $styleConfig,
            'duration_ms' => $result['duration_ms'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

        return $result;
    }

    private function isCompilerAvailable(): bool
    {
        $compiler = XELATEX_COMPILER;
        // Full path (e.g. XELATEX_COMPILER=C:\...\xelatex.exe) — do not use `where`.
        if ($compiler !== '' && (str_contains($compiler, '/') || str_contains($compiler, '\\') || preg_match('/^[A-Za-z]:\\\\/', $compiler))) {
            return is_file($compiler) || is_executable($compiler);
        }
        if (PHP_OS_FAMILY === 'Windows') {
            @exec('where ' . escapeshellarg($compiler) . ' 2>NUL', $out, $code);
        } else {
            @exec('which ' . escapeshellarg($compiler) . ' 2>/dev/null', $out, $code);
        }
        return $code === 0;
    }

    /**
     * Run xelatex inside a temp directory with a hard timeout and output cap.
     * Uses proc_open so the timeout is enforceable.
     */
    private function runXelatex(string $tex, int $profileId, int $userId): array
    {
        $finalDir = GENERATED_DIR . '/' . $userId;
        $finalPath = $finalDir . '/cv_' . $profileId . '.pdf';

        return $this->compileTexToPath($tex, 'xelatex_' . $profileId, $finalPath, (string) $profileId);
    }

    private function compileTexToPath(string $tex, string $tempPrefix, string $outputPath, string $logId): array
    {
        $safePrefix = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $tempPrefix) ?: 'xelatex';
        $tempDir = LATEX_TEMP_DIR . '/' . $safePrefix . '_' . bin2hex(random_bytes(4));
        if (!is_dir($tempDir) && !@mkdir($tempDir, 0755, true)) {
            return ['success' => false, 'error' => 'Cannot create temp dir'];
        }

        try {
            $texFile = $tempDir . '/cv.tex';
            $pdfFile = $tempDir . '/cv.pdf';
            file_put_contents($texFile, $tex);

            $cmd = [
                XELATEX_COMPILER,
                '-interaction=nonstopmode',
                '-halt-on-error',
                '-no-shell-escape',
                '-output-directory=' . $tempDir,
                $texFile,
            ];

            // Run two LaTeX passes so references such as LastPage resolve.
            [$okFirst, $logFirst] = $this->execWithTimeout($cmd, $tempDir, XELATEX_COMPILE_TIMEOUT);
            if (!$okFirst) {
                                $this->logFailure($logId, $tex, $logFirst);
                return ['success' => false, 'error' => 'xelatex compilation failed.', 'log' => substr($logFirst, -4000)];
            }

            [$okSecond, $logSecond] = $this->execWithTimeout($cmd, $tempDir, XELATEX_COMPILE_TIMEOUT);
            $log = $logFirst . "\n" . $logSecond;

            if (!$okSecond || !file_exists($pdfFile)) {
                                $this->logFailure($logId, $tex, $log);
                return ['success' => false, 'error' => 'xelatex compilation failed.', 'log' => substr($log, -4000)];
            }

            // Output size guard — refuse to ship anything pathologically huge.
            if (filesize($pdfFile) > XELATEX_MAX_OUTPUT_BYTES) {
                return ['success' => false, 'error' => 'PDF exceeds size cap'];
            }

            $finalDir = dirname($outputPath);
            if (!is_dir($finalDir) && !@mkdir($finalDir, 0755, true)) {
                return ['success' => false, 'error' => 'Cannot create output dir'];
            }
            copy($pdfFile, $outputPath);

            return ['success' => true, 'pdf_path' => $outputPath];
        } finally {
            $this->cleanDir($tempDir);
        }
    }

    /**
     * Spawn a process, enforce a wall-clock timeout, return [exit-ok, log].
     */
    private function execWithTimeout(array $cmd, string $cwd, int $timeoutSec): array
    {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $proc = @proc_open($cmd, $descriptors, $pipes, $cwd);
        if (!is_resource($proc)) {
            return [false, 'Failed to spawn xelatex'];
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $log = '';
        $deadline = microtime(true) + $timeoutSec;
        $exit = -1;

        while (true) {
            $status = proc_get_status($proc);
            $log .= (string) stream_get_contents($pipes[1]);
            $log .= (string) stream_get_contents($pipes[2]);

            if (!$status['running']) {
                $exit = $status['exitcode'];
                break;
            }
            if (microtime(true) > $deadline) {
                proc_terminate($proc, 9);
                $log .= "\n[killed after {$timeoutSec}s]";
                break;
            }
            usleep(50_000);
        }

        foreach ($pipes as $p) { if (is_resource($p)) fclose($p); }
        proc_close($proc);
        return [$exit === 0, $log];
    }

        private function logFailure(string $profileId, string $tex, string $log): void
        {
            error_log('LatexRenderer: xelatex failed for profile ' . $profileId
                . "\n--- XELATEX LOG (last 3000 chars) ---\n" . substr($log, -3000));
            $logDir = defined('STORAGE_PATH') ? rtrim(STORAGE_PATH, '/') . '/logs' : sys_get_temp_dir();
            $safeId = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $profileId) ?: 'unknown';
            @file_put_contents($logDir . '/xelatex_fail_' . $safeId . '.tex', $tex);
            @file_put_contents($logDir . '/xelatex_fail_' . $safeId . '.log', $log);
        }

    private function cleanDir(string $dir): void
    {
        if (!is_dir($dir)) return;
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $path = $dir . '/' . $entry;
            if (is_file($path)) @unlink($path);
        }
        @rmdir($dir);
    }

    private function fail(string $message, float $start): array
    {
        return [
            'success'     => false,
            'error'       => $message,
            'engine'      => 'xelatex',
            'duration_ms' => (int) round((microtime(true) - $start) * 1000),
        ];
    }

    // ------------------------------------------------------------------
    //  Document generation
    // ------------------------------------------------------------------

    /**
     * Build a complete xelatex-compatible document.
     *
     * Design principles for the academic-CV look:
     *  - Header: large centered name, then a single tagline line (title +
     *    affiliation, suppressed individually if empty so we never emit
     *    leading commas or blank lines). Contact items concatenated with
     *    middle-dots, wrapped naturally.
     *  - Body: left-aligned section headings with a thin rule, NOT centered,
     *    NOT in all caps. Entries use a two-column "title --- date" line with
     *    \hfill, then italic organization, then a descriptive paragraph.
     *  - Typography: microtype for protrusion, raggedright body to avoid ugly
     *    inter-word stretching, \sloppy + \emergencystretch so long URLs and
     *    institution names break gracefully instead of overflowing the margin.
     */
    private function buildDocument(array $pi, array $sections, array $styleConfig): string
    {
        $pageSize = strtolower($styleConfig['pageSize'] ?? 'a4') === 'letter' ? 'letterpaper' : 'a4paper';
        $margin = $this->parseMarginCm($styleConfig['margins'] ?? '1in');
        $primary = '#000000';
        $showPageNumbers = $this->resolveShowPageNumbers($styleConfig);

        $name        = LatexEscaper::escape($pi['full_name'] ?? '');
        $title       = $this->escapeInline($pi['title'] ?? '');
        $affiliation = $this->escapeInline($pi['affiliation'] ?? '');
        $email       = LatexEscaper::escape($pi['email'] ?? '');
        $phone       = LatexEscaper::escape($pi['phone'] ?? '');
        $website     = $pi['website'] ?? '';
        $orcid       = $pi['orcid'] ?? '';
        $linkedin    = $pi['linkedin'] ?? '';

        $policy = CvDisplayPolicy::resolve($styleConfig);

        // Header tagline: combine non-empty title and affiliation cleanly.
        $taglineParts = array_values(array_filter([$title, $affiliation], static fn($v) => $v !== ''));
        $tagline = implode(', ', $taglineParts);

        // Contact items (bullet-separated). Empty fields are dropped before joining.
        $contactItems = array_values(array_filter([
            $email !== '' ? '\\href{mailto:' . LatexEscaper::escapeUrl($pi['email'] ?? '') . '}{' . $email . '}' : '',
            $phone,
            ($website && $policy['showWebsite'])
                ? '\\href{' . LatexEscaper::escapeUrl($this->ensureUrl($website)) . '}{\\nolinkurl{' . $this->urlDisplay($website) . '}}'
                : '',
            ($orcid && $policy['showOrcid'])
                ? '\\href{' . LatexEscaper::escapeUrl($this->orcidUrl($orcid)) . '}{ORCID: ' . LatexEscaper::escape($this->orcidDisplay($orcid)) . '}'
                : '',
            ($linkedin && $policy['showLinkedIn'])
                ? '\\href{' . LatexEscaper::escapeUrl($this->linkedinUrl($linkedin)) . '}{LinkedIn: ' . LatexEscaper::escape($this->linkedinDisplay($linkedin)) . '}'
                : '',
        ], static fn($v) => $v !== ''));
        $contactTex = $this->renderContactLine($contactItems);

        $body = '';
        $scaffold = !empty($styleConfig['scaffold_empty_sections']);
        $scaffoldSections = ['education', 'experience', 'publications', 'skills', 'awards', 'references'];
        foreach ($this->orderSectionsForRendering($sections) as $section) {
            $sectionKey = (string) ($section['section_key'] ?? '');
            if ($sectionKey === 'personal_info') {
                continue;
            }

            $isVisible = !empty($section['is_visible']) || $sectionKey === 'academic_profile';
            if (!$isVisible) {
                continue;
            }

            // Empty sections are normally skipped. In scaffold mode (used by the
            // mobile "start on mobile" draft), render core section headings with
            // a faint hint so the academic structure is visible. The hint
            // disappears automatically once real entries are added.
            if (empty($section['entries'])) {
                if ($scaffold && in_array($sectionKey, $scaffoldSections, true)) {
                    $displayName = $this->resolveSectionDisplayName($section);
                    $body .= "\\Needspace{6\\baselineskip}\n\\cvsection{" . LatexEscaper::escape($displayName) . "}\n";
                    $body .= '\\textit{\\color{black!70}' . LatexEscaper::escape('To be completed on your laptop.') . "}\\par\\vspace{0.4em}\n\n";
                }
                continue;
            }

            $renderedSection = $this->renderSectionEntries($sectionKey, $section['entries']);
            if ($renderedSection === '') {
                continue;
            }

            if ($sectionKey !== 'declaration') {
                $displayName = $this->resolveSectionDisplayName($section);
                $body .= "\\Needspace{8\\baselineskip}\n\\cvsection{" . LatexEscaper::escape($displayName) . "}\n";
            }
            $body .= $renderedSection;
        }

        $primaryRgb = $this->hexToLatexRgb($primary);

        // Header tagline emission — only if non-empty, prevents stray blank lines.
        $taglineTex = $tagline !== ''
            ? "\\\\[0.25em]\n{\\normalsize " . $tagline . '}'
            : '';
        // Contact line: near-black for B&W print (avoid mid-gray that disappears on toner).
        $contactTexLine = $contactTex !== ''
            ? "\\\\[0.45em]\n{\\small\\color{black!90} " . $contactTex . '}'
            : '';

        $paginationTex = $showPageNumbers
            ? "\\usepackage{fancyhdr}\n\\usepackage{lastpage}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyfoot[C]{\\small\\color{black!80}\\thepage/\\pageref*{LastPage}}\n\\renewcommand{\\headrulewidth}{0pt}\n\\renewcommand{\\footrulewidth}{0pt}"
            : "\\pagestyle{empty}";

        $preamble = <<<TEX
\\documentclass[11pt,{$pageSize}]{article}
\\usepackage[margin={$margin}cm]{geometry}
\\usepackage{fontspec}
\\defaultfontfeatures{Ligatures=TeX,Scale=MatchLowercase}
\\setmainfont{Latin Modern Roman}
\\setsansfont{Latin Modern Sans}
\\setmonofont{Latin Modern Mono}
\\usepackage{xcolor}\\PassOptionsToPackage{hyphens}{url}\\usepackage[hidelinks]{hyperref}
\\usepackage{microtype}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{xurl}
\\usepackage{ragged2e}
\\usepackage{tabularx}
\\usepackage{needspace}
\\usepackage{seqsplit}
\\Urlmuskip=0mu plus 2mu
\\setlist{nosep,leftmargin=1.2em,topsep=2pt,partopsep=0pt,itemsep=2pt}
\\definecolor{primary}{rgb}{{$primaryRgb}}
\\definecolor{rule}{rgb}{0.78,0.80,0.85}
\\setlength{\\hfuzz}{3pt}

% Section command: bold heading, small gap, then thin rule (print-safe).
\\newcommand{\\cvsection}[1]{%
    \\par\\vspace{0.85em}%
    {\\color{primary}\\large\\bfseries #1}\\par%
    \\vspace{4.5pt}%
    {\\color{rule}\\hrule height 0.6pt}%
    \\vspace{5pt}%
    \\nopagebreak%
}

% Entry header: bold title left; dates muted but still print-dark.
\\newcommand{\\cventryhead}[2]{%
    \\noindent\\begin{tabularx}{\\textwidth}{@{}>{\\raggedright\\arraybackslash}X>{\\raggedleft\\arraybackslash}p{0.24\\textwidth}@{}}%
    \\textbf{#1} & {\\small\\color{black!88}#2}\\\\%
    \\end{tabularx}\\vspace{-0.25em}%
}
% Org/subtitle: italic hierarchy without light gray (B&W safe).
\\newcommand{\\cventrysub}[1]{%
    \\noindent\\textit{\\color{black!95}#1}\\par\\vspace{1pt}%
}
\\newcommand{\\cventrydesc}[1]{#1\\par}
\\newcommand{\\cvsummary}[1]{#1\\par\\vspace{0.2em}}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.35em}
\\setlength{\\emergencystretch}{4em}
\\hyphenpenalty=400
\\exhyphenpenalty=400
{$paginationTex}
\\raggedbottom
\\RaggedRight
\\sloppy

\\begin{document}
\\begin{center}
{\\color{primary}\\Huge\\bfseries {$name}}{$taglineTex}{$contactTexLine}
\\end{center}
\\vspace{0.4em}

TEX;

        return $preamble . $body . "\n\\end{document}\n";
    }

    /**
     * Strip protocol + trailing slash from a URL so it fits the contact line
     * without dwarfing the rest. The href target stays full-fidelity.
     */
    private function shortUrl(string $url): string
    {
        $short = preg_replace('#^https?://(www\\.)?#i', '', $url);
        $short = preg_replace('/#.*/', '', (string) $short);
        return rtrim((string) $short, '/');
    }

    private function renderContactLine(array $items): string
    {
        $items = array_values(array_filter($items, static fn($item) => trim((string) $item) !== ''));
        if (empty($items)) {
            return '';
        }

        $line = '\\mbox{' . array_shift($items) . '}';
        foreach ($items as $item) {
            $line .= '\\allowbreak\\hspace{0.45em}\\mbox{\\textbullet\\hspace{0.45em}' . $item . '}';
        }

        return $line;
    }

    private function ensureUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }
        return preg_match('#^[a-z][a-z0-9+.-]*://#i', $url) ? $url : 'https://' . $url;
    }

    private function urlDisplay(string $url): string
    {
        return str_replace(['{', '}', '\\'], ['(', ')', ''], trim($url));
    }

    private function orcidDisplay(string $value): string
    {
        $value = trim($value);
        if (preg_match('/(\\d{4}-\\d{4}-\\d{4}-[\\dX]{4})/i', $value, $m)) {
            return strtoupper($m[1]);
        }
        return preg_replace('#^https?://(www\\.)?orcid\\.org/#i', '', $value) ?: $value;
    }

    private function orcidUrl(string $value): string
    {
        $display = $this->orcidDisplay($value);
        return preg_match('#^https?://#i', trim($value)) ? trim($value) : 'https://orcid.org/' . $display;
    }

    private function linkedinDisplay(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('#^(?:https?://)?(?:[a-z0-9-]+\\.)*linkedin\\.com/in/#i', '', $value);
        $value = preg_replace('#^(?:https?://)?(?:[a-z0-9-]+\\.)*linkedin\\.com/#i', '', (string) $value);
        $value = preg_replace('/[?#].*/', '', (string) $value);
        return trim((string) $value, '/');
    }

    private function linkedinUrl(string $value): string
    {
        $value = trim($value);
        if (preg_match('#^https?://#i', $value)) {
            return $value;
        }
        $slug = trim($value, '/');
        if (preg_match('#^(?:[a-z0-9-]+\\.)*linkedin\\.com/#i', $slug)) {
            return 'https://' . $slug;
        }
        return 'https://www.linkedin.com/in/' . $slug;
    }

    /**
     * Render one entry. Schema-light: title/position, organization+location,
     * year range, and a description paragraph. Empty fields are suppressed
     * cleanly so we never emit orphan commas or blank entry rows.
     */
    private function renderSectionEntries(string $sectionKey, array $entries): string
    {
        if ($sectionKey === 'publications') {
            return $this->renderPublicationsSection($entries);
        }

        $chunk = '';
        foreach ($entries as $entry) {
            $line = $this->renderEntry($sectionKey, $entry['data'] ?? []);
            if ($line !== '') {
                $chunk .= $line;
            }
        }

        return $chunk;
    }

    private function renderPublicationsSection(array $entries): string
    {
        $items = [];

        foreach ($entries as $entry) {
            $d = $entry['data'] ?? [];

            $authors = $this->escapeInline($d['authors'] ?? '');
            $year = $this->escapeInline($d['year'] ?? '');
            $title = $this->escapeInline($d['title'] ?? '');
            $venue = $this->escapeInline($d['venue'] ?? '');
            $vip = $this->escapeInline($d['volume_issue_pages'] ?? '');
            $doi = $this->escapeInline($d['doi'] ?? '');
            $status = $this->escapeInline($d['status'] ?? '');
            $pubType = $this->escapeInline($d['publication_type'] ?? '');

            $bits = [];
            if ($authors !== '') {
                $bits[] = $authors;
            }
            if ($year !== '') {
                $bits[] = '(' . $year . ').';
            }

            if ($title !== '') {
                $bits[] = '"' . $title . '."';
            }

            $venueBits = [];
            if ($venue !== '') {
                $venueBits[] = '\\textit{' . $venue . '}';
            }
            if ($vip !== '') {
                $venueBits[] = $vip;
            }
            if (!empty($d['volume']) || !empty($d['issue']) || !empty($d['pages'])) {
                $vol = $this->escapeInline($d['volume'] ?? '');
                $issue = $this->escapeInline($d['issue'] ?? '');
                $pages = $this->escapeInline($d['pages'] ?? '');
                $volPages = [];
                if ($vol !== '') {
                    $volPages[] = $issue !== '' ? $vol . '(' . $issue . ')' : $vol;
                }
                if ($pages !== '') {
                    $volPages[] = $pages;
                }
                if (!empty($volPages)) {
                    $venueBits[] = implode(', ', $volPages);
                }
            }
            if (!empty($venueBits)) {
                $bits[] = implode(', ', $venueBits) . '.';
            }

            if ($pubType !== '') {
                $bits[] = '[' . $pubType . ']';
            }

            if ($status !== '' && strtolower($status) !== 'published') {
                $bits[] = '[' . $status . ']';
            }

            if ($doi !== '') {
                $bits[] = 'DOI: ' . $doi;
            }

            if (!empty($d['url'])) {
                $url = $this->normalizeInline($d['url']);
                $safeUrl = LatexEscaper::escapeUrl($url);
                // Strip {}\  from display text so \nolinkurl{} argument is safe.
                $shortDisplay = str_replace(['{', '}', '\\'], ['(', ')', ''], $this->shortUrl($url));
                $bits[] = '\\href{' . $safeUrl . '}{\\nolinkurl{' . $shortDisplay . '}}';
            }

            $citation = trim(implode(' ', $bits));
            if ($citation === '') {
                continue;
            }

            $items[] = '\\Needspace{4\\baselineskip}\\item \\begin{samepage}' . $citation . '\\end{samepage}';
        }

        if (empty($items)) {
            return '';
        }

        return "\\begin{enumerate}[leftmargin=1.65em,label={[\\arabic*]},itemsep=6pt,topsep=0pt]\n"
            . implode("\n", $items)
            . "\n\\end{enumerate}\n\n";
    }

    private function renderEntry(string $sectionKey, array $data): string
    {
        if (!$this->hasMeaningfulContent($data)) {
            return '';
        }

        if ($sectionKey === 'academic_profile') {
            $summary = $this->escapeParagraphs($data['summary'] ?? $data['description'] ?? '');
            return $summary === '' ? '' : "\\Needspace{5\\baselineskip}\n\\begin{samepage}\n" . '\\cvsummary{' . $summary . "}\n\\end{samepage}\n\n";
        }

        if ($sectionKey === 'skills') {
            $cat = $this->escapeInline($data['category'] ?? '');
            $skl = $this->escapeInline($data['skills'] ?? '');
            if ($cat === '' && $skl === '') return '';
            $line = ($cat !== '' ? '\\textbf{' . $cat . ':} ' : '') . $skl;
            return "\\Needspace{3\\baselineskip}\n\\begin{samepage}\n" . '\\noindent ' . $line . "\\par\\end{samepage}\\vspace{0.3em}\n\n";
        }

        if ($sectionKey === 'languages') {
            $lang = $this->escapeInline($data['language'] ?? '');
            $profRaw = trim((string)($data['proficiency'] ?? ''));
            if ($profRaw === '') {
                $profRaw = 'intermediate';
            }
            $profMap = [
                'basic'        => 'Elementary',
                'intermediate' => 'Intermediate',
                'fluent'       => 'Proficient',
                'native'       => 'Native',
            ];
            $prof = $this->escapeInline($profMap[strtolower($profRaw)] ?? $profRaw);
            if ($lang === '') return '';
            $line = $prof !== '' ? '\\textbf{' . $lang . ':} ' . $prof : '\\textbf{' . $lang . '}';
            return "\\Needspace{3\\baselineskip}\n\\begin{samepage}\n" . '\\noindent ' . $line . "\\par\\end{samepage}\\vspace{0.3em}\n\n";
        }

        if ($sectionKey === 'declaration') {
            $statementRaw = trim((string)($data['statement'] ?? ''));
            if ($statementRaw === '') {
                $statementRaw = 'I hereby declare that the information provided above is true and accurate to the best of my knowledge.';
            }
            $statement = $this->escapeParagraphs($statementRaw);

            $dateRaw = trim((string)($data['declaration_date'] ?? ''));
            $dateVal = $this->escapeInline($dateRaw);

            $modeRaw = strtolower(trim((string)($data['signature_mode'] ?? 'manual')));
            $isElectronic = in_array($modeRaw, ['electronic', 'digital', 'e-signature', 'esignature'], true);
            $nameRaw = trim((string)($data['signature_name'] ?? ''));
            $nameVal = $this->escapeInline($nameRaw);

            $entry = "\\Needspace{8\\baselineskip}\n\\begin{samepage}\n\\vspace{1.2em}\n\\noindent " . $statement . "\\par\\vspace{0.9em}\n";

            if ($isElectronic) {
                $signer = $nameVal !== '' ? $nameVal : 'Authorized Signatory';
                $entry .= "\\noindent\\begin{minipage}[t]{0.52\\textwidth}\n"
                    . '\\textbf{Date:} ' . ($dateVal !== '' ? $dateVal : '\\rule{3.2cm}{0.4pt}') . "\\par\n"
                    . "\\end{minipage}\\hfill\n"
                    . "\\begin{minipage}[t]{0.44\\textwidth}\n"
                    . "\\raggedleft\\textbf{Electronic Signature}\\par\n"
                    . "{\\large\\textit{" . $signer . "}}\\par\n"
                    . "{\\footnotesize\\color{black!85}Digitally signed}\\par\n"
                    . "\\end{minipage}\\par\n";
            } else {
                $entry .= '\\noindent\\textbf{Date:} ' . ($dateVal !== '' ? $dateVal : '\\rule{3.2cm}{0.4pt}')
                    . "\\hfill\\textbf{Signature:} \\rule{5.5cm}{0.4pt}\\par\n";
                if ($nameVal !== '') {
                    $entry .= '\\noindent\\hfill\\textit{' . $nameVal . "}\\par\n";
                }
            }

            return $entry . "\\end{samepage}\n\\vspace{0.45em}\n\n";
        }

        $title = $this->escapeInline(
            $data['position']
                ?? $data['degree']
                ?? $data['qualification']
                ?? $data['title']
                ?? $data['name']
                ?? $data['course']
                ?? $data['activity']
                ?? $data['journal']
                ?? $data['language']
                ?? $data['area']
                ?? ''
        );

        $org = $this->escapeInline(
            $data['organization']
                ?? $data['institution']
                ?? $data['publisher']
                ?? $data['venue']
                ?? $data['conference']
                ?? $data['affiliation']
                ?? $data['issuer']
                ?? $data['agency']
                ?? ''
        );

        $location = $this->escapeInline($data['location'] ?? '');
        $description = $this->escapeParagraphs($data['description'] ?? '');

        $singleYear = $data['year'] ?? '';
        $fallbackEnd = $sectionKey === 'supervision' ? 'Ongoing' : null;
        $years = CvDataNormalizer::formatYearRange($data['year_start'] ?? '', $data['year_end'] ?? '', $fallbackEnd);
        if ($years === '' && trim((string) $singleYear) !== '') {
            $years = (string) $singleYear;
        }
        $years = $this->escapeInline($years);

        $subParts = [];
        if ($org !== '') {
            $subParts[] = $org;
        }
        if ($location !== '') {
            $subParts[] = $location;
        }

        if ($sectionKey === 'research_interests' && !empty($data['keywords'])) {
            $subParts[] = 'Keywords: ' . $this->escapeInline($data['keywords']);
        }

        if ($sectionKey === 'references') {
            if (!empty($data['title'])) {
                $subParts[] = $this->escapeInline($data['title']);
            }
            if (!empty($data['relationship'])) {
                $subParts[] = $this->escapeInline('(' . $this->normalizeInline($data['relationship']) . ')');
            }
        }

        if ($sectionKey === 'professional_memberships' && !empty($data['role'])) {
            $subParts[] = $this->escapeInline($data['role']);
        }

        if ($sectionKey === 'education') {
            if (!empty($data['education_level'])) {
                $subParts[] = $this->escapeInline($data['education_level']);
            }
            if (!empty($data['field_of_study']) && empty($data['degree'])) {
                $subParts[] = $this->escapeInline($data['field_of_study']);
            }
        }

        if ($sectionKey === 'languages' && !empty($data['proficiency'])) {
            $subParts[] = $this->escapeInline($data['proficiency']);
        }

        if ($sectionKey === 'editorial' && !empty($data['role'])) {
            $subParts[] = $this->escapeInline($data['role']);
        }

        if ($sectionKey === 'grants' && !empty($data['amount'])) {
            $subParts[] = $this->escapeInline($data['amount']);
        }

        $sub = implode(', ', $subParts);

        $notes = [];
        if ($sectionKey === 'references') {
            if (!empty($data['email'])) {
                $emailRaw = $this->normalizeInline($data['email']);
                $notes[] = '\\href{mailto:' . LatexEscaper::escapeUrl($emailRaw) . '}{' . $this->escapeInline($emailRaw) . '}';
            }
            if (!empty($data['phone'])) {
                $notes[] = $this->escapeInline($data['phone']);
            }
        }

        if ($sectionKey === 'projects') {
            if (!empty($data['collaborators'])) {
                $notes[] = 'Collaborators: ' . $this->escapeInline($data['collaborators']);
            }
            if (!empty($data['outputs'])) {
                $notes[] = 'Outputs: ' . $this->escapeInline($data['outputs']);
            }
        }

        if ($sectionKey === 'conferences' && !empty($data['type'])) {
            $notes[] = $this->escapeInline('Type: ' . $this->normalizeInline($data['type']));
        }

        if ($sectionKey === 'certifications' && !empty($data['credential_id'])) {
            $notes[] = $this->escapeInline('Credential ID: ' . $this->normalizeInline($data['credential_id']));
        }

        $notesLine = implode(' \\textbar\\ ', $notes);

        $entry = "\\Needspace{5\\baselineskip}\n\\begin{samepage}\n";
        if ($title !== '' || $years !== '') {
            $entry .= '\\cventryhead{' . $title . '}{' . $years . "}\n";
        }
        if ($sub !== '') {
            $entry .= '\\cventrysub{' . $sub . "}\n";
        }
        if ($description !== '') {
            $entry .= '\\cventrydesc{' . $description . "}\n";
        }
        if ($notesLine !== '') {
            $entry .= '\\cventrydesc{{\\small ' . $notesLine . "}}\n";
        }
        $entry .= "\\end{samepage}\n\\vspace{0.45em}\n\n";
        return $entry;
    }

    private function resolveSectionDisplayName(array $section): string
    {
        $key = (string) ($section['section_key'] ?? '');
        if ($key === 'academic_profile') {
            return 'Profile';
        }

        return (string) ($section['display_name'] ?? $key ?: 'Section');
    }

    private function orderSectionsForRendering(array $sections): array
    {
        $indexed = [];
        foreach ($sections as $index => $section) {
            $section['_original_index'] = $index;
            $indexed[] = $section;
        }

        usort($indexed, static function (array $a, array $b): int {
            $rank = static function (array $section): int {
                $key = (string) ($section['section_key'] ?? '');
                if ($key === 'declaration') {
                    return 4;
                }
                if ($key === 'references') {
                    return 3;
                }
                if ($key === 'publications') {
                    return 2;
                }
                return 1;
            };

            $rankCompare = $rank($a) <=> $rank($b);
            if ($rankCompare !== 0) {
                return $rankCompare;
            }

            $orderCompare = (int) ($a['section_order'] ?? 99) <=> (int) ($b['section_order'] ?? 99);
            if ($orderCompare !== 0) {
                return $orderCompare;
            }

            return (int) ($a['_original_index'] ?? 0) <=> (int) ($b['_original_index'] ?? 0);
        });

        return array_map(static function (array $section): array {
            unset($section['_original_index']);
            return $section;
        }, $indexed);
    }

    private function hasMeaningfulContent(array $data): bool
    {
        foreach ($data as $value) {
            if (!is_scalar($value)) {
                continue;
            }
            if (trim((string) $value) !== '') {
                return true;
            }
        }

        return false;
    }

    private function normalizeInline(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        $value = str_replace(["\r\n", "\r", "\t"], ["\n", "\n", ' '], $value);
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        return trim($value);
    }

    private function escapeInline(?string $value): string
    {
        $clean = $this->normalizeInline($value);
        return $clean === '' ? '' : $this->renderRichInline($clean);
    }

    private function escapeParagraphs(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        $raw = str_replace(["\r\n", "\r"], "\n", $value);
        $paragraphs = preg_split('/\n{2,}/', $raw) ?: [];
        $clean = [];

        foreach ($paragraphs as $paragraph) {
            $line = $this->normalizeInline($paragraph);
            if ($line !== '') {
                $clean[] = $this->renderRichInline($line);
            }
        }

        return implode('\\par ', $clean);
    }

    /**
     * Supports lightweight inline formatting from form fields:
     *   **bold text** -> \textbf{bold text}
     *   *italic text* -> \textit{italic text}
     * All content remains escaped to prevent LaTeX injection.
     */
    private function renderRichInline(string $text): string
    {
        if (!str_contains($text, '*')) {
            return $this->escapeBreakableText($text);
        }

        // Match **bold** before *italic* (longer delimiter wins to avoid double-star ambiguity).
        $parts = preg_split('/(\*\*[^*]+\*\*|\*[^*]+\*)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            return LatexEscaper::escape($text);
        }

        $out = '';
        foreach ($parts as $part) {
            if ($part === '') {
                continue;
            }

            if (str_starts_with($part, '**') && str_ends_with($part, '**') && strlen($part) >= 4) {
                $inner = trim(substr($part, 2, -2));
                $out .= $inner !== '' ? '\\textbf{' . $this->escapeBreakableText($inner) . '}' : $this->escapeBreakableText($part);
                continue;
            }

            if (str_starts_with($part, '*') && str_ends_with($part, '*') && strlen($part) >= 3) {
                $inner = trim(substr($part, 1, -1));
                $out .= $inner !== '' ? '\\textit{' . $this->escapeBreakableText($inner) . '}' : $this->escapeBreakableText($part);
                continue;
            }

            $out .= $this->escapeBreakableText($part);
        }

        return $out;
    }

    private function escapeBreakableText(string $text): string
    {
        $tokens = preg_split('/(\\s+)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($tokens === false) {
            return LatexEscaper::escape($text);
        }

        $out = '';
        foreach ($tokens as $token) {
            if ($token === '') {
                continue;
            }
            if (preg_match('/^\\s+$/u', $token)) {
                $out .= $token;
                continue;
            }

            $plainLength = function_exists('mb_strlen') ? mb_strlen($token, 'UTF-8') : strlen($token);
            if ($plainLength > 28 && !preg_match('/^https?:\\/\\//i', $token) && !str_contains($token, '@')) {
                $safeToken = str_replace(['{', '}', '\\'], ['(', ')', ''], $token);
                $out .= '\\seqsplit{' . LatexEscaper::escape($safeToken) . '}';
                continue;
            }

            $out .= LatexEscaper::escape($token);
        }

        return $out;
    }

    private function resolveShowPageNumbers(array $styleConfig): bool
    {
        if (array_key_exists('showPageNumbers', $styleConfig)) {
            $raw = $styleConfig['showPageNumbers'];
            if (is_bool($raw)) {
                return $raw;
            }
            if (is_numeric($raw)) {
                return ((int) $raw) === 1;
            }
            $text = strtolower(trim((string) $raw));
            return in_array($text, ['1', 'true', 'yes', 'on'], true);
        }

        // Detailed template (10pt default) traditionally has page numbers.
        return strtolower((string) ($styleConfig['fontSize'] ?? '')) === '10pt';
    }

    private function parseMarginCm(string $value): float
    {
        $value = strtolower(trim($value));
        if (preg_match('/^([\d.]+)\s*(in|cm|mm)?$/', $value, $m)) {
            $n = (float) $m[1];
            $unit = $m[2] ?? 'in';
            return match ($unit) {
                'cm' => $n,
                'mm' => $n / 10.0,
                default => $n * 2.54,
            };
        }
        return 2.54;
    }

    private function hexToLatexRgb(string $hex): string
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) !== 6) return '0,0.2,0.4';
        $r = hexdec(substr($hex, 0, 2)) / 255.0;
        $g = hexdec(substr($hex, 2, 2)) / 255.0;
        $b = hexdec(substr($hex, 4, 2)) / 255.0;
        return sprintf('%.3f,%.3f,%.3f', $r, $g, $b);
    }
}
