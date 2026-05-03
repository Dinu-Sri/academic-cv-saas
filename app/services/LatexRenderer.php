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
 *    error payload for controller-safe JSON handling.
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

            // Run two LaTeX passes so references such as LastPage resolve.
            [$okFirst, $logFirst] = $this->execWithTimeout($cmd, $tempDir, XELATEX_COMPILE_TIMEOUT);
            if (!$okFirst) {
                 $this->logFailure($profileId, $tex, $logFirst);
                return ['success' => false, 'error' => 'xelatex compilation failed.', 'log' => substr($logFirst, -4000)];
            }

            [$okSecond, $logSecond] = $this->execWithTimeout($cmd, $tempDir, XELATEX_COMPILE_TIMEOUT);
            $log = $logFirst . "\n" . $logSecond;

            if (!$okSecond || !file_exists($pdfFile)) {
                 $this->logFailure($profileId, $tex, $log);
                return ['success' => false, 'error' => 'xelatex compilation failed.', 'log' => substr($log, -4000)];
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

        private function logFailure(int $profileId, string $tex, string $log): void
        {
            error_log('LatexRenderer: xelatex failed for profile ' . $profileId
                . "\n--- XELATEX LOG (last 3000 chars) ---\n" . substr($log, -3000));
            $logDir = defined('STORAGE_PATH') ? rtrim(STORAGE_PATH, '/') . '/logs' : sys_get_temp_dir();
            @file_put_contents($logDir . '/xelatex_fail_' . $profileId . '.tex', $tex);
            @file_put_contents($logDir . '/xelatex_fail_' . $profileId . '.log', $log);
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
        $showPageNumbers = $this->resolveShowPageNumbers($styleConfig);

        $name        = LatexEscaper::escape($pi['full_name'] ?? '');
        $title       = $this->escapeInline($pi['title'] ?? '');
        $affiliation = $this->escapeInline($pi['affiliation'] ?? '');
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
            if ((empty($section['is_visible']) && ($section['section_key'] ?? '') !== 'academic_profile') || empty($section['entries'])) {
                continue;
            }

            $sectionKey = (string) ($section['section_key'] ?? '');
            if ($sectionKey === 'personal_info') {
                continue;
            }

            $renderedSection = $this->renderSectionEntries($sectionKey, $section['entries']);
            if ($renderedSection === '') {
                continue;
            }

            if ($sectionKey !== 'declaration') {
                $displayName = $this->resolveSectionDisplayName($section);
                $body .= "\\cvsection{" . LatexEscaper::escape($displayName) . "}\n";
            }
            $body .= $renderedSection;
        }

        $primaryRgb = $this->hexToLatexRgb($primary);

        // Header tagline emission — only if non-empty, prevents stray blank lines.
        $taglineTex = $tagline !== ''
            ? "\\\\[0.25em]\n{\\normalsize " . $tagline . '}'
            : '';
        $contactTexLine = $contactTex !== ''
            ? "\\\\[0.45em]\n{\\small\\color{black!70} " . $contactTex . '}'
            : '';

        $paginationTex = $showPageNumbers
            ? "\\usepackage{fancyhdr}\n\\usepackage{lastpage}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyfoot[C]{\\small\\color{black!55}\\thepage/\\pageref*{LastPage}}\n\\renewcommand{\\headrulewidth}{0pt}\n\\renewcommand{\\footrulewidth}{0pt}"
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
\\setlist{nosep,leftmargin=1.2em,topsep=2pt,partopsep=0pt,itemsep=2pt}
\\definecolor{primary}{rgb}{{$primaryRgb}}
\\definecolor{rule}{rgb}{0.78,0.80,0.85}
\\setlength{\\hfuzz}{3pt}

% Section command: fixed vertical spacing for consistency across all content types.
\\newcommand{\\cvsection}[1]{%
    \\par\\vspace{0.85em}%
    {\\color{primary}\\large\\bfseries #1}\\par%
    \\vspace{2pt}%
    {\\color{rule}\\hrule height 0.6pt}%
    \\vspace{5pt}%
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
\\newcommand{\\cvsummary}[1]{#1\\par\\vspace{0.2em}}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.35em}
\\setlength{\\emergencystretch}{2em}
\\hyphenpenalty=400
\\exhyphenpenalty=400
{$paginationTex}
\\raggedbottom
\\RaggedRight

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

            $items[] = '\\item ' . $citation;
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
            return $summary === '' ? '' : '\\cvsummary{' . $summary . "}\n\n";
        }

        if ($sectionKey === 'skills') {
            $cat = $this->escapeInline($data['category'] ?? '');
            $skl = $this->escapeInline($data['skills'] ?? '');
            if ($cat === '' && $skl === '') return '';
            $line = ($cat !== '' ? '\\textbf{' . $cat . ':} ' : '') . $skl;
            return '\\noindent ' . $line . "\\par\\vspace{0.3em}\n\n";
        }

        if ($sectionKey === 'languages') {
            $lang = $this->escapeInline($data['language'] ?? '');
            $profRaw = trim((string)($data['proficiency'] ?? ''));
            if ($profRaw === '') {
                $profRaw = 'intermediate';
            }
            $profMap = [
                'basic' => 'Basic',
                'intermediate' => 'Intermediate (Average)',
                'fluent' => 'Fluent',
                'native' => 'Native / Bilingual',
            ];
            $prof = $this->escapeInline($profMap[strtolower($profRaw)] ?? $profRaw);
            if ($lang === '') return '';
            $line = $prof !== '' ? '\\textbf{' . $lang . ':} ' . $prof : '\\textbf{' . $lang . '}';
            return '\\noindent ' . $line . "\\par\\vspace{0.3em}\n\n";
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

            $entry = "\\vspace{1.2em}\n\\noindent " . $statement . "\\par\\vspace{0.9em}\n";

            if ($isElectronic) {
                $signer = $nameVal !== '' ? $nameVal : 'Authorized Signatory';
                $entry .= "\\noindent\\begin{minipage}[t]{0.52\\textwidth}\n"
                    . '\\textbf{Date:} ' . ($dateVal !== '' ? $dateVal : '\\rule{3.2cm}{0.4pt}') . "\\par\n"
                    . "\\end{minipage}\\hfill\n"
                    . "\\begin{minipage}[t]{0.44\\textwidth}\n"
                    . "\\raggedleft\\textbf{Electronic Signature}\\par\n"
                    . "{\\large\\textit{" . $signer . "}}\\par\n"
                    . "{\\footnotesize\\color{black!60}Digitally signed}\\par\n"
                    . "\\end{minipage}\\par\n";
            } else {
                $entry .= '\\noindent\\textbf{Date:} ' . ($dateVal !== '' ? $dateVal : '\\rule{3.2cm}{0.4pt}')
                    . "\\hfill\\textbf{Signature:} \\rule{5.5cm}{0.4pt}\\par\n";
                if ($nameVal !== '') {
                    $entry .= '\\noindent\\hfill\\textit{' . $nameVal . "}\\par\n";
                }
            }

            return $entry . "\\vspace{0.45em}\n\n";
        }

        $title = $this->escapeInline(
            $data['position']
                ?? $data['degree']
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

        $entry = '';
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
        $entry .= "\\vspace{0.45em}\n\n";
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
            return LatexEscaper::escape($text);
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
                $out .= $inner !== '' ? '\\textbf{' . LatexEscaper::escape($inner) . '}' : LatexEscaper::escape($part);
                continue;
            }

            if (str_starts_with($part, '*') && str_ends_with($part, '*') && strlen($part) >= 3) {
                $inner = trim(substr($part, 1, -1));
                $out .= $inner !== '' ? '\\textit{' . LatexEscaper::escape($inner) . '}' : LatexEscaper::escape($part);
                continue;
            }

            $out .= LatexEscaper::escape($part);
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
