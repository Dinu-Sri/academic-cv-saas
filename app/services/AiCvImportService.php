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

    public function importUploadedPdf(array $file, int $userId): array
    {
        $path = $this->storeTemporaryPdf($file, $userId);

        try {
            $text = $this->extractTextFromPdf($path);
        } finally {
            @unlink($path);
        }

        return $this->importFromText($text);
    }

    public function importFromText(string $text): array
    {
        $text = $this->normalizeText($text);
        if (mb_strlen($text) < 80) {
            return [
                'success' => false,
                'error' => 'Could not extract enough readable text from this PDF. Please try a text-based PDF or paste the CV text.',
            ];
        }

        $cappedText = $this->capText($text);
        $localDraft = $this->buildLocalDraft($cappedText);
        $provider = 'local_extraction';
        $warnings = [];

        if ($this->shouldUseOpenAi()) {
            $aiDraft = $this->buildAiDraft($cappedText, $localDraft);
            if ($aiDraft !== null) {
                $localDraft = $this->mergeDrafts($localDraft, $aiDraft);
                $provider = 'openai_refined';
            } else {
                $warnings[] = 'AI refinement was unavailable, so a local low-cost draft was prepared instead.';
            }
        }

        return [
            'success' => true,
            'provider' => $provider,
            'text_chars_sent' => mb_strlen($cappedText),
            'text_chars_extracted' => mb_strlen($text),
            'draft' => $this->sanitizeDraft($localDraft),
            'warnings' => $warnings,
        ];
    }

    public function applyDraftToCv(int $userId, array $draft): array
    {
        $draft = $this->sanitizeDraft($draft);
        $profileId = $this->ensureCvProfile($userId, $draft['personal_info'] ?? []);

        $profileModel = new CVProfile();
        if (!empty($draft['personal_info'])) {
            $profile = $profileModel->findById($profileId);
            $personalInfo = is_array($profile['personal_info'] ?? null) ? $profile['personal_info'] : [];
            foreach ($draft['personal_info'] as $key => $value) {
                if (trim((string) $value) !== '') {
                    $personalInfo[$key] = trim((string) $value);
                }
            }
            $profileModel->update($profileId, ['personal_info' => $personalInfo]);

            $userUpdates = [];
            foreach (['full_name', 'title', 'affiliation'] as $field) {
                if (!empty($draft['personal_info'][$field])) {
                    $userUpdates[$field] = $draft['personal_info'][$field];
                }
            }
            if (!empty($draft['personal_info']['orcid'])) {
                $userUpdates['orcid_id'] = $draft['personal_info']['orcid'];
            }
            $userUpdates['personal_info'] = json_encode($personalInfo);
            (new User())->update($userId, $userUpdates);
        }

        $added = [];
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

        foreach (self::SECTION_KEYS as $sectionKey) {
            $entries = $draft[$sectionKey] ?? [];
            if (!is_array($entries) || empty($entries)) continue;
            $added[$sectionKey] = (new ProfileImportService())->addEntriesToCvSection(
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
            'message' => 'Imported CV draft was added. Please review the sections before compiling.',
        ];
    }

    private function storeTemporaryPdf(array $file, int $userId): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Please upload a valid PDF file.');
        }

        $maxBytes = AI_CV_IMPORT_MAX_UPLOAD_MB * 1024 * 1024;
        if ((int) ($file['size'] ?? 0) > $maxBytes) {
            throw new RuntimeException('PDF is too large. Maximum size is ' . AI_CV_IMPORT_MAX_UPLOAD_MB . ' MB.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $originalName = (string) ($file['name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
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
            @mkdir($dir, 0775, true);
        }

        $path = $dir . '/user-' . $userId . '-' . bin2hex(random_bytes(8)) . '.pdf';
        if (!move_uploaded_file($tmpName, $path)) {
            throw new RuntimeException('Could not save uploaded PDF. Please try again.');
        }

        return $path;
    }

    private function extractTextFromPdf(string $path): string
    {
        $pdftotext = trim((string) shell_exec('command -v pdftotext 2>/dev/null'));
        if ($pdftotext === '') {
            throw new RuntimeException('PDF text extraction is not installed on the server. Install poppler-utils in the PHP container to enable low-cost PDF import.');
        }

        $cmd = escapeshellcmd($pdftotext) . ' -layout -enc UTF-8 ' . escapeshellarg($path) . ' - 2>/dev/null';
        $text = (string) shell_exec($cmd);
        return $this->normalizeText($text);
    }

    private function shouldUseOpenAi(): bool
    {
        return AI_CV_IMPORT_USE_OPENAI && OPENAI_API_KEY !== '';
    }

    private function buildAiDraft(string $text, array $localDraft): ?array
    {
        $schemaDescription = $this->schemaDescription();
        $payload = [
            'model' => OPENAI_CV_IMPORT_MODEL,
            'temperature' => 0.1,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You extract academic CV data into strict JSON. Return only valid JSON. Do not invent missing details. Keep original wording short and factual.',
                ],
                [
                    'role' => 'user',
                    'content' => "Extract this CV into the JSON shape below. Empty fields should be empty strings or empty arrays.\n\nJSON shape:\n" . $schemaDescription . "\n\nLocal draft from regex extraction (you may improve it):\n" . json_encode($localDraft) . "\n\nCV text:\n" . $text,
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
            CURLOPT_TIMEOUT => AI_CV_IMPORT_API_TIMEOUT,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode < 200 || $httpCode >= 300) {
            error_log('AiCvImportService OpenAI error: HTTP ' . $httpCode . ' ' . substr((string) $response, 0, 500));
            return null;
        }

        $decoded = json_decode((string) $response, true);
        $content = $decoded['choices'][0]['message']['content'] ?? '';
        $draft = json_decode((string) $content, true);
        return is_array($draft) ? $draft : null;
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

        $phone = '';
        if (preg_match('/(?:\+?\d[\d\s().\-]{7,}\d)/', $text, $m)) $phone = trim($m[0]);

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
        $lines = $this->sectionLines($sections, ['profile', 'summary', 'academic profile', 'professional summary']);
        $summary = trim(implode(' ', array_slice($lines, 0, 5)));
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
        $allowedPersonal = ['full_name', 'title', 'affiliation', 'email', 'phone', 'location', 'website', 'linkedin', 'orcid', 'google_scholar'];
        foreach ($allowedPersonal as $key) {
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
                $row = [];
                foreach ($entry as $field => $value) {
                    if (!is_string($field) || is_array($value) || is_object($value)) continue;
                    $value = trim((string) $value);
                    if ($value !== '') $row[$field] = mb_substr($value, 0, 2000);
                }
                if (!empty($row)) $clean[$sectionKey][] = $row;
            }
        }
        return $clean;
    }

    private function mergeDrafts(array $localDraft, array $aiDraft): array
    {
        $aiDraft = $this->sanitizeDraft($aiDraft);
        foreach ($aiDraft as $key => $value) {
            if ($key === 'personal_info') {
                $localDraft[$key] = array_merge($localDraft[$key] ?? [], $value);
            } elseif (is_array($value) && !empty($value)) {
                $localDraft[$key] = $value;
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

    private function capText(string $text): string
    {
        return mb_substr($text, 0, AI_CV_IMPORT_TEXT_CHAR_LIMIT);
    }

    private function normalizeText(string $text): string
    {
        $text = str_replace("\0", '', $text);
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\R{3,}/', "\n\n", $text) ?? $text;
        return trim($text);
    }

    private function cleanLine(string $line): string
    {
        return trim(preg_replace('/\s+/', ' ', $line) ?? $line);
    }
}
