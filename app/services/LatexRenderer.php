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
    /** Bump when Classic layout/edge-case behavior changes (surfaced in compile JSON). */
    public const DEMO_CACHE_VERSION = 'xelatex-v6';
    public const LAYOUT_VERSION = 'classic-layout-v6';

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

        // 4. Compile (always overwrite previous PDF for this profile).
        $result = $this->runXelatex($tex, $profileId, (int) $profile['user_id']);
        $result['engine'] = 'xelatex';
        $result['layout_version'] = self::LAYOUT_VERSION;
        $result['renderer'] = 'LatexRenderer';
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
        // Remove stale PDF so preview/download cannot serve a previous compile by accident.
        if (is_file($finalPath)) {
            @unlink($finalPath);
        }

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
        $pageSize = strtolower((string) ($styleConfig['pageSize'] ?? 'a4')) === 'letter' ? 'letterpaper' : 'a4paper';
        $margin = $this->parseMarginCm((string) ($styleConfig['margins'] ?? '1in'));
        // Classic production design defaults to print-safe black; allow explicit style_config override.
        $primary = $this->normalizePrimaryColor((string) ($styleConfig['primaryColor'] ?? '#000000'));
        $showPageNumbers = $this->resolveShowPageNumbers($styleConfig);

        $nameRaw     = trim((string) ($pi['full_name'] ?? ''));
        $name        = LatexEscaper::escape($nameRaw !== '' ? $nameRaw : 'Curriculum Vitae');
        $nameSizeCmd = $this->resolveNameFontCommand($nameRaw);
        $title       = $this->escapeInline($pi['title'] ?? '');
        $affiliation = $this->escapeInline($pi['affiliation'] ?? '');
        $emailRaw    = trim((string) ($pi['email'] ?? ''));
        $email       = LatexEscaper::escape($emailRaw);
        $phone       = LatexEscaper::escape($pi['phone'] ?? '');
        $website     = $pi['website'] ?? '';
        $orcid       = $pi['orcid'] ?? '';
        $linkedin    = $pi['linkedin'] ?? '';
        $footerLabel = LatexEscaper::escape($this->extractSurnameForFooter($nameRaw));

        $policy = CvDisplayPolicy::resolve($styleConfig);

        // Header tagline: combine non-empty title and affiliation cleanly.
        $taglineParts = array_values(array_filter([$title, $affiliation], static fn($v) => $v !== ''));
        $tagline = implode(', ', $taglineParts);

        // Contact items (bullet-separated). Empty fields are dropped; soft-max 5.
        $contactItems = array_values(array_filter([
            $email !== '' ? '\\href{mailto:' . LatexEscaper::escapeUrl($emailRaw) . '}{' . $email . '}' : '',
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
            ($policy['showScholar'] && !empty($pi['google_scholar']))
                ? '\\href{' . LatexEscaper::escapeUrl($this->ensureUrl((string) $pi['google_scholar'])) . '}{Google Scholar}'
                : '',
        ], static fn($v) => $v !== ''));
        $contactItems = array_slice($contactItems, 0, 5);
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

        $pageFooter = $footerLabel !== ''
            ? $footerLabel . ' \\textperiodcentered\\ \\thepage/\\pageref*{LastPage}'
            : '\\thepage/\\pageref*{LastPage}';
        $paginationTex = $showPageNumbers
            ? "\\usepackage{fancyhdr}\n\\usepackage{lastpage}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyfoot[C]{\\small\\color{black!80}" . $pageFooter . "}\n\\renewcommand{\\headrulewidth}{0pt}\n\\renewcommand{\\footrulewidth}{0pt}"
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
{\\color{primary}{$nameSizeCmd}\\bfseries {$name}}{$taglineTex}{$contactTexLine}
\\end{center}
\\vspace{0.4em}

TEX;

        return $preamble . $body . "\n\\end{document}\n";
    }

    /**
     * Strip protocol + trailing slash from a URL so it fits the contact line
     * without dwarfing the rest. The href target stays full-fidelity.
     * Very long display strings are middle-ellipsized (URL-03).
     */
    private function shortUrl(string $url, int $maxDisplay = 52): string
    {
        $short = preg_replace('#^https?://(www\\.)?#i', '', $url);
        $short = preg_replace('/#.*/', '', (string) $short);
        $short = rtrim((string) $short, '/');
        $len = function_exists('mb_strlen') ? mb_strlen($short, 'UTF-8') : strlen($short);
        if ($len <= $maxDisplay) {
            return $short;
        }
        $keep = max(12, (int) floor(($maxDisplay - 1) / 2));
        $head = function_exists('mb_substr') ? mb_substr($short, 0, $keep, 'UTF-8') : substr($short, 0, $keep);
        $tail = function_exists('mb_substr') ? mb_substr($short, -$keep, null, 'UTF-8') : substr($short, -$keep);
        return $head . '…' . $tail;
    }

    private function renderContactLine(array $items): string
    {
        $items = array_values(array_filter($items, static fn($item) => trim((string) $item) !== ''));
        if (empty($items)) {
            return '';
        }

        // Avoid \mbox on long items — it prevents line breaks (edge NM-05 / URL-03).
        $wrapItem = static function (string $item): string {
            $plain = trim(strip_tags(str_replace(['\\href', '\\nolinkurl', '\\mbox'], '', $item)));
            $len = function_exists('mb_strlen') ? mb_strlen($plain, 'UTF-8') : strlen($plain);
            return $len > 28 ? $item : ('\\mbox{' . $item . '}');
        };

        $line = $wrapItem((string) array_shift($items));
        foreach ($items as $item) {
            $line .= '\\allowbreak\\hspace{0.45em}\\textbullet\\hspace{0.45em}' . $wrapItem((string) $item);
        }

        return $line;
    }

    /** Scale name size so extremely long names still fit the header (NM-01). */
    private function resolveNameFontCommand(string $name): string
    {
        $len = function_exists('mb_strlen') ? mb_strlen(trim($name), 'UTF-8') : strlen(trim($name));
        if ($len > 55) {
            return '\\large';
        }
        if ($len > 38) {
            return '\\Large';
        }
        return '\\Huge';
    }

    private function extractSurnameForFooter(string $fullName): string
    {
        $fullName = trim(preg_replace('/\s+/u', ' ', $fullName) ?? $fullName);
        if ($fullName === '') {
            return '';
        }
        $parts = preg_split('/\s+/u', $fullName) ?: [];
        $last = (string) end($parts);
        // Drop trailing punctuation / degrees fragments.
        $last = trim($last, " \t.,;");
        if ($last === '' || strcasecmp($last, 'Curriculum') === 0) {
            return '';
        }
        return $last;
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
        $display = $this->shortUrl(trim($url));
        return str_replace(['{', '}', '\\'], ['(', ')', ''], $display);
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

            // Prefer DOI over raw URL when both exist (cleaner citations).
            if ($doi !== '') {
                $doiRaw = $this->normalizeInline((string) ($d['doi'] ?? ''));
                $doiHref = preg_match('#^https?://#i', $doiRaw)
                    ? $doiRaw
                    : 'https://doi.org/' . ltrim($doiRaw, '/');
                $bits[] = 'DOI: \\href{' . LatexEscaper::escapeUrl($doiHref) . '}{' . $doi . '}';
            } elseif (!empty($d['url'])) {
                $url = $this->normalizeInline($d['url']);
                $safeUrl = LatexEscaper::escapeUrl($this->ensureUrl($url));
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
            $summaryRaw = (string) ($data['summary'] ?? $data['description'] ?? '');
            $summary = $this->escapeParagraphs($summaryRaw);
            if ($summary === '') {
                return '';
            }
            // Long summaries may page-break; short ones stay with heading context.
            $long = $this->plainLength($summaryRaw) > 900;
            if ($long) {
                return "\\Needspace{4\\baselineskip}\n" . '\\cvsummary{' . $summary . "}\n\n";
            }
            return "\\Needspace{5\\baselineskip}\n\\begin{samepage}\n" . '\\cvsummary{' . $summary . "}\n\\end{samepage}\n\n";
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

        // Section-specific primary fields (generic ?? chain mis-picks for these).
        $isSupervision = $sectionKey === 'supervision';
        $isMembership = in_array($sectionKey, ['professional_memberships', 'memberships'], true);
        $isReferences = $sectionKey === 'references';

        if ($isSupervision) {
            $titleRaw = trim((string) ($data['student_name'] ?? $data['name'] ?? $data['student'] ?? ''));
            if ($titleRaw === '') {
                $titleRaw = (string) ($data['degree'] ?? $data['title'] ?? '');
            }
        } elseif ($isMembership) {
            $titleRaw = (string) ($data['organization'] ?? $data['institution'] ?? $data['name'] ?? '');
        } elseif ($isReferences) {
            $titleRaw = (string) ($data['name'] ?? $data['title'] ?? '');
        } else {
            $titleRaw = (string) (
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
        }
        $title = $this->escapeInline($titleRaw);

        $org = $this->escapeInline(
            $isMembership
                ? '' // organization already used as title
                : (
                    $data['organization']
                        ?? $data['institution']
                        ?? $data['publisher']
                        ?? $data['venue']
                        ?? $data['conference']
                        ?? $data['affiliation']
                        ?? $data['issuer']
                        ?? $data['agency']
                        ?? ''
                )
        );

        $location = $this->escapeInline($data['location'] ?? '');
        $description = $this->escapeParagraphs($data['description'] ?? '');

        $singleYear = $data['year'] ?? '';
        $fallbackEnd = $isSupervision ? 'Ongoing' : null;
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

        // Membership: bold org (title) + dates; role as italic subtitle only.
        if ($isMembership && !empty($data['role'])) {
            $subParts[] = $this->escapeInline($data['role']);
        }

        if ($isSupervision) {
            if (!empty($data['degree'])) {
                $subParts[] = $this->escapeInline($data['degree']);
            }
            if (!empty($data['role'])) {
                $subParts[] = $this->escapeInline($data['role']);
            }
            if ($org === '' && !empty($data['institution'])) {
                $subParts[] = $this->escapeInline($data['institution']);
            }
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

        if ($isSupervision) {
            $thesis = trim((string) ($data['thesis_title'] ?? $data['thesis'] ?? $data['title'] ?? ''));
            // Prefer dedicated thesis fields; avoid reusing student name as thesis.
            if ($thesis !== '' && strcasecmp($thesis, trim((string) ($data['student_name'] ?? ''))) !== 0) {
                $notes[] = 'Thesis: ' . $this->escapeInline($thesis);
            }
            if (!empty($data['status'])) {
                $notes[] = $this->escapeInline($data['status']);
            }
        }

        if ($sectionKey === 'education') {
            if (!empty($data['thesis'])) {
                $notes[] = 'Thesis: ' . $this->escapeInline($data['thesis']);
            }
            if (!empty($data['supervisor'])) {
                $notes[] = 'Supervisor: ' . $this->escapeInline($data['supervisor']);
            }
            if (!empty($data['gpa'])) {
                $notes[] = $this->escapeInline($data['gpa']);
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

        // Soft-break long narratives: keep title+subtitle atomic; allow description to flow across pages (TX-03 / PG-02).
        $descRawLen = $this->plainLength((string) ($data['description'] ?? ''));
        $longBody = $descRawLen > 700;

        $head = '';
        if ($title !== '' || $years !== '') {
            $head .= '\\cventryhead{' . $title . '}{' . $years . "}\n";
        }
        if ($sub !== '') {
            $head .= '\\cventrysub{' . $sub . "}\n";
        }

        if ($head === '' && $description === '' && $notesLine === '') {
            return '';
        }

        if ($longBody) {
            $entry = "\\Needspace{5\\baselineskip}\n";
            if ($head !== '') {
                $entry .= "\\begin{samepage}\n" . $head . "\\end{samepage}\n";
            }
            if ($description !== '') {
                $entry .= '\\cventrydesc{' . $description . "}\n";
            }
            if ($notesLine !== '') {
                $entry .= '\\cventrydesc{{\\small ' . $notesLine . "}}\n";
            }
            $entry .= "\\vspace{0.45em}\n\n";
            return $entry;
        }

        $entry = "\\Needspace{5\\baselineskip}\n\\begin{samepage}\n" . $head;
        if ($description !== '') {
            $entry .= '\\cventrydesc{' . $description . "}\n";
        }
        if ($notesLine !== '') {
            $entry .= '\\cventrydesc{{\\small ' . $notesLine . "}}\n";
        }
        $entry .= "\\end{samepage}\n\\vspace{0.45em}\n\n";
        return $entry;
    }

    private function plainLength(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    }

    /** Accept only safe #RRGGBB; otherwise Classic black. */
    private function normalizePrimaryColor(string $hex): string
    {
        $hex = trim($hex);
        if (preg_match('/^#?[0-9A-Fa-f]{6}$/', $hex)) {
            return str_starts_with($hex, '#') ? strtoupper($hex) : ('#' . strtoupper($hex));
        }
        return '#000000';
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

        // Academic CVs are multi-page; page numbers on by default (Classic/Modern/etc.).
        return true;
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
