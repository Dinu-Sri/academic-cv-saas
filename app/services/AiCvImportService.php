<?php
/**
 * AI-assisted CV PDF import service.
 *
 * Production design: render CV PDF pages, use OpenAI only for visual text/fact
 * extraction, then use DeepSeek for reasoning and structured CV mapping.
 */
class AiCvImportService
{
    public function importUploadedPdf(array $file, int $userId, array $options = []): array
    {
        $path = $this->storeTemporaryPdf($file, $userId);

        return $this->importStoredPdf($path, $options);
    }

    public function importStoredPdf(string $path, array $options = []): array
    {
        try {
            return $this->importPdfWithOpenAiVision($path);
        } finally {
            @unlink($path);
        }
    }

    public function applyDraftToCv(int $userId, array $draft, array $options = []): array
    {
        $mergeStrategy = (string) ($options['merge_strategy'] ?? 'fill_missing_add_new');
        if (!in_array($mergeStrategy, ['fill_missing_add_new', 'replace_selected_sections'], true)) {
            $mergeStrategy = 'fill_missing_add_new';
        }

        $draft = $this->sanitizeDraft($draft);
        $profileId = $this->ensureCvProfile($userId, $draft['personal_info'] ?? [], [
            'force_new' => !empty($options['force_new']),
            'template_id' => isset($options['force_template_id']) ? (int) $options['force_template_id'] : null,
            'name' => $options['name'] ?? null,
        ]);
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
        $savedToMaster = [];
        $locked = [];
        $replaced = [];
        $dedupeFields = $this->dedupeFields();
        $supportedByTemplate = $this->profileTemplateSectionFields($profileId);

        $importService = new ProfileImportService();

        foreach ($this->schemaService()->getSectionKeys(false) as $sectionKey) {
            $entries = $draft[$sectionKey] ?? [];
            if (!is_array($entries) || empty($entries)) continue;

            $dedupeField = $dedupeFields[$sectionKey] ?? $this->firstFieldForSection($sectionKey);
            $savedToMaster[$sectionKey] = $importService->addEntriesToUserMasterData(
                $userId,
                $sectionKey,
                $entries,
                $dedupeField
            );

            if (!isset($supportedByTemplate[$sectionKey])) {
                $locked[$sectionKey] = [
                    'count' => count($entries),
                    'reason' => 'not_in_current_template',
                ];
                continue;
            }

            $visibleEntries = $this->filterEntriesToFields($entries, $supportedByTemplate[$sectionKey]);
            if (empty($visibleEntries)) {
                $locked[$sectionKey] = [
                    'count' => count($entries),
                    'reason' => 'no_current_template_fields_matched',
                ];
                continue;
            }

            if ($mergeStrategy === 'replace_selected_sections') {
                $replaced[$sectionKey] = $importService->clearSectionEntriesForLatestProfile($userId, $sectionKey);
            }

            $added[$sectionKey] = $importService->addEntriesToCvSection(
                $userId,
                $sectionKey,
                $visibleEntries,
                $dedupeField
            );
        }

        return [
            'success' => true,
            'profile_id' => $profileId,
            'edit_url' => APP_URL . '/cv/edit/' . $profileId,
            'added' => $added,
            'saved_to_master' => $savedToMaster,
            'locked_sections' => $locked,
            'replaced' => $replaced,
            'merge_strategy' => $mergeStrategy,
            'message' => 'Imported CV draft was applied. Sections not supported by the current template were saved to your profile data.',
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

    private function shouldUseOpenAi(): bool
    {
        return AI_CV_IMPORT_USE_OPENAI && OPENAI_API_KEY !== '';
    }

    private function shouldUseDeepSeek(): bool
    {
        return DEEPSEEK_API_KEY !== '';
    }

    private function importPdfWithOpenAiVision(string $path): array
    {
        if (!$this->shouldUseOpenAi() || !$this->shouldUseDeepSeek()) {
            return [
                'success' => false,
                'error' => 'CV import requires AI_CV_IMPORT_USE_OPENAI=true, OPENAI_API_KEY, and DEEPSEEK_API_KEY.',
                'provider' => 'openai_extract_deepseek_map',
                'extraction_method' => 'openai_vision_deepseek_mapping',
                'extraction_mode' => 'openai_extract_deepseek_map',
                'ai_status' => 'disabled',
                'warnings' => [],
            ];
        }

        $startedAt = microtime(true);
        $warnings = [];
        $images = $this->renderPdfPagesForOpenAi($path, $warnings);
        if (empty($images)) {
            return [
                'success' => false,
                'error' => 'Could not render PDF pages for OpenAI full extraction.',
                'provider' => 'openai_full_pdf',
                'extraction_method' => 'openai_vision',
                'extraction_mode' => 'openai_full',
                'ai_status' => 'failed',
                'warnings' => $warnings,
            ];
        }

        $content = [[
            'type' => 'text',
            'text' => "Extract only visible academic CV content from these page images. Return JSON only with keys: extractedText, facts, warnings. Preserve original wording, section headings, dates, names, institutions, publication titles, authors, links, and any visible identifiers. Do not rewrite, evaluate, infer missing facts, categorize deeply, or map to app fields.",
        ]];

        foreach ($images as $image) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => 'data:image/jpeg;base64,' . base64_encode((string) file_get_contents($image)),
                    'detail' => 'high',
                ],
            ];
        }

        $payload = [
            'model' => OPENAI_CV_IMPORT_VISION_MODEL,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You extract visible text and facts from academic CV page images. Return only valid JSON. Do not hallucinate missing information.',
                ],
                [
                    'role' => 'user',
                    'content' => $content,
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
            CURLOPT_TIMEOUT => max(300, AI_CV_IMPORT_API_TIMEOUT),
        ]);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $durationSeconds = round(microtime(true) - $startedAt, 2);
        foreach ($images as $image) {
            @unlink($image);
        }
        @rmdir(dirname($images[0] ?? $path));

        if ($response === false || $httpCode < 200 || $httpCode >= 300) {
            error_log('AiCvImportService OpenAI full PDF error: HTTP ' . $httpCode . ' ' . substr((string) $response, 0, 500));
            return [
                'success' => false,
                'error' => $curlError !== '' ? $curlError : ('OpenAI full-PDF request failed with HTTP ' . $httpCode),
                'provider' => 'openai_full_pdf',
                'extraction_method' => 'openai_vision',
                'extraction_mode' => 'openai_full',
                'ai_status' => 'failed',
                'http_code' => $httpCode,
                'openai_model' => OPENAI_CV_IMPORT_VISION_MODEL,
                'openai_duration_seconds' => $durationSeconds,
                'image_pages_sent' => count($images),
                'warnings' => $warnings,
            ];
        }

        $decoded = json_decode((string) $response, true);
        $contentText = $decoded['choices'][0]['message']['content'] ?? '';
        $extraction = json_decode((string) $contentText, true);
        if (!is_array($extraction)) {
            return [
                'success' => false,
                'error' => 'OpenAI extraction returned non-JSON content.',
                'provider' => 'openai_extract_deepseek_map',
                'extraction_method' => 'openai_vision_deepseek_mapping',
                'extraction_mode' => 'openai_extract_deepseek_map',
                'ai_status' => 'failed',
                'http_code' => $httpCode,
                'openai_model' => OPENAI_CV_IMPORT_VISION_MODEL,
                'openai_duration_seconds' => $durationSeconds,
                'openai_usage' => $decoded['usage'] ?? null,
                'image_pages_sent' => count($images),
                'warnings' => $warnings,
            ];
        }

        $draft = $this->requestCvDraftFromDeepSeek($extraction);
        if (!is_array($draft)) {
            return [
                'success' => false,
                'error' => 'DeepSeek mapping returned non-JSON content.',
                'provider' => 'openai_extract_deepseek_map',
                'extraction_method' => 'openai_vision_deepseek_mapping',
                'extraction_mode' => 'openai_extract_deepseek_map',
                'ai_status' => 'failed',
                'http_code' => $httpCode,
                'openai_model' => OPENAI_CV_IMPORT_VISION_MODEL,
                'deepseek_model' => DEEPSEEK_MODEL,
                'openai_duration_seconds' => $durationSeconds,
                'openai_usage' => $decoded['usage'] ?? null,
                'image_pages_sent' => count($images),
                'warnings' => $warnings,
            ];
        }

        $draft = $this->sanitizeDraft($draft);
        if (!$this->hasStructuredDraftContent($draft)) {
            return [
                'success' => false,
                'error' => 'DeepSeek mapping returned JSON, but it did not contain enough structured CV data to trust.',
                'provider' => 'openai_extract_deepseek_map',
                'extraction_method' => 'openai_vision_deepseek_mapping',
                'extraction_mode' => 'openai_extract_deepseek_map',
                'ai_status' => 'failed',
                'http_code' => $httpCode,
                'openai_model' => OPENAI_CV_IMPORT_VISION_MODEL,
                'deepseek_model' => DEEPSEEK_MODEL,
                'openai_duration_seconds' => $durationSeconds,
                'openai_usage' => $decoded['usage'] ?? null,
                'image_pages_sent' => count($images),
                'warnings' => $warnings,
            ];
        }

        $warnings[] = 'OpenAI extracted visible PDF/page content; DeepSeek mapped the extracted text into a reviewable CV draft.';
        return [
            'success' => true,
            'provider' => 'openai_extract_deepseek_map',
            'extraction_method' => 'openai_vision_deepseek_mapping',
            'extraction_mode' => 'openai_extract_deepseek_map',
            'ai_status' => 'enabled',
            'ai_error' => null,
            'text_chars_sent' => 0,
            'text_chars_extracted' => 0,
            'draft' => $draft,
            'draft_stats' => $this->draftStats($draft),
            'warnings' => $warnings,
            'http_code' => $httpCode,
            'openai_model' => OPENAI_CV_IMPORT_VISION_MODEL,
            'deepseek_model' => DEEPSEEK_MODEL,
            'deepseek_reasoning_effort' => DEEPSEEK_REASONING_EFFORT,
            'openai_duration_seconds' => $durationSeconds,
            'openai_usage' => $decoded['usage'] ?? null,
            'image_pages_sent' => count($images),
        ];
    }

    private function renderPdfPagesForOpenAi(string $path, array &$warnings): array
    {
        $pdftoppm = $this->findCommand('pdftoppm');
        if ($pdftoppm === '') {
            $warnings[] = 'pdftoppm is not installed, so OpenAI full-PDF mode could not render page images.';
            return [];
        }

        $pageLimit = max(1, min(20, AI_CV_IMPORT_OPENAI_FULL_PAGE_LIMIT));
        $tempDir = UPLOAD_DIR . '/ai_cv_imports/openai-full-' . bin2hex(random_bytes(8));
        if (!@mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
            $warnings[] = 'OpenAI full-PDF mode could not create a temporary working directory.';
            return [];
        }

        $prefix = $tempDir . '/page';
        $cmd = escapeshellcmd($pdftoppm) . ' -f 1 -l ' . (int) $pageLimit . ' -r 120 -jpeg ' . escapeshellarg($path) . ' ' . escapeshellarg($prefix) . ' 2>/dev/null';
        shell_exec($cmd);

        $images = glob($prefix . '-*.jpg') ?: [];
        sort($images, SORT_NATURAL);
        if (empty($images)) {
            @rmdir($tempDir);
            $warnings[] = 'OpenAI full-PDF mode rendered no page images.';
        }

        return $images;
    }

    private function requestCvDraftFromDeepSeek(array $extraction): array
    {
        $prompt = [
            'extraction' => $extraction,
            'required_shape' => $this->schemaDescription(),
            'canonical_section_registry' => $this->schemaPromptContext(),
            'rules' => [
                'Use only the provided extracted content.',
                'Never invent facts.',
                'Preserve every detected CV section, including patents, grants, invited talks, supervision, academic service, editorial work, research experience, academic appointments, conferences, languages, memberships, and declaration sections.',
                'Do not discard a section because it may be premium, locked, or absent from a free template.',
                'Preserve separate education, employment, appointment, teaching, publication, patent, grant, award, skill, language, membership, project, and reference entries.',
                'Read multi-column layouts in the natural human order.',
                'Keep date ranges attached to the correct entry.',
                'Leave unclear fields empty.',
                'Do not put date ranges into phone numbers.',
                'Map school, high-school, A-Level, certificate, diploma, and non-degree education records into education using institution, qualification, education_level, field_of_study, years, and description as applicable.',
                'Preserve LinkedIn, ORCID, website, and Google Scholar profile links in personal_info when visible.',
                'Publication entries should preserve title/authors/year/venue/doi when visible.',
                'Patent entries should preserve title/inventors/patent number/jurisdiction/status/year/url when visible.',
                'Academic profile summary must be meaningful prose, not a section label.',
                'Put relevant content in unmapped_items only when no canonical section fits.',
            ],
        ];

        return $this->requestDeepSeekJson([
            [
                'role' => 'system',
                'content' => 'You map extracted academic CV content into strict JSON for an academic CV editor. Return only valid JSON. Do not hallucinate missing information.',
            ],
            [
                'role' => 'user',
                'content' => json_encode($prompt),
            ],
        ]);
    }

    private function requestDeepSeekJson(array $messages): array
    {
        $payload = [
            'model' => DEEPSEEK_MODEL,
            'response_format' => ['type' => 'json_object'],
            'thinking' => ['type' => 'enabled'],
            'reasoning_effort' => DEEPSEEK_REASONING_EFFORT,
            'stream' => false,
            'messages' => $messages,
        ];

        $ch = curl_init(DEEPSEEK_BASE_URL . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . DEEPSEEK_API_KEY,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(30, AI_CV_IMPORT_API_TIMEOUT),
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode < 200 || $httpCode >= 300) {
            error_log('AiCvImportService DeepSeek error: HTTP ' . $httpCode . ' ' . substr((string) $response, 0, 500));
            return [];
        }

        $decoded = json_decode((string) $response, true);
        $content = trim((string) ($decoded['choices'][0]['message']['content'] ?? ''));
        $parsed = json_decode($content, true);
        return is_array($parsed) ? $parsed : [];
    }

    private function ensureCvProfile(int $userId, array $personalInfo, array $options = []): int
    {
        $cvModel = new CVProfile();
        $forceNew = !empty($options['force_new']);

        if (!$forceNew) {
            $profiles = $cvModel->findByUser($userId);
            if (!empty($profiles)) {
                return (int) $profiles[0]['id'];
            }
        }

        $templateId = !empty($options['template_id'])
            ? (int) $options['template_id']
            : $this->firstAvailableTemplateId($userId);
        $profileId = $cvModel->create([
            'user_id' => $userId,
            'template_id' => $templateId,
            'name' => (string) ($options['name'] ?? 'Imported CV Draft'),
            'personal_info' => $personalInfo,
        ]);
        $this->createDefaultSections($profileId, $templateId);
        return $profileId;
    }

    /**
     * Generate a short professional/academic profile summary from supplied
     * details using OpenAI. Invents nothing; falls back to a safe templated
     * sentence when AI is unavailable or returns nothing usable.
     *
     * @param array $details e.g. ['full_name'=>..,'title'=>..,'affiliation'=>..,'field'=>..,'goal'=>..]
     */
    public function generateProfileSummary(array $details): string
    {
        $clean = [];
        foreach (['full_name', 'title', 'affiliation', 'field', 'goal'] as $key) {
            $value = trim((string) ($details[$key] ?? ''));
            if ($value !== '') {
                $clean[$key] = mb_substr($value, 0, 300);
            }
        }

        if ($this->shouldUseDeepSeek() && !empty($clean)) {
            $ai = $this->requestProfileSummaryFromDeepSeek($clean);
            if ($ai !== '') {
                return $ai;
            }
        }

        return $this->fallbackProfileSummary($clean);
    }

    private function requestProfileSummaryFromDeepSeek(array $details): string
    {
        $facts = [];
        foreach ($details as $key => $value) {
            $facts[] = ucfirst(str_replace('_', ' ', $key)) . ': ' . $value;
        }
        $factsText = implode("\n", $facts);

        $parsed = $this->requestDeepSeekJson([
            [
                'role' => 'system',
                'content' => 'You write concise CV profile summaries for an academic CV builder. Use ONLY the facts provided. Never invent degrees, employers, achievements, metrics, or dates that are not given. Return JSON only: {"summary":"..."}.',
            ],
            [
                'role' => 'user',
                'content' => "Write a 2 to 3 sentence third-person professional academic summary using only these facts:\n" . $factsText,
            ],
        ]);

        $text = trim((string) ($parsed['summary'] ?? ''));
        if ($text === '') {
            return '';
        }

        return mb_substr($text, 0, 800);
    }

    private function fallbackProfileSummary(array $details): string
    {
        $name = $details['full_name'] ?? '';
        $title = $details['title'] ?? '';
        $affiliation = $details['affiliation'] ?? '';

        $parts = [];
        if ($title !== '' && $affiliation !== '') {
            $parts[] = ($name !== '' ? $name : 'A motivated professional') . ' is a ' . $title . ' at ' . $affiliation . '.';
        } elseif ($title !== '') {
            $parts[] = ($name !== '' ? $name : 'A motivated professional') . ' is a ' . $title . '.';
        } elseif ($affiliation !== '') {
            $parts[] = ($name !== '' ? $name : 'A motivated professional') . ' is affiliated with ' . $affiliation . '.';
        }
        $parts[] = 'This profile is being prepared with CVScholar. Further details can be completed on a laptop.';

        return trim(implode(' ', $parts));
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
        if (isset($draft['sections']) && is_array($draft['sections'])) {
            foreach ($draft['sections'] as $sectionKey => $entries) {
                if (!isset($draft[$sectionKey])) {
                    $draft[$sectionKey] = $entries;
                }
            }
        }

        $schema = $this->schemaService();
        $clean = ['personal_info' => []];
        foreach ($schema->getFieldNames('personal_info') as $key) {
            $value = trim((string) ($draft['personal_info'][$key] ?? ''));
            if ($value !== '') $clean['personal_info'][$key] = mb_substr($value, 0, 500);
        }

        foreach ($schema->getFieldAliases('personal_info') as $from => $to) {
            if (!empty($clean['personal_info'][$to])) {
                continue;
            }
            $value = trim((string) ($draft['personal_info'][$from] ?? ''));
            if ($value !== '') {
                $clean['personal_info'][$to] = mb_substr($value, 0, 500);
            }
        }

        foreach ($schema->getSectionKeys(false) as $sectionKey) {
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

        $clean['unmapped_items'] = [];
        foreach (array_slice(is_array($draft['unmapped_items'] ?? null) ? $draft['unmapped_items'] : [], 0, 20) as $entry) {
            if (!is_array($entry)) continue;
            $row = [];
            foreach (['heading', 'content', 'reason'] as $field) {
                $value = $this->cleanScalar($entry[$field] ?? null);
                if ($value !== '') $row[$field] = $value;
            }
            if (!empty($row)) $clean['unmapped_items'][] = $row;
        }

        $clean['mapping_warnings'] = [];
        foreach (array_slice(is_array($draft['mapping_warnings'] ?? null) ? $draft['mapping_warnings'] : [], 0, 20) as $warning) {
            $value = $this->cleanScalar($warning);
            if ($value !== '') $clean['mapping_warnings'][] = $value;
        }
        return $this->validateDraft($clean);
    }

    private function schemaDescription(): string
    {
        return json_encode($this->schemaService()->getJsonShape(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function schemaPromptContext(): string
    {
        return json_encode($this->schemaService()->getPromptContract(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function findCommand(string $command): string
    {
        return trim((string) shell_exec('command -v ' . escapeshellarg($command) . ' 2>/dev/null'));
    }

    private function normalizeSectionEntry(string $sectionKey, array $entry): array
    {
        $schema = $this->schemaService();
        $allowedFields = $schema->getFieldNames($sectionKey);
        $aliases = $schema->getFieldAliases($sectionKey);
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

    private function isMeaningfulSummary(string $summary): bool
    {
        $summary = trim($summary);
        if ($summary === '') return false;
        if (preg_match('/^(bio|profile|summary|about)$/i', $summary)) return false;
        if (mb_strlen($summary) < 40) return false;
        $wordCount = preg_match_all('/\b[\p{L}\p{N}][\p{L}\p{N}\-]*\b/u', $summary);
        return (int) $wordCount >= 8;
    }

    private function hasStructuredDraftContent(array $draft): bool
    {
        if (!empty($draft['personal_info'])) {
            return true;
        }

        foreach ($this->schemaService()->getSectionKeys(false) as $sectionKey) {
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

        foreach ($this->schemaService()->getSectionKeys(false) as $sectionKey) {
            $stats[$sectionKey] = is_array($draft[$sectionKey] ?? null) ? count($draft[$sectionKey]) : 0;
        }
        $stats['unmapped_items'] = is_array($draft['unmapped_items'] ?? null) ? count($draft['unmapped_items']) : 0;
        $stats['mapping_warnings'] = is_array($draft['mapping_warnings'] ?? null) ? count($draft['mapping_warnings']) : 0;

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

        foreach ($this->schemaService()->getSectionKeys(false) as $sectionKey) {
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

    private function schemaService(): CvSectionSchemaService
    {
        static $service = null;
        if (!$service instanceof CvSectionSchemaService) {
            $service = new CvSectionSchemaService();
        }
        return $service;
    }

    private function dedupeFields(): array
    {
        return [
            'academic_profile' => 'summary',
            'education' => 'institution',
            'experience' => 'organization',
            'academic_appointments' => 'institution',
            'research_experience' => 'institution',
            'research_interests' => 'area',
            'publications' => 'title',
            'grants' => 'title',
            'patents' => 'patent_number',
            'invited_talks' => 'title',
            'conferences' => 'title',
            'projects' => 'title',
            'awards' => 'title',
            'teaching' => 'course',
            'supervision' => 'student_name',
            'academic_service' => 'role',
            'editorial' => 'journal',
            'certifications' => 'title',
            'skills' => 'category',
            'languages' => 'language',
            'professional_memberships' => 'organization',
            'references' => 'name',
            'declaration' => 'statement',
        ];
    }

    private function firstFieldForSection(string $sectionKey): string
    {
        $fields = $this->schemaService()->getFieldNames($sectionKey);
        return $fields[0] ?? 'title';
    }

    private function profileTemplateSectionFields(int $profileId): array
    {
        $profile = (new CVProfile())->findById($profileId);
        $templateId = (int) ($profile['template_id'] ?? 0);
        if ($templateId <= 0) {
            return [];
        }

        $sections = [];
        foreach ((new Template())->getSections($templateId) as $section) {
            $sectionKey = (string) ($section['section_key'] ?? '');
            if ($sectionKey === '' || $sectionKey === 'personal_info') {
                continue;
            }

            $fieldsSchema = is_array($section['fields_schema'] ?? null) ? $section['fields_schema'] : [];
            $fields = array_values(array_filter(array_map(
                static fn($field) => is_array($field) ? (string) ($field['name'] ?? '') : '',
                $fieldsSchema
            )));
            if (!empty($fields)) {
                $sections[$sectionKey] = $fields;
            }
        }

        return $sections;
    }

    private function filterEntriesToFields(array $entries, array $allowedFields): array
    {
        $filteredEntries = [];
        foreach ($entries as $entry) {
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
        return $filteredEntries;
    }

    private function sectionAllowedForPlan(string $plan, string $sectionKey): bool
    {
        return true;
    }
}
