<?php
/**
 * LatexRenderer
 *
 * Phase 4 (step 1) — opt-in xelatex backend.
 *
 * Design contract:
 *  - Generates a self-contained .tex from normalized profile data; does NOT
 *    rely on any DB-stored LaTeX template fragments.
 *  - Always escapes user input via LatexEscaper before substitution.
 *  - Spawns xelatex via proc_open with hard timeout, captured stderr, and an
 *    output-size cap so a runaway compile cannot exhaust disk or CPU.
 *  - Never throws on missing binary or compile failure: returns a structured
 *    error so RendererFactory's automatic fallback to FpdfRenderer kicks in.
 *
 * NOT covered yet (deferred to step 2 — Dockerfile.latex push):
 *  - The cvscholar:latex Docker image with TeX Live xetex installed.
 *  - Per-template LaTeX fragments in the DB. Step 1 ships a single minimal
 *    template that mirrors the FPDF "centered" header layout.
 */
class LatexRenderer implements RendererInterface
{
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

        // 3. Build the .tex string.
        $tex = $this->buildDocument($personalInfo, $sections, $styleConfig);

        // 4. Compile.
        $result = $this->runXelatex($tex, $profileId, (int) $profile['user_id']);
        $result['engine'] = 'xelatex';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        return $result;
    }

    private function isCompilerAvailable(): bool
    {
        $compiler = XELATEX_COMPILER;
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
        $tempDir = LATEX_TEMP_DIR . '/xelatex_' . $profileId . '_' . bin2hex(random_bytes(4));
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

            [$ok, $log] = $this->execWithTimeout($cmd, $tempDir, XELATEX_COMPILE_TIMEOUT);

            if (!$ok || !file_exists($pdfFile)) {
                return [
                    'success' => false,
                    'error'   => 'xelatex compilation failed.',
                    'log'     => substr($log, 0, 4000),
                ];
            }

            // Output size guard — refuse to ship anything pathologically huge.
            if (filesize($pdfFile) > XELATEX_MAX_OUTPUT_BYTES) {
                return ['success' => false, 'error' => 'PDF exceeds size cap'];
            }

            $finalDir = GENERATED_DIR . '/' . $userId;
            if (!is_dir($finalDir) && !@mkdir($finalDir, 0755, true)) {
                return ['success' => false, 'error' => 'Cannot create output dir'];
            }
            $finalPath = $finalDir . '/cv_' . $profileId . '.pdf';
            copy($pdfFile, $finalPath);

            return ['success' => true, 'pdf_path' => $finalPath];
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
        $primary = $styleConfig['primaryColor'] ?? '#003366';

        $name        = LatexEscaper::escape($pi['full_name'] ?? '');
        $title       = LatexEscaper::escape($pi['title'] ?? '');
        $affiliation = LatexEscaper::escape($pi['affiliation'] ?? '');
        $email       = LatexEscaper::escape($pi['email'] ?? '');
        $phone       = LatexEscaper::escape($pi['phone'] ?? '');
        $website     = $pi['website'] ?? '';
        $orcid       = LatexEscaper::escape($pi['orcid'] ?? '');
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
                ? '\\href{' . LatexEscaper::escapeUrl($website) . '}{' . LatexEscaper::escape($this->shortUrl($website)) . '}'
                : '',
            ($orcid && $policy['showOrcid']) ? 'ORCID: ' . $orcid : '',
            ($linkedin && $policy['showLinkedIn'])
                ? '\\href{' . LatexEscaper::escapeUrl($linkedin) . '}{LinkedIn}'
                : '',
        ], static fn($v) => $v !== ''));
        $contactTex = implode(' \\,\\textbullet\\, ', $contactItems);

        $body = '';
        foreach ($sections as $section) {
            if (empty($section['is_visible']) || empty($section['entries'])) continue;
            $body .= "\\cvsection{" . LatexEscaper::escape($section['display_name']) . "}\n";
            foreach ($section['entries'] as $entry) {
                $body .= $this->renderEntry($section['section_key'] ?? '', $entry['data'] ?? []);
            }
        }

        $primaryRgb = $this->hexToLatexRgb($primary);

        // Header tagline emission — only if non-empty, prevents stray blank lines.
        $taglineTex = $tagline !== ''
            ? "\\\\[0.25em]\n{\\normalsize " . $tagline . '}'
            : '';
        $contactTexLine = $contactTex !== ''
            ? "\\\\[0.45em]\n{\\small\\color{black!70} " . $contactTex . '}'
            : '';

        $preamble = <<<TEX
\\documentclass[11pt,{$pageSize}]{article}
\\usepackage[margin={$margin}cm]{geometry}
\\usepackage{fontspec}
\\usepackage{xcolor}
\\usepackage[hidelinks]{hyperref}
\\usepackage{microtype}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{xurl}
\\setlist{nosep,leftmargin=1.2em,topsep=2pt,partopsep=0pt,itemsep=2pt}
\\definecolor{primary}{rgb}{{$primaryRgb}}
\\definecolor{rule}{rgb}{0.78,0.80,0.85}

% Section command: left-aligned, primary color, small caps optional, thin rule.
\\newcommand{\\cvsection}[1]{%
    \\par\\addvspace{0.9em}%
    {\\color{primary}\\large\\bfseries #1}\\par%
    \\vspace{2pt}%
    {\\color{rule}\\hrule height 0.6pt}%
    \\vspace{0.45em}%
    \\nopagebreak%
}

% Entry header: bold title left, light-gray dates right.
\\newcommand{\\cventryhead}[2]{%
    \\noindent\\textbf{#1}\\hfill{\\small\\color{black!60}#2}\\par%
}
\\newcommand{\\cventrysub}[1]{%
    \\noindent\\textit{\\color{black!75}#1}\\par\\vspace{1pt}%
}
\\newcommand{\\cventrydesc}[1]{#1\\par}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.35em}
\\setlength{\\emergencystretch}{3em}
\\sloppy
\\pagestyle{empty}
\\raggedbottom

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
        return rtrim((string) $short, '/');
    }

    /**
     * Render one entry. Schema-light: title/position, organization+location,
     * year range, and a description paragraph. Empty fields are suppressed
     * cleanly so we never emit orphan commas or blank entry rows.
     */
    private function renderEntry(string $sectionKey, array $data): string
    {
        $d = LatexEscaper::escapeArray($data);

        $title = $d['position'] ?? $d['degree'] ?? $d['title'] ?? $d['name'] ?? '';
        $org   = $d['organization'] ?? $d['institution'] ?? $d['publisher'] ?? '';
        $location = $d['location'] ?? '';
        $desc  = $d['description'] ?? '';

        $years = CvDataNormalizer::formatYearRange(
            $data['year_start'] ?? '',
            $data['year_end'] ?? '',
            null
        );
        $years = LatexEscaper::escape($years);

        // Build the second line: organization + location, suppress empties.
        $subParts = array_values(array_filter([$org, $location], static fn($v) => $v !== ''));
        $sub = implode(', ', $subParts);

        $entry = '';
        if ($title !== '' || $years !== '') {
            $entry .= '\\cventryhead{' . $title . '}{' . $years . "}\n";
        }
        if ($sub !== '') {
            $entry .= '\\cventrysub{' . $sub . "}\n";
        }
        if ($desc !== '') {
            $entry .= '\\cventrydesc{' . $desc . "}\n";
        }
        $entry .= "\\vspace{0.55em}\n\n";
        return $entry;
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
