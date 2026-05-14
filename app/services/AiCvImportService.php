<?php
/**
 * AI-assisted CV PDF import service.
 *
 * Cost-saving design:
 * 1) Extract PDF text locally with pdftotext (no API cost).
 * 2) Build a local heuristic draft so the feature still works without an API key.
 * 3) Send only capped plain text to OpenAI when enabled, not the PDF/image pages.
 */
class AiCvImportService
{
    private const OCR_MODES = ['ocr_first', 'docling_only', 'tesseract_only'];

    private const MIN_TEXT_LENGTH = 80;

    private const OCR_TRIGGER_TEXT_LENGTH = 300;

    private const PERSONAL_INFO_KEYS = [
        'full_name',
        'title',
        'affiliation',
        'email',
        'phone',
        'location',
        'website',
        'linkedin',
        'orcid',
        'google_scholar',
    ];

    private const SECTION_KEYS = [
        'academic_profile',
        'education',
        'experience',
        'publications',
        'projects',
        'awards',
        'teaching',
        'certifications',
        'skills',
        'languages',
        'professional_memberships',
        'references',
    ];

    private const SECTION_FIELDS = [
        'academic_profile' => ['summary'],
        'education' => ['degree', 'institution', 'location', 'year_start', 'year_end', 'thesis', 'supervisor', 'gpa', 'description'],
        'experience' => ['position', 'organization', 'department', 'location', 'year_start', 'year_end', 'description'],
        'publications' => ['title', 'authors', 'year', 'publication_type', 'venue', 'volume_issue_pages', 'doi', 'url', 'status'],
        'projects' => ['title', 'role', 'organization', 'year_start', 'year_end', 'description', 'collaborators', 'outputs'],
        'awards' => ['title', 'organization', 'year', 'level', 'description'],
        'teaching' => ['course', 'code', 'level', 'institution', 'role', 'year_start', 'year_end', 'description'],
        'certifications' => ['title', 'issuer', 'year', 'credential_id', 'description'],
        'skills' => ['category', 'skills'],
        'languages' => ['language', 'proficiency'],
        'professional_memberships' => ['organization', 'role', 'year_start', 'year_end'],
        'references' => ['name', 'title', 'institution', 'email', 'phone', 'relationship'],
    ];

    private const FIELD_ALIASES = [
        'education' => ['school' => 'institution', 'college' => 'institution', 'university' => 'institution'],
        'experience' => ['institution' => 'organization', 'company' => 'organization', 'employer' => 'organization', 'role' => 'position', 'title' => 'position'],
        'publications' => ['journal' => 'venue'],
        'projects' => ['year' => 'year_start'],
        'teaching' => ['year' => 'year_start', 'organization' => 'institution'],
        'certifications' => ['organization' => 'issuer'],
        'professional_memberships' => ['year' => 'year_start'],
        'references' => ['organization' => 'institution'],
    ];

    public function importUploadedPdf(array $file, int $userId, array $options = []): array
    {
        $path = $this->storeTemporaryPdf($file, $userId);

        return $this->importStoredPdf($path, $options);
    }

    public function importStoredPdf(string $path, array $options = []): array
    {
        try {
            $extraction = $this->extractTextFromPdf($path, $options);
        } finally {
            @unlink($path);
        }

        return $this->importFromText($extraction['text'], [
            'extraction_method' => $extraction['method'] ?? 'pdftotext',
            'extraction_mode' => $extraction['mode'] ?? $this->resolveExtractionMode($options),
            'warnings' => $extraction['warnings'] ?? [],
            'docling_markdown' => $extraction['markdown'] ?? '',
            'docling_raw' => $extraction['raw'] ?? [],
        ]);
    }

    public function importFromText(string $text, array $context = []): array
    {
        $text = $this->normalizeText($text);
        $doclingMarkdown = $this->normalizeText((string) ($context['docling_markdown'] ?? ''));
        $doclingRaw = is_array($context['docling_raw'] ?? null) ? $context['docling_raw'] : [];
        $warnings = array_values(array_filter($context['warnings'] ?? []));
        $extractionMethod = (string) ($context['extraction_method'] ?? 'text');
        $extractionMode = (string) ($context['extraction_mode'] ?? AI_CV_IMPORT_OCR_MODE);
        $aiEnabled = $this->shouldUseOpenAi();
        $mustUseOpenAi = AI_CV_IMPORT_REQUIRE_OPENAI_MAPPING;

        if ($mustUseOpenAi && !$aiEnabled) {
            return [
                'success' => false,
                'error' => 'AI mapping is required but OpenAI is not configured. Set AI_CV_IMPORT_USE_OPENAI=true and provide OPENAI_API_KEY.',
                'extraction_method' => $extractionMethod,
                'warnings' => $warnings,
            ];
        }

        if (mb_strlen($text) < self::MIN_TEXT_LENGTH) {
            return [
                'success' => false,
                'error' => 'Could not extract enough readable text from this PDF. Please try a text-based PDF or paste the CV text.',
                'extraction_method' => $extractionMethod,
                'warnings' => $warnings,
            ];
        }

        $cappedText = $this->capText($text, $extractionMethod);
        $localDraft = $this->buildLocalDraft($cappedText);
        $provider = 'local_extraction';
        $aiStatus = $aiEnabled ? 'enabled' : 'disabled';
        $aiError = null;

        if ($aiEnabled) {
            $aiTimeout = $this->resolveAiTimeout($extractionMethod);
            $aiResult = $this->buildAiDraft($cappedText, $localDraft, $aiTimeout, [
                'docling_markdown' => $doclingMarkdown,
                'docling_raw' => $doclingRaw,
                'extraction_method' => $extractionMethod,
            ]);
            if (!empty($aiResult['success']) && is_array($aiResult['draft'] ?? null)) {
                $localDraft = $this->mergeDrafts($localDraft, $aiResult['draft']);
                $provider = 'openai_refined';
            } else {
                $aiStatus = 'failed';
                $aiError = (string) ($aiResult['error'] ?? 'AI refinement did not return usable JSON.');
                if ($mustUseOpenAi) {
                    return [
                        'success' => false,
                        'error' => 'AI mapping failed: ' . $aiError,
                        'extraction_method' => $extractionMethod,
                        'warnings' => $warnings,
                    ];
                }
                $warnings[] = 'AI refinement was unavailable, so a local low-cost draft was prepared instead.';
            }
        }

        $draft = $this->sanitizeDraft($localDraft);

        return [
            'success' => true,
            'provider' => $provider,
            'extraction_method' => $extractionMethod,
            'extraction_mode' => $extractionMode,
            'ai_status' => $aiStatus,
            'ai_error' => $aiError,
            'text_chars_sent' => mb_strlen($cappedText),
            'text_chars_extracted' => mb_strlen($text),
            'draft' => $draft,
            'draft_stats' => $this->draftStats($draft),
            'warnings' => $warnings,
        ];
    }

    public function applyDraftToCv(int $userId, array $draft, array $options = []): array
    {
        $mergeStrategy = (string) ($options['merge_strategy'] ?? 'fill_missing_add_new');
        if (!in_array($mergeStrategy, ['fill_missing_add_new', 'replace_selected_sections'], true)) {
            $mergeStrategy = 'fill_missing_add_new';
        }

        $draft = $this->sanitizeDraft($draft);
        $profileId = $this->ensureCvProfile($userId, $draft['personal_info'] ?? []);
        $draft = $this->alignDraftToProfileSchema($profileId, $draft);
        $userModel = new User();
        $currentUser = $userModel->findById($userId) ?: [];

        $profileModel = new CVProfile();
        if (!empty($draft['personal_info'])) {
            $profile = $profileModel->findById($profileId);
            $personalInfo = is_array($profile['personal_info'] ?? null) ? $profile['personal_info'] : [];
            foreach ($draft['personal_info'] as $key => $value) {
                $cleanValue = trim((string) $value);
                if ($cleanValue === '') continue;

                if ($mergeStrategy === 'fill_missing_add_new' && trim((string) ($personalInfo[$key] ?? '')) !== '') {
                    continue;
                }

                if ($cleanValue !== '') {
                    $personalInfo[$key] = trim((string) $value);
                }
            }
            $profileModel->update($profileId, ['personal_info' => $personalInfo]);

            $userUpdates = [];
            foreach (['full_name', 'title', 'affiliation'] as $field) {
                $incoming = trim((string) ($draft['personal_info'][$field] ?? ''));
                if ($incoming === '') continue;

                if (
                    $mergeStrategy === 'fill_missing_add_new'
                    && trim((string) ($userUpdates[$field] ?? '')) === ''
                    && trim((string) ($currentUser[$field] ?? '')) !== ''
                ) {
                    continue;
                }

                if ($incoming !== '') {
                    $userUpdates[$field] = $draft['personal_info'][$field];
                }
            }
            if (!empty($draft['personal_info']['orcid'])) {
                if (
                    $mergeStrategy !== 'fill_missing_add_new'
                    || trim((string) ($currentUser['orcid_id'] ?? '')) === ''
                ) {
                    $userUpdates['orcid_id'] = $draft['personal_info']['orcid'];
                }
            }
            $userUpdates['personal_info'] = json_encode($personalInfo);
            $userModel->update($userId, $userUpdates);
        }

        $added = [];
        $replaced = [];
        $dedupeFields = [
            'academic_profile' => 'summary',
            'education' => 'institution',
            'experience' => 'organization',
            'publications' => 'title',
            'projects' => 'title',
            'awards' => 'title',
            'teaching' => 'course',
            'certifications' => 'title',
            'skills' => 'category',
            'languages' => 'language',
            'professional_memberships' => 'organization',
            'references' => 'name',
        ];

        $importService = new ProfileImportService();

        foreach (self::SECTION_KEYS as $sectionKey) {
            $entries = $draft[$sectionKey] ?? [];
            if (!is_array($entries) || empty($entries)) continue;

            if ($mergeStrategy === 'replace_selected_sections') {
                $replaced[$sectionKey] = $importService->clearSectionEntriesForLatestProfile($userId, $sectionKey);
            }

            $added[$sectionKey] = $importService->addEntriesToCvSection(
                $userId,
                $sectionKey,
                $entries,
                $dedupeFields[$sectionKey] ?? 'title'
            );
        }

        return [
            'success' => true,
            'profile_id' => $profileId,
            'edit_url' => APP_URL . '/cv/edit/' . $profileId,
            'added' => $added,
            'replaced' => $replaced,
            'merge_strategy' => $mergeStrategy,
            'message' => 'Imported CV draft was applied. Please review the sections before compiling.',
        ];
    }

    private function storeTemporaryPdf(array $file, int $userId): string
    {
        $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($uploadError !== UPLOAD_ERR_OK) {
            $errorMap = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds server upload limit (php.ini upload_max_filesize). Try a smaller file.',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds form size limit. Try a smaller file.',
                UPLOAD_ERR_PARTIAL => 'File upload was interrupted. Try again.',
                UPLOAD_ERR_NO_FILE => 'Please upload a valid PDF file.',
                UPLOAD_ERR_NO_TMP_DIR => 'Server temporary directory is misconfigured.',
                UPLOAD_ERR_CANT_WRITE => 'Could not write uploaded file to disk. Check server storage.',
                UPLOAD_ERR_EXTENSION => 'File upload blocked by server extension.',
            ];
            $msg = $errorMap[$uploadError] ?? ('Upload error code ' . $uploadError);
            error_log('PDF upload error ' . $uploadError . ' for user ' . $userId . ': ' . $msg);
            throw new RuntimeException($msg);
        }

        $maxBytes = AI_CV_IMPORT_MAX_UPLOAD_MB * 1024 * 1024;
        if ((int) ($file['size'] ?? 0) > $maxBytes) {
            throw new RuntimeException('PDF is too large. Maximum size is ' . AI_CV_IMPORT_MAX_UPLOAD_MB . ' MB.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $originalName = (string) ($file['name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            error_log('PDF temporary file missing or not valid for user ' . $userId . ': tmp=' . $tmpName);
            throw new RuntimeException('Upload failed. Please try again.');
        }

        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if ($ext !== 'pdf') {
            throw new RuntimeException('Only PDF files are supported for this import.');
        }

        $mime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $mime = (string) finfo_file($finfo, $tmpName);
                finfo_close($finfo);
            }
        }
        if ($mime !== '' && !in_array($mime, ['application/pdf', 'application/x-pdf'], true)) {
            throw new RuntimeException('Uploaded file does not look like a PDF.');
        }

        $dir = UPLOAD_DIR . '/ai_cv_imports';
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true)) {
                error_log('Failed to create PDF import directory: ' . $dir);
                throw new RuntimeException('Server storage directory could not be created. Check permissions.');
            }
        }
        if (!is_writable($dir)) {
            error_log('PDF import directory not writable: ' . $dir);
            throw new RuntimeException('Server storage directory is not writable. Check permissions.');
        }

        $path = $dir . '/user-' . $userId . '-' . bin2hex(random_bytes(8)) . '.pdf';
        if (!move_uploaded_file($tmpName, $path)) {
            error_log('Failed to move uploaded PDF to: ' . $path . ' (from ' . $tmpName . ')');
            throw new RuntimeException('Could not save uploaded PDF to storage. Check server disk space and permissions.');
        }

        return $path;
    }

    private function extractTextFromPdf(string $path, array $options = []): array
    {
        $warnings = [];
        $textFallback = '';
        $mode = $this->resolveExtractionMode($options);

        if ($mode === 'docling_only') {
            if (!$this->shouldUseDoclingForOcr()) {
                throw new RuntimeException('Docling-only mode is enabled, but Docling is not configured. Set AI_CV_IMPORT_DOCLING_URL and ensure the service is reachable.');
            }
            $doclingResult = $this->extractTextWithDocling($path, $warnings, true);
            if ($this->looksReadable($doclingResult['text'] ?? '')) {
                $warnings[] = 'Docling-only mode: extraction used Docling OCR.';
                return [
                    'text' => $doclingResult['text'] ?? '',
                    'markdown' => $doclingResult['markdown'] ?? ($doclingResult['text'] ?? ''),
                    'method' => 'docling_ocr',
                    'mode' => $mode,
                    'raw' => [
                        'source' => 'docling',
                        'text' => $doclingResult['text'] ?? '',
                        'markdown' => $doclingResult['markdown'] ?? ($doclingResult['text'] ?? ''),
                    ],
                    'warnings' => $warnings,
                ];
            }
            throw new RuntimeException('Docling-only mode failed to extract readable text. ' . implode(' ', $warnings));
        }

        if ($mode === 'tesseract_only') {
            $ocrText = $this->extractTextWithOcr($path, $warnings);
            if ($this->looksReadable($ocrText)) {
                $warnings[] = 'Tesseract-only mode: extraction used Tesseract OCR.';
                return [
                    'text' => $ocrText,
                    'markdown' => $ocrText,
                    'method' => 'ocr',
                    'mode' => $mode,
                    'raw' => [
                        'source' => 'ocr',
                        'text' => $ocrText,
                        'markdown' => $ocrText,
                    ],
                    'warnings' => $warnings,
                ];
            }
            throw new RuntimeException('Tesseract-only mode failed to extract readable text. ' . implode(' ', $warnings));
        }

        // OCR-first default path for all PDFs.
        if ($this->shouldUseDoclingForOcr()) {
            $doclingResult = $this->extractTextWithDocling($path, $warnings, false);
            if ($this->looksReadable($doclingResult['text'] ?? '')) {
                $warnings[] = 'OCR-first mode: Docling OCR extraction was used by default.';
                return [
                    'text' => $doclingResult['text'] ?? '',
                    'markdown' => $doclingResult['markdown'] ?? ($doclingResult['text'] ?? ''),
                    'method' => 'docling_ocr',
                    'mode' => $mode,
                    'raw' => [
                        'source' => 'docling',
                        'text' => $doclingResult['text'] ?? '',
                        'markdown' => $doclingResult['markdown'] ?? ($doclingResult['text'] ?? ''),
                    ],
                    'warnings' => $warnings,
                ];
            }
        }

        $ocrText = $this->extractTextWithOcr($path, $warnings);
        if ($this->looksReadable($ocrText)) {
            $warnings[] = 'OCR-first mode: Tesseract OCR extraction was used.';
            return [
                'text' => $ocrText,
                'markdown' => $ocrText,
                'method' => 'ocr',
                'mode' => $mode,
                'raw' => [
                    'source' => 'ocr',
                    'text' => $ocrText,
                    'markdown' => $ocrText,
                ],
                'warnings' => $warnings,
            ];
        }

        // Last-resort fallback to embedded PDF text layer when OCR fails.
        $pdftotext = $this->findCommand('pdftotext');
        if ($pdftotext !== '') {
            $cmd = escapeshellcmd($pdftotext) . ' -layout -enc UTF-8 ' . escapeshellarg($path) . ' - 2>/dev/null';
            $textFallback = $this->normalizeText((string) shell_exec($cmd));
        } else {
            $warnings[] = 'pdftotext is not installed, so no text-layer fallback was available after OCR.';
        }

        if ($textFallback !== '') {
            $warnings[] = 'OCR-first mode could not get readable OCR output, so embedded PDF text fallback was used.';
            return [
                'text' => $textFallback,
                'markdown' => $textFallback,
                'method' => 'pdftotext',
                'mode' => $mode,
                'raw' => [
                    'source' => 'pdftotext',
                    'text' => $textFallback,
                    'markdown' => $textFallback,
                ],
                'warnings' => $warnings,
            ];
        }

        throw new RuntimeException('Could not extract readable text from this PDF. OCR and text-layer fallback both failed.');
    }

    private function resolveExtractionMode(array $options = []): string
    {
        $mode = strtolower(trim((string) ($options['ocr_mode'] ?? AI_CV_IMPORT_OCR_MODE)));
        if (!in_array($mode, self::OCR_MODES, true)) {
            return 'ocr_first';
        }
        return $mode;
    }

    private function shouldUseOpenAi(): bool
    {
        return AI_CV_IMPORT_USE_OPENAI && OPENAI_API_KEY !== '';
    }

    private function shouldUseDoclingForOcr(): bool
    {
        return AI_CV_IMPORT_USE_DOCLING_FOR_OCR && trim(AI_CV_IMPORT_DOCLING_URL) !== '';
    }

    private function buildAiDraft(string $text, array $localDraft, int $timeoutSeconds = AI_CV_IMPORT_API_TIMEOUT, array $context = []): array
    {
        $schemaDescription = $this->schemaDescription();
        $doclingMarkdown = trim((string) ($context['docling_markdown'] ?? ''));
        $doclingRaw = is_array($context['docling_raw'] ?? null) ? $context['docling_raw'] : [];
        $universalContext = $this->buildUniversalMappingContext($text, $doclingMarkdown);
        $structuredContext = [
            'extraction_method' => (string) ($context['extraction_method'] ?? 'text'),
            'docling_markdown' => $doclingMarkdown !== '' ? $this->capStructuredText($doclingMarkdown, 18000) : '',
            'docling_raw' => $doclingRaw,
            'universal_context' => $universalContext,
        ];
        $payload = [
            'model' => OPENAI_CV_IMPORT_MODEL,
            'temperature' => 0.1,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You extract academic CV data into strict JSON for an academic CV editor. Return only valid JSON. Never invent facts. Preserve separate entries instead of merging them. Keep chronology intact. If a value is unclear, leave it empty instead of guessing. Never put year ranges into phone numbers. Never set academic profile summary to placeholders like BIO/SUMMARY/PROFILE. If a field value looks noisy or meaningless, leave it empty.',
                ],
                [
                    'role' => 'user',
                    'content' => "Extract this academic CV into the JSON shape below. Empty fields must stay empty strings or empty arrays. Do not rewrite the candidate in marketing language. Keep publications, jobs, education records, and teaching entries separate. Prefer evidence from the CV text over the local draft if they conflict, but do not hallucinate missing information.\n\nValidation rules:\n- personal_info.phone: only real phone numbers (approximately 9-15 digits after symbols are removed), never year ranges like 2016-2020\n- personal_info.email: must look like a valid email\n- academic_profile.summary: must be meaningful prose (at least one complete sentence), not single-word labels\n- education/experience entries: include only entries with meaningful role/degree and organization/institution evidence\n\nUse structured context in this priority:\n1) universal_context.section_blocks and universal_context.chronological_blocks\n2) docling_markdown/docling_raw\n3) plain CV text\n4) local draft\n\nDo not merge different jobs into one entry. If there are multiple date ranges, split them into separate experience entries unless evidence clearly says they are one role.\n\nJSON shape:\n" . $schemaDescription . "\n\nStructured extraction context:\n" . json_encode($structuredContext, JSON_UNESCAPED_UNICODE) . "\n\nLocal draft from regex extraction (may contain mistakes):\n" . json_encode($localDraft, JSON_UNESCAPED_UNICODE) . "\n\nCV text:\n" . $text,
                ],
            ],
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . OPENAI_API_KEY,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(10, $timeoutSeconds),
        ]);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode < 200 || $httpCode >= 300) {
            error_log('AiCvImportService OpenAI error: HTTP ' . $httpCode . ' ' . substr((string) $response, 0, 500));
            return [
                'success' => false,
                'error' => $curlError !== '' ? $curlError : ('OpenAI request failed with HTTP ' . $httpCode),
                'http_code' => $httpCode,
            ];
        }

        $decoded = json_decode((string) $response, true);
        $content = $decoded['choices'][0]['message']['content'] ?? '';
        $draft = json_decode((string) $content, true);
        if (!is_array($draft)) {
            return [
                'success' => false,
                'error' => 'OpenAI returned non-JSON content for the CV import draft.',
                'http_code' => $httpCode,
            ];
        }

        $draft = $this->sanitizeDraft($draft);
        if (!$this->hasStructuredDraftContent($draft)) {
            return [
                'success' => false,
                'error' => 'OpenAI returned JSON, but it did not contain enough structured CV data to trust.',
                'http_code' => $httpCode,
            ];
        }

        return [
            'success' => true,
            'draft' => $draft,
            'http_code' => $httpCode,
        ];
    }

    private function buildLocalDraft(string $text): array
    {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R+/', $text) ?: []), static fn($line) => $line !== ''));
        $sections = $this->splitSections($lines);

        return [
            'personal_info' => $this->extractPersonalInfo($lines, $text),
            'academic_profile' => $this->extractAcademicProfile($sections),
            'education' => $this->extractEducation($sections),
            'experience' => $this->extractExperience($sections),
            'publications' => $this->extractPublications($sections),
            'projects' => $this->genericEntries($sections, ['projects', 'research projects'], 'title'),
            'awards' => $this->genericEntries($sections, ['awards', 'honors', 'honours', 'scholarships'], 'title'),
            'teaching' => $this->genericEntries($sections, ['teaching', 'teaching experience'], 'course'),
            'certifications' => $this->genericEntries($sections, ['certifications', 'certificates'], 'title'),
            'skills' => $this->extractSkills($sections),
            'languages' => $this->extractLanguages($sections),
            'professional_memberships' => $this->genericEntries($sections, ['memberships', 'professional memberships'], 'organization'),
            'references' => $this->extractReferences($sections),
        ];
    }

    private function extractPersonalInfo(array $lines, string $text): array
    {
        $email = '';
        if (preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $m)) $email = $m[0];

        $phone = $this->extractLikelyPhone($text);

        $website = '';
        if (preg_match('/https?:\/\/[^\s,;]+/i', $text, $m)) $website = rtrim($m[0], '.');

        $orcid = '';
        if (preg_match('/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/', $text, $m)) $orcid = $m[0];

        $name = '';
        foreach (array_slice($lines, 0, 12) as $line) {
            if ($this->isHeading($line) || str_contains($line, '@') || preg_match('/\d{4}-\d{4}/', $line)) continue;
            if (mb_strlen($line) >= 4 && mb_strlen($line) <= 80) {
                $name = preg_replace('/\s{2,}/', ' ', $line);
                break;
            }
        }

        return array_filter([
            'full_name' => $name,
            'title' => '',
            'affiliation' => '',
            'email' => $email,
            'phone' => $phone,
            'location' => '',
            'website' => $website,
            'linkedin' => $this->firstMatch('/linkedin\.com\/[^\s,;]+/i', $text),
            'orcid' => $orcid,
            'google_scholar' => '',
        ], static fn($value) => $value !== '');
    }

    private function splitSections(array $lines): array
    {
        $sections = ['header' => []];
        $current = 'header';
        foreach ($lines as $line) {
            $heading = $this->normalizeHeading($line);
            if ($heading !== '') {
                $current = $heading;
                $sections[$current] ??= [];
                continue;
            }
            $sections[$current][] = $this->cleanLine($line);
        }
        return $sections;
    }

    private function normalizeHeading(string $line): string
    {
        $clean = strtolower(trim($line, " \t:-–—"));
        $clean = preg_replace('/\s+/', ' ', $clean);
        $known = [
            'profile', 'summary', 'academic profile', 'professional summary', 'research interests',
            'education', 'educational qualifications', 'academic qualifications',
            'experience', 'work experience', 'employment', 'academic experience', 'appointments',
            'publications', 'selected publications', 'research publications',
            'projects', 'research projects', 'awards', 'honors', 'honours', 'scholarships',
            'teaching', 'teaching experience', 'certifications', 'certificates', 'skills',
            'technical skills', 'languages', 'memberships', 'professional memberships', 'references',
        ];
        if (in_array($clean, $known, true)) return $clean;
        if (mb_strlen($clean) <= 45 && preg_match('/^(education|experience|publications?|awards?|skills?|references?)/', $clean)) return $clean;
        return '';
    }

    private function isHeading(string $line): bool
    {
        return $this->normalizeHeading($line) !== '';
    }

    private function extractAcademicProfile(array $sections): array
    {
        $lines = $this->sectionLines($sections, ['profile', 'summary', 'academic profile', 'professional summary', 'research interests']);
        $summary = trim(implode(' ', array_slice($lines, 0, 8)));
        if ($summary === '') {
            $header = $sections['header'] ?? [];
            $summary = trim(implode(' ', array_slice($header, 1, 4)));
        }
        $summary = $this->cleanLine($summary);
        return $summary !== '' ? [['summary' => $summary]] : [];
    }

    private function extractEducation(array $sections): array
    {
        $blocks = $this->entryBlocks($this->sectionLines($sections, ['education', 'educational qualifications', 'academic qualifications']));
        $entries = [];
        foreach ($blocks as $block) {
            $line = implode(' ', $block);
            $entries[] = array_filter([
                'degree' => $this->firstMatch('/\b(Ph\.?D\.?|DPhil|M\.?Sc\.?|MA|MBA|MPhil|B\.?Sc\.?|BA|MD|Bachelor[^,;]*|Master[^,;]*|Doctor[^,;]*)[^,;]*/i', $line),
                'institution' => $this->guessOrganization($line),
                'location' => '',
                'year_start' => $this->firstYear($line),
                'year_end' => $this->lastYearOrPresent($line),
                'description' => $line,
            ], static fn($value) => $value !== '');
        }
        return $this->limitEntries($entries);
    }

    private function extractExperience(array $sections): array
    {
        $blocks = $this->entryBlocks($this->sectionLines($sections, ['experience', 'work experience', 'employment', 'academic experience', 'appointments']));
        $entries = [];
        foreach ($blocks as $block) {
            $line = implode(' ', $block);
            $entries[] = array_filter([
                'position' => $this->guessPosition($line),
                'organization' => $this->guessOrganization($line),
                'department' => '',
                'location' => '',
                'year_start' => $this->firstYear($line),
                'year_end' => $this->lastYearOrPresent($line),
                'description' => $line,
            ], static fn($value) => $value !== '');
        }
        return $this->limitEntries($entries);
    }

    private function extractPublications(array $sections): array
    {
        $blocks = $this->entryBlocks($this->sectionLines($sections, ['publications', 'selected publications', 'research publications']));
        $entries = [];
        foreach ($blocks as $block) {
            $line = implode(' ', $block);
            $title = trim(preg_replace('/^\(?\d+\)?[.)]?\s*/', '', $line));
            $entries[] = array_filter([
                'title' => mb_substr($title, 0, 500),
                'authors' => '',
                'year' => $this->firstYear($line),
                'publication_type' => '',
                'venue' => '',
                'doi' => $this->firstMatch('/10\.\d{4,9}\/[-._;()\/:A-Z0-9]+/i', $line),
                'url' => $this->firstMatch('/https?:\/\/[^\s,;]+/i', $line),
                'status' => '',
            ], static fn($value) => $value !== '');
        }
        return $this->limitEntries($entries, 30);
    }

    private function extractSkills(array $sections): array
    {
        $lines = $this->sectionLines($sections, ['skills', 'technical skills']);
        $text = trim(implode(', ', $lines));
        return $text !== '' ? [['category' => 'Skills', 'skills' => $text]] : [];
    }

    private function extractLanguages(array $sections): array
    {
        $lines = $this->sectionLines($sections, ['languages']);
        $entries = [];
        foreach ($this->entryBlocks($lines) as $block) {
            $line = implode(' ', $block);
            $entries[] = ['language' => $line, 'proficiency' => ''];
        }
        return $this->limitEntries($entries, 10);
    }

    private function extractReferences(array $sections): array
    {
        $blocks = $this->entryBlocks($this->sectionLines($sections, ['references']));
        $entries = [];
        foreach ($blocks as $block) {
            $line = implode(' ', $block);
            $entries[] = array_filter([
                'name' => mb_substr($block[0] ?? $line, 0, 120),
                'title' => '',
                'institution' => $this->guessOrganization($line),
                'email' => $this->firstMatch('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $line),
                'phone' => '',
            ], static fn($value) => $value !== '');
        }
        return $this->limitEntries($entries, 8);
    }

    private function genericEntries(array $sections, array $names, string $mainField): array
    {
        $entries = [];
        foreach ($this->entryBlocks($this->sectionLines($sections, $names)) as $block) {
            $line = implode(' ', $block);
            $entry = [$mainField => mb_substr($line, 0, 250)];
            if ($year = $this->firstYear($line)) $entry['year'] = $year;
            $entries[] = $entry;
        }
        return $this->limitEntries($entries);
    }

    private function sectionLines(array $sections, array $names): array
    {
        $lines = [];
        foreach ($sections as $name => $sectionLines) {
            foreach ($names as $wanted) {
                if ($name === $wanted || str_contains($name, $wanted)) {
                    $lines = array_merge($lines, $sectionLines);
                }
            }
        }
        return $lines;
    }

    private function entryBlocks(array $lines): array
    {
        $blocks = [];
        $current = [];
        foreach ($lines as $line) {
            $isNew = preg_match('/^(?:[•*\-–—]|\(?\d+\)?[.)])\s+/', $line) || preg_match('/\b(19|20)\d{2}\b.*\b(19|20)\d{2}|present/i', $line);
            if ($isNew && $current) {
                $blocks[] = $current;
                $current = [];
            }
            $current[] = preg_replace('/^(?:[•*\-–—]|\(?\d+\)?[.)])\s+/', '', $line);
        }
        if ($current) $blocks[] = $current;
        return array_values(array_filter($blocks, static fn($block) => trim(implode(' ', $block)) !== ''));
    }

    private function firstMatch(string $pattern, string $text): string
    {
        return preg_match($pattern, $text, $m) ? trim($m[0]) : '';
    }

    private function firstYear(string $text): string
    {
        return preg_match('/\b(19|20)\d{2}\b/', $text, $m) ? $m[0] : '';
    }

    private function lastYearOrPresent(string $text): string
    {
        if (preg_match('/present|current/i', $text)) return 'Present';
        preg_match_all('/\b(19|20)\d{2}\b/', $text, $m);
        return !empty($m[0]) ? end($m[0]) : '';
    }

    private function guessOrganization(string $text): string
    {
        if (preg_match('/(?:at|,|–|-|\|)\s*([^,;|]{3,80}(?:University|College|Institute|Laboratory|Lab|Hospital|School|Department|Centre|Center|Inc\.?|Ltd\.?|Pvt\.?|Corporation|Organization)[^,;|]*)/i', $text, $m)) {
            return trim($m[1]);
        }
        return '';
    }

    private function guessPosition(string $text): string
    {
        if (preg_match('/\b(Professor|Lecturer|Research Assistant|Teaching Assistant|Postdoctoral[^,;]*|Researcher|Scientist|Engineer|Manager|Consultant|Intern|Fellow|Director|Coordinator)[^,;]*/i', $text, $m)) {
            return trim($m[0]);
        }
        return '';
    }

    private function limitEntries(array $entries, int $limit = 20): array
    {
        $entries = array_values(array_filter($entries, static fn($entry) => is_array($entry) && count(array_filter($entry)) > 0));
        return array_slice($entries, 0, $limit);
    }

    private function ensureCvProfile(int $userId, array $personalInfo): int
    {
        $cvModel = new CVProfile();
        $profiles = $cvModel->findByUser($userId);
        if (!empty($profiles)) {
            return (int) $profiles[0]['id'];
        }

        $templateId = $this->firstAvailableTemplateId($userId);
        $profileId = $cvModel->create([
            'user_id' => $userId,
            'template_id' => $templateId,
            'name' => 'Imported CV Draft',
            'personal_info' => $personalInfo,
        ]);
        $this->createDefaultSections($profileId, $templateId);
        return $profileId;
    }

    private function firstAvailableTemplateId(int $userId): int
    {
        $user = (new User())->findById($userId) ?: [];
        $templates = (new Template())->getAvailableForUser($user['subscription_plan'] ?? 'free');
        if (!empty($templates)) return (int) $templates[0]['id'];
        $all = (new Template())->getAll(false);
        return (int) ($all[0]['id'] ?? 1);
    }

    private function createDefaultSections(int $profileId, int $templateId): void
    {
        $db = Database::getInstance()->getConnection();
        foreach ((new Template())->getSections($templateId) as $section) {
            $stmt = $db->prepare('INSERT IGNORE INTO cv_sections (profile_id, section_key, section_order) VALUES (?, ?, ?)');
            $stmt->execute([$profileId, $section['section_key'], $section['section_order']]);
        }
    }

    private function sanitizeDraft(array $draft): array
    {
        $clean = ['personal_info' => []];
        foreach (self::PERSONAL_INFO_KEYS as $key) {
            $value = trim((string) ($draft['personal_info'][$key] ?? ''));
            if ($value !== '') $clean['personal_info'][$key] = mb_substr($value, 0, 500);
        }

        foreach (self::SECTION_KEYS as $sectionKey) {
            $entries = $draft[$sectionKey] ?? [];
            if (!is_array($entries)) {
                $clean[$sectionKey] = [];
                continue;
            }
            $clean[$sectionKey] = [];
            foreach (array_slice($entries, 0, 40) as $entry) {
                if (!is_array($entry)) continue;
                $row = $this->normalizeSectionEntry($sectionKey, $entry);
                if (!empty($row)) $clean[$sectionKey][] = $row;
            }
        }
        return $this->validateDraft($clean);
    }

    private function mergeDrafts(array $localDraft, array $aiDraft): array
    {
        $aiDraft = $this->sanitizeDraft($aiDraft);
        foreach ($aiDraft as $key => $value) {
            if ($key === 'personal_info') {
                $localDraft[$key] = $this->mergePersonalInfo($localDraft[$key] ?? [], $value);
            } elseif (is_array($value) && !empty($value)) {
                $localDraft[$key] = $this->pickBetterSectionEntries($localDraft[$key] ?? [], $value);
            }
        }
        return $localDraft;
    }

    private function schemaDescription(): string
    {
        return json_encode([
            'personal_info' => ['full_name' => '', 'title' => '', 'affiliation' => '', 'email' => '', 'phone' => '', 'location' => '', 'website' => '', 'linkedin' => '', 'orcid' => '', 'google_scholar' => ''],
            'academic_profile' => [['summary' => '']],
            'education' => [['degree' => '', 'institution' => '', 'location' => '', 'year_start' => '', 'year_end' => '', 'thesis' => '', 'supervisor' => '', 'gpa' => '', 'description' => '']],
            'experience' => [['position' => '', 'organization' => '', 'department' => '', 'location' => '', 'year_start' => '', 'year_end' => '', 'description' => '']],
            'publications' => [['title' => '', 'authors' => '', 'year' => '', 'publication_type' => '', 'venue' => '', 'volume_issue_pages' => '', 'doi' => '', 'url' => '', 'status' => '']],
            'projects' => [['title' => '', 'role' => '', 'organization' => '', 'year_start' => '', 'year_end' => '', 'description' => '']],
            'awards' => [['title' => '', 'organization' => '', 'year' => '', 'level' => '', 'description' => '']],
            'teaching' => [['course' => '', 'institution' => '', 'year' => '', 'description' => '']],
            'certifications' => [['title' => '', 'organization' => '', 'year' => '']],
            'skills' => [['category' => '', 'skills' => '']],
            'languages' => [['language' => '', 'proficiency' => '']],
            'professional_memberships' => [['organization' => '', 'role' => '', 'year' => '']],
            'references' => [['name' => '', 'title' => '', 'institution' => '', 'email' => '', 'phone' => '']],
        ], JSON_PRETTY_PRINT);
    }

    private function capText(string $text, string $extractionMethod = 'text'): string
    {
        $limit = AI_CV_IMPORT_TEXT_CHAR_LIMIT;
        if (in_array($extractionMethod, ['ocr', 'docling_ocr'], true)) {
            $limit = AI_CV_IMPORT_OCR_TEXT_CHAR_LIMIT;
        }
        return mb_substr($text, 0, max(2000, $limit));
    }

    private function capStructuredText(string $text, int $limit): string
    {
        $text = trim($text);
        if (mb_strlen($text) <= $limit) {
            return $text;
        }

        return mb_substr($text, 0, $limit) . "\n\n[TRUNCATED]";
    }

    private function buildUniversalMappingContext(string $plainText, string $doclingMarkdown): array
    {
        $source = trim($doclingMarkdown) !== '' ? $doclingMarkdown : $plainText;
        $lines = preg_split('/\R+/', $source) ?: [];
        $cleanLines = [];
        foreach ($lines as $line) {
            $line = $this->cleanLine((string) $line);
            if ($line === '' || mb_strlen($line) < 2) {
                continue;
            }
            $cleanLines[] = $line;
        }

        $sectionBlocks = [];
        $headingCandidates = [];
        $currentSection = 'unclassified';
        $sectionBlocks[$currentSection] = [];

        foreach ($cleanLines as $line) {
            $canonical = $this->canonicalSectionFromHeading($line);
            if ($canonical !== '') {
                $currentSection = $canonical;
                $headingCandidates[] = $line;
                $sectionBlocks[$currentSection] ??= [];
                continue;
            }
            $sectionBlocks[$currentSection][] = $line;
        }

        $compressedSections = [];
        foreach ($sectionBlocks as $section => $sectionLines) {
            $joined = trim(implode("\n", array_slice($sectionLines, 0, 120)));
            if ($joined !== '') {
                $compressedSections[$section] = $this->capStructuredText($joined, 3000);
            }
        }

        $chronoBlocks = [];
        $current = [];
        foreach ($cleanLines as $line) {
            $dateSignal = preg_match('/\b(19|20)\d{2}\b\s*(?:-|to|–|—)\s*(?:\b(19|20)\d{2}\b|present|current)|\b(19|20)\d{2}\b/i', $line) === 1;
            if ($dateSignal && !empty($current)) {
                $chronoBlocks[] = implode(' ', $current);
                $current = [];
            }
            $current[] = $line;
        }
        if (!empty($current)) {
            $chronoBlocks[] = implode(' ', $current);
        }

        $chronoBlocks = array_values(array_filter(array_map(fn($b) => $this->capStructuredText(trim((string) $b), 800), array_slice($chronoBlocks, 0, 30)), fn($b) => $b !== ''));

        return [
            'layout_hint' => $this->inferLayoutHint($cleanLines),
            'heading_candidates' => array_values(array_unique(array_slice($headingCandidates, 0, 40))),
            'section_blocks' => $compressedSections,
            'chronological_blocks' => $chronoBlocks,
        ];
    }

    private function canonicalSectionFromHeading(string $line): string
    {
        if (!$this->isLikelyHeadingLine($line)) {
            return '';
        }

        $normalized = strtolower(trim(preg_replace('/\s+/', ' ', $line) ?? $line));
        $map = [
            'personal' => ['personal information', 'contact', 'about me'],
            'academic_profile' => ['profile', 'summary', 'objective', 'about', 'research interests'],
            'education' => ['education', 'academic qualifications', 'educational qualifications'],
            'experience' => ['experience', 'work experience', 'employment history', 'professional experience', 'appointments'],
            'publications' => ['publications', 'selected publications', 'research publications'],
            'projects' => ['projects', 'research projects'],
            'awards' => ['awards', 'honors', 'honours', 'scholarships', 'achievements'],
            'teaching' => ['teaching', 'teaching experience'],
            'certifications' => ['certifications', 'certificates', 'licenses'],
            'skills' => ['skills', 'technical skills', 'core competencies'],
            'languages' => ['languages'],
            'professional_memberships' => ['memberships', 'professional memberships', 'affiliations'],
            'references' => ['references', 'referees'],
        ];

        foreach ($map as $canonical => $candidates) {
            foreach ($candidates as $candidate) {
                if ($normalized === $candidate || str_contains($normalized, $candidate)) {
                    return $canonical;
                }
            }
        }

        return '';
    }

    private function isLikelyHeadingLine(string $line): bool
    {
        $line = trim($line);
        if ($line === '' || mb_strlen($line) > 70) {
            return false;
        }
        if (str_contains($line, '@') || preg_match('/https?:\/\//i', $line)) {
            return false;
        }
        $alphaOnly = preg_replace('/[^A-Za-z ]/', '', $line) ?? '';
        $wordCount = count(array_filter(explode(' ', trim($alphaOnly)), fn($w) => $w !== ''));
        if ($wordCount < 1 || $wordCount > 6) {
            return false;
        }
        return preg_match('/^[A-Z][A-Za-z\s&\/\-]{1,69}$/', $line) === 1 || strtoupper($line) === $line;
    }

    private function inferLayoutHint(array $lines): string
    {
        $sample = array_slice($lines, 0, 120);
        if (empty($sample)) {
            return 'unknown';
        }

        $pipeLike = 0;
        $bullets = 0;
        $longLines = 0;
        foreach ($sample as $line) {
            if (str_contains($line, '|') || str_contains($line, '•')) {
                $pipeLike++;
            }
            if (preg_match('/^(?:[•\-*]|\d+[.)])\s+/', $line)) {
                $bullets++;
            }
            if (mb_strlen($line) > 110) {
                $longLines++;
            }
        }

        if ($pipeLike >= 8) {
            return 'multi-column-or-table';
        }
        if ($bullets >= 8) {
            return 'bullet-heavy';
        }
        if ($longLines >= 30) {
            return 'dense-paragraph';
        }
        return 'standard';
    }

    private function resolveAiTimeout(string $extractionMethod): int
    {
        if (in_array($extractionMethod, ['ocr', 'docling_ocr'], true)) {
            return AI_CV_IMPORT_OCR_API_TIMEOUT;
        }
        return AI_CV_IMPORT_API_TIMEOUT;
    }

    private function normalizeText(string $text): string
    {
        $text = str_replace("\0", '', $text);
        $text = preg_replace('/([A-Za-z])\-\R([A-Za-z])/', '$1$2', $text) ?? $text;
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\R{3,}/', "\n\n", $text) ?? $text;
        return trim($text);
    }

    private function cleanLine(string $line): string
    {
        return trim(preg_replace('/\s+/', ' ', $line) ?? $line);
    }

    private function findCommand(string $command): string
    {
        return trim((string) shell_exec('command -v ' . escapeshellarg($command) . ' 2>/dev/null'));
    }

    private function extractTextWithOcr(string $path, array &$warnings): string
    {
        $pdftoppm = $this->findCommand('pdftoppm');
        $tesseract = $this->findCommand('tesseract');
        if ($pdftoppm === '' || $tesseract === '') {
            $warnings[] = 'OCR fallback is not installed on the server, so scanned PDFs may import poorly.';
            return '';
        }

        $tempDir = UPLOAD_DIR . '/ai_cv_imports/ocr-' . bin2hex(random_bytes(8));
        if (!@mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
            $warnings[] = 'OCR fallback could not create a temporary working directory.';
            return '';
        }

        try {
            $prefix = $tempDir . '/page';
            $cmd = escapeshellcmd($pdftoppm) . ' -r 300 -gray -png ' . escapeshellarg($path) . ' ' . escapeshellarg($prefix) . ' 2>/dev/null';
            shell_exec($cmd);

            $images = glob($prefix . '-*.png') ?: [];
            sort($images);
            $chunks = [];
            $ocrLang = $this->resolveOcrLanguage();
            foreach (array_slice($images, 0, 20) as $image) {
                $ocrCmd = escapeshellcmd($tesseract) . ' ' . escapeshellarg($image) . ' stdout -l ' . escapeshellarg($ocrLang) . ' --oem 1 --psm 6 2>/dev/null';
                $chunk = $this->normalizeText((string) shell_exec($ocrCmd));
                if ($chunk !== '') {
                    $chunks[] = $chunk;
                }
            }

            return $this->normalizeText($this->repairOcrText(implode("\n\n", $chunks)));
        } finally {
            foreach (glob($tempDir . '/*') ?: [] as $filePath) {
                @unlink($filePath);
            }
            @rmdir($tempDir);
        }
    }

    private function extractTextWithDocling(string $path, array &$warnings, bool $robustMode = false): array
    {
        $baseUrl = rtrim(trim(AI_CV_IMPORT_DOCLING_URL), '/');
        if ($baseUrl === '') {
            return ['text' => '', 'markdown' => ''];
        }

        if (!function_exists('curl_file_create')) {
            $warnings[] = 'Docling OCR was skipped because curl_file_create is unavailable.';
            return ['text' => '', 'markdown' => ''];
        }

        $endpoints = $this->resolveDoclingEndpoints($baseUrl);
        $timeoutSeconds = $robustMode ? max(AI_CV_IMPORT_DOCLING_TIMEOUT, 300) : AI_CV_IMPORT_DOCLING_TIMEOUT;

        $result = ['ok' => false, 'text' => '', 'markdown' => '', 'warning' => ''];
        foreach ($endpoints as $endpoint) {
            $result = $this->tryDoclingEndpoint($endpoint, $path, $timeoutSeconds);
            if ($result['ok']) {
                break;
            }

            if ($result['warning'] !== '') {
                $warnings[] = 'Docling endpoint failed: ' . $endpoint;
                $warnings[] = $result['warning'];
            }
        }

        if ($result['ok']) {
            return [
                'text' => $result['text'],
                'markdown' => $result['markdown'],
            ];
        }

        if ($result['warning'] !== '') {
            $warnings[] = $result['warning'];
        }

        return ['text' => '', 'markdown' => ''];
    }

    private function normalizeDoclingEndpoint(string $baseUrl): string
    {
        $parts = parse_url($baseUrl);
        $path = trim((string) ($parts['path'] ?? ''));
        if ($path === '' || $path === '/') {
            return $baseUrl . '/extract';
        }

        if (str_ends_with($path, '/extract')) {
            return $baseUrl;
        }

        return $baseUrl;
    }

    private function resolveDoclingEndpoints(string $baseUrl): array
    {
        $normalized = $this->normalizeDoclingEndpoint($baseUrl);
        $candidates = [$normalized];

        $parts = parse_url($normalized);
        $scheme = (string) ($parts['scheme'] ?? 'http');
        $host = (string) ($parts['host'] ?? '');
        $port = (int) ($parts['port'] ?? 8085);
        $path = (string) ($parts['path'] ?? '/extract');

        // Common aliases across Docker Compose, Portainer, and Swarm task DNS.
        $aliases = ['docling', 'cvscholar-docling', 'tasks.docling'];
        foreach ($aliases as $alias) {
            if ($host !== '' && strcasecmp($host, $alias) === 0) {
                continue;
            }
            $candidates[] = $scheme . '://' . $alias . ':' . $port . $path;
        }

        return array_values(array_unique($candidates));
    }

    private function tryDoclingEndpoint(string $url, string $path, int $timeoutSeconds = AI_CV_IMPORT_DOCLING_TIMEOUT): array
    {
        $ch = curl_init($url);
        $payload = [
            'file' => curl_file_create($path, 'application/pdf', basename($path)),
        ];

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => min(15, max(3, $timeoutSeconds)),
            CURLOPT_TIMEOUT => max(10, $timeoutSeconds),
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $curlError !== '') {
            return ['ok' => false, 'text' => '', 'warning' => 'Docling OCR request failed: ' . $curlError];
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'text' => '', 'warning' => 'Docling OCR returned HTTP ' . $httpCode . '.'];
        }

        $doclingData = $this->extractTextFromDoclingResponse((string) $response);
        if (($doclingData['text'] ?? '') === '') {
            $preview = mb_substr(trim((string) $response), 0, 180);
            return ['ok' => false, 'text' => '', 'warning' => 'Docling OCR returned no readable text from ' . $url . '. Response preview: ' . $preview];
        }

        return ['ok' => true, 'text' => $doclingData['text'] ?? '', 'markdown' => $doclingData['markdown'] ?? ($doclingData['text'] ?? ''), 'warning' => ''];
    }

    private function extractTextFromDoclingResponse(string $response): array
    {
        $decoded = json_decode($response, true);
        if (is_array($decoded)) {
            $candidates = [
                $decoded['text'] ?? null,
                $decoded['markdown'] ?? null,
                $decoded['content'] ?? null,
                $decoded['result']['text'] ?? null,
                $decoded['result']['markdown'] ?? null,
                $decoded['document']['text'] ?? null,
                $decoded['document']['markdown'] ?? null,
            ];

            $markdownCandidates = [
                $decoded['markdown'] ?? null,
                $decoded['result']['markdown'] ?? null,
                $decoded['document']['markdown'] ?? null,
            ];

            $markdown = '';
            foreach ($markdownCandidates as $candidate) {
                $value = $this->normalizeText((string) ($candidate ?? ''));
                if ($value !== '') {
                    $markdown = $value;
                    break;
                }
            }

            foreach ($candidates as $candidate) {
                $value = $this->normalizeText((string) ($candidate ?? ''));
                if ($value !== '') {
                    return [
                        'text' => $this->repairOcrText($value),
                        'markdown' => $markdown !== '' ? $markdown : $this->repairOcrText($value),
                    ];
                }
            }
        }

        return ['text' => '', 'markdown' => ''];
    }

    private function looksReadable(string $text): bool
    {
        $text = $this->normalizeText($text);
        if (mb_strlen($text) < self::OCR_TRIGGER_TEXT_LENGTH) {
            return false;
        }

        preg_match_all('/[A-Za-z]/', $text, $letters);
        preg_match_all('/\d/', $text, $digits);
        $signalChars = count($letters[0]) + count($digits[0]);
        return $signalChars >= 150;
    }

    private function normalizeSectionEntry(string $sectionKey, array $entry): array
    {
        $allowedFields = self::SECTION_FIELDS[$sectionKey] ?? [];
        $aliases = self::FIELD_ALIASES[$sectionKey] ?? [];
        $normalized = [];

        foreach ($allowedFields as $field) {
            $value = $this->cleanScalar($entry[$field] ?? null);
            if ($value !== '') {
                $normalized[$field] = $value;
            }
        }

        foreach ($aliases as $from => $to) {
            if (isset($normalized[$to])) {
                continue;
            }
            $value = $this->cleanScalar($entry[$from] ?? null);
            if ($value !== '') {
                $normalized[$to] = $value;
            }
        }

        if (in_array('year_start', $allowedFields, true) && !isset($normalized['year_start'])) {
            $year = $this->cleanScalar($entry['year'] ?? null);
            if ($year !== '') {
                $normalized['year_start'] = $year;
            }
        }

        if ($sectionKey === 'languages' && !isset($normalized['proficiency']) && isset($normalized['language'])) {
            $normalized['proficiency'] = 'Intermediate';
        }

        return $normalized;
    }

    private function cleanScalar(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return '';
        }

        $value = trim((string) $value);
        if (preg_match('/^(?:n\/a|na|none|null|not available|unknown|bio|profile|summary)$/i', $value)) {
            return '';
        }
        return $value === '' ? '' : mb_substr($value, 0, 2000);
    }

    private function validateDraft(array $draft): array
    {
        $personal = $draft['personal_info'] ?? [];

        if (!empty($personal['email']) && !$this->looksLikeEmail($personal['email'])) {
            unset($personal['email']);
        }

        if (!empty($personal['phone'])) {
            $normalizedPhone = $this->normalizePhone($personal['phone']);
            if ($normalizedPhone === '') {
                unset($personal['phone']);
            } else {
                $personal['phone'] = $normalizedPhone;
            }
        }

        if (!empty($personal['full_name'])) {
            $name = trim((string) $personal['full_name']);
            if (preg_match('/@|https?:\/\//i', $name) || preg_match('/\d{4}/', $name)) {
                unset($personal['full_name']);
            }
        }

        $draft['personal_info'] = $personal;

        $profileEntries = $draft['academic_profile'] ?? [];
        $validatedProfiles = [];
        foreach ($profileEntries as $entry) {
            $summary = trim((string) ($entry['summary'] ?? ''));
            if ($this->isMeaningfulSummary($summary)) {
                $validatedProfiles[] = ['summary' => $summary];
            }
        }
        $draft['academic_profile'] = $validatedProfiles;

        foreach (['education' => ['degree', 'institution'], 'experience' => ['position', 'organization']] as $section => $requiredHints) {
            $filtered = [];
            foreach (($draft[$section] ?? []) as $entry) {
                if (!is_array($entry)) continue;
                $e = array_filter($entry, static fn($v) => trim((string) $v) !== '');
                if (empty($e)) continue;

                $hasHint = false;
                foreach ($requiredHints as $key) {
                    if (!empty($e[$key]) && mb_strlen((string) $e[$key]) >= 3) {
                        $hasHint = true;
                        break;
                    }
                }

                if (!$hasHint) continue;
                $filtered[] = $e;
            }
            $draft[$section] = array_values($filtered);
        }

        return $draft;
    }

    private function looksLikeEmail(string $email): bool
    {
        return filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
    }

    private function normalizePhone(string $phone): string
    {
        $raw = trim($phone);
        if ($raw === '' || preg_match('/^\d{4}\s*[-–]\s*\d{4}$/', $raw)) {
            return '';
        }

        $hasPlus = str_starts_with($raw, '+');
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        $len = strlen($digits);
        if ($len < 9 || $len > 15) {
            return '';
        }

        return ($hasPlus ? '+' : '') . $digits;
    }

    private function extractLikelyPhone(string $text): string
    {
        if (!preg_match_all('/(?:\+?\d[\d\s().\-]{7,}\d)/', $text, $matches)) {
            return '';
        }

        foreach (($matches[0] ?? []) as $candidate) {
            $phone = $this->normalizePhone((string) $candidate);
            if ($phone !== '') {
                return $phone;
            }
        }

        return '';
    }

    private function isMeaningfulSummary(string $summary): bool
    {
        $summary = trim($summary);
        if ($summary === '') return false;
        if (preg_match('/^(bio|profile|summary|about)$/i', $summary)) return false;
        if (mb_strlen($summary) < 40) return false;
        $wordCount = preg_match_all('/\b[\p{L}\p{N}][\p{L}\p{N}\-]*\b/u', $summary);
        return (int) $wordCount >= 8;
    }

    private function resolveOcrLanguage(): string
    {
        $lang = trim((string) getenv('AI_CV_IMPORT_OCR_LANG'));
        return $lang !== '' ? $lang : 'eng';
    }

    private function repairOcrText(string $text): string
    {
        $text = preg_replace('/([A-Z0-9._%+\-]+)\s*@\s*([A-Z0-9.\-]+\.[A-Z]{2,})/i', '$1@$2', $text) ?? $text;
        $text = preg_replace('/\b(19|20)\d{2}\s*[|]\s*(19|20)\d{2}\b/', '$0', $text) ?? $text;
        return $text;
    }

    private function mergePersonalInfo(array $local, array $ai): array
    {
        $merged = $local;
        foreach (self::PERSONAL_INFO_KEYS as $key) {
            $localValue = trim((string) ($local[$key] ?? ''));
            $aiValue = trim((string) ($ai[$key] ?? ''));
            if ($aiValue === '') {
                continue;
            }
            if ($localValue === '' || mb_strlen($aiValue) > mb_strlen($localValue)) {
                $merged[$key] = $aiValue;
            }
        }
        return array_filter($merged, static fn($value) => trim((string) $value) !== '');
    }

    private function pickBetterSectionEntries(array $local, array $ai): array
    {
        return $this->sectionScore($ai) >= $this->sectionScore($local) ? $ai : $local;
    }

    private function sectionScore(array $entries): int
    {
        $score = 0;
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $filled = 0;
            foreach ($entry as $value) {
                if (trim((string) $value) !== '') {
                    $filled++;
                }
            }
            $score += ($filled * 3) + 2;
        }
        return $score;
    }

    private function hasStructuredDraftContent(array $draft): bool
    {
        if (!empty($draft['personal_info'])) {
            return true;
        }

        foreach (self::SECTION_KEYS as $sectionKey) {
            if (!empty($draft[$sectionKey])) {
                return true;
            }
        }

        return false;
    }

    private function draftStats(array $draft): array
    {
        $stats = [
            'personal_info_fields' => count($draft['personal_info'] ?? []),
        ];

        foreach (self::SECTION_KEYS as $sectionKey) {
            $stats[$sectionKey] = is_array($draft[$sectionKey] ?? null) ? count($draft[$sectionKey]) : 0;
        }

        return $stats;
    }

    private function alignDraftToProfileSchema(int $profileId, array $draft): array
    {
        $profile = (new CVProfile())->findById($profileId);
        $templateId = (int) ($profile['template_id'] ?? 0);
        if ($templateId <= 0) {
            return $draft;
        }

        $allowedBySection = [];
        foreach ((new Template())->getSections($templateId) as $section) {
            $sectionKey = (string) ($section['section_key'] ?? '');
            $fieldsSchema = is_array($section['fields_schema'] ?? null) ? $section['fields_schema'] : [];
            $allowedBySection[$sectionKey] = array_values(array_filter(array_map(
                static fn($field) => is_array($field) ? (string) ($field['name'] ?? '') : '',
                $fieldsSchema
            )));
        }

        foreach (self::SECTION_KEYS as $sectionKey) {
            $allowedFields = $allowedBySection[$sectionKey] ?? [];
            if (empty($allowedFields) || empty($draft[$sectionKey]) || !is_array($draft[$sectionKey])) {
                continue;
            }

            $filteredEntries = [];
            foreach ($draft[$sectionKey] as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $filtered = [];
                foreach ($allowedFields as $field) {
                    $value = $this->cleanScalar($entry[$field] ?? null);
                    if ($value !== '') {
                        $filtered[$field] = $value;
                    }
                }
                if (!empty($filtered)) {
                    $filteredEntries[] = $filtered;
                }
            }
            $draft[$sectionKey] = $filteredEntries;
        }

        return $draft;
    }
}
