<?php
/**
 * CV Controller
 */
class CVController
{
    private CVProfile $cvModel;
    private Template $templateModel;

    public function __construct()
    {
        $this->cvModel = new CVProfile();
        $this->templateModel = new Template();
    }

    public function create(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        // Show ALL templates; premium ones display with a lock overlay for free users
        $templates = $this->templateModel->getAll(true);


        // Check CV limit
        $userModel = new User();
        $cvCount = $userModel->countCVs($user['id']);
        $maxCvs = $user['subscription_plan'] === 'free' ? PLAN_FREE_MAX_CVS : PLAN_PRO_MAX_CVS;

        if ($cvCount >= $maxCvs) {
            $_SESSION['flash_error'] = "You've reached the maximum number of CVs for your plan. Upgrade to create more.";
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        include TEMPLATE_PATH . '/cv/create.php';
    }

    public function store(): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $user = Auth::user();
        $templateId = (int) ($_POST['template_id'] ?? 0);
        $name = trim($_POST['name'] ?? 'My CV');

        // Verify template exists and user has access
        $template = $this->templateModel->findById($templateId);
        if (!$template) {
            $_SESSION['flash_error'] = 'Invalid template selected.';
            header('Location: ' . APP_URL . '/cv/create');
            exit;
        }

        $allowedTemplates = $this->templateModel->getAvailableForUser($user['subscription_plan']);
        $allowedIds = array_column($allowedTemplates, 'id');
        if (!in_array($templateId, $allowedIds)) {
            $_SESSION['flash_error'] = 'This template requires a Pro plan. Please upgrade.';
            header('Location: ' . APP_URL . '/plans');
            exit;
        }

        // Get user's master personal info
        $userModel = new User();
        $fullUser = $userModel->findById($user['id']);
        $masterPersonalInfo = $fullUser['personal_info'] ? json_decode($fullUser['personal_info'], true) : [];

        $profileId = $this->cvModel->create([
            'user_id'       => $user['id'],
            'template_id'   => $templateId,
            'name'          => $name,
            'personal_info' => $masterPersonalInfo,
        ]);

        // Create default sections from template
        $this->createDefaultSections($profileId, $templateId);

        // Pre-fill sections with user's master entries
        $this->cvModel->populateFromMasterData($profileId, $user['id']);

        EventLogger::log('cv_created', [
            'profile_id' => $profileId,
            'template_id' => $templateId,
        ]);

        $_SESSION['flash_success'] = 'CV created! Start editing below.';
        header('Location: ' . APP_URL . '/cv/edit/' . $profileId);
        exit;
    }

    public function edit(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $_SESSION['flash_error'] = 'CV not found.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $profile = $this->cvModel->findById($id);
        $sections = $this->cvModel->getSections($id);
        $template = $this->templateModel->findById($profile['template_id']);
        $templateSections = $this->templateModel->getSections($profile['template_id']);
        $userPlan = $user['subscription_plan'];

        // Auto-create cv_sections for any new template sections added after CV creation
        $existingKeys = array_column($sections, 'section_key');
        $added = false;
        foreach ($templateSections as $ts) {
            if (!in_array($ts['section_key'], $existingKeys)) {
                $db = Database::getInstance()->getConnection();
                $stmt = $db->prepare(
                    "INSERT INTO cv_sections (profile_id, section_key, section_order) VALUES (?, ?, ?)"
                );
                $stmt->execute([$id, $ts['section_key'], $ts['section_order']]);
                $added = true;
            }
        }
        if ($added) {
            $sections = $this->cvModel->getSections($id);
        }

        include TEMPLATE_PATH . '/cv/editor.php';
    }

    public function update(int $id): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->jsonResponse(['error' => 'Invalid request.'], 403);
            return;
        }

        $user = Auth::user();
        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        // Update personal info
        if (isset($data['personal_info'])) {
            $this->cvModel->update($id, ['personal_info' => $data['personal_info']]);
        }

        // Update CV name
        if (isset($data['name'])) {
            $this->cvModel->update($id, ['name' => $data['name']]);
        }

        $this->jsonResponse(['success' => true]);
    }

    public function delete(int $id): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $user = Auth::user();
        $this->cvModel->delete($id, $user['id']);

        $_SESSION['flash_success'] = 'CV deleted successfully.';
        header('Location: ' . APP_URL . '/dashboard');
        exit;
    }

    public function addSection(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $sectionId = (int) ($data['section_id'] ?? 0);
        $entryData = $data['data'] ?? [];

        $db = Database::getInstance()->getConnection();

        // Determine entry order and section_key
        $stmtOrder = $db->prepare("SELECT COALESCE(MAX(entry_order), 0) + 1 FROM cv_entries WHERE section_id = ?");
        $stmtOrder->execute([$sectionId]);
        $entryOrder = (int) $stmtOrder->fetchColumn();

        $stmtKey = $db->prepare(
            "SELECT cs.section_key FROM cv_sections cs 
             JOIN cv_profiles cp ON cs.profile_id = cp.id 
             WHERE cs.id = ? AND cp.user_id = ?"
        );
        $stmtKey->execute([$sectionId, $user['id']]);
        $sectionKey = $stmtKey->fetchColumn();

        // Create master user_entry
        $userEntryId = $this->cvModel->createUserEntry($user['id'], $sectionKey, $entryData, $entryOrder);

        // Insert CV entry linked to master
        $stmt = $db->prepare(
            "INSERT INTO cv_entries (section_id, user_entry_id, data, entry_order) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$sectionId, $userEntryId, json_encode($entryData), $entryOrder]);

        $entryId = (int) $db->lastInsertId();
        EventLogger::log('cv_section_add', [
            'profile_id' => $cvId,
            'section_id' => $sectionId,
            'entry_id' => $entryId,
            'fields_count' => is_array($entryData) ? count($entryData) : 0,
        ]);
        $this->jsonResponse(['success' => true, 'entry_id' => $entryId]);
    }

    public function updateSection(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);

        // Section-level visibility toggle (e.g. Declaration on/off)
        $sectionId = (int) ($data['section_id'] ?? 0);
        if ($sectionId > 0 && array_key_exists('is_visible', (array) $data)) {
            $isVisible = !empty($data['is_visible']) ? 1 : 0;
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare("UPDATE cv_sections SET is_visible = ? WHERE id = ? AND profile_id = ?");
            $stmt->execute([$isVisible, $sectionId, $cvId]);

            EventLogger::log('cv_section_visibility', [
                'profile_id' => $cvId,
                'section_id' => $sectionId,
                'is_visible' => $isVisible,
            ]);

            $this->jsonResponse(['success' => true, 'is_visible' => (bool) $isVisible]);
            return;
        }

        $entryId = (int) ($data['entry_id'] ?? 0);
        $entryData = $data['data'] ?? [];

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("UPDATE cv_entries SET data = ? WHERE id = ?");
        $stmt->execute([json_encode($entryData), $entryId]);

        // Sync to master user_entry
        $stmtLink = $db->prepare("SELECT user_entry_id FROM cv_entries WHERE id = ?");
        $stmtLink->execute([$entryId]);
        $userEntryId = $stmtLink->fetchColumn();
        if ($userEntryId) {
            $this->cvModel->updateUserEntry((int) $userEntryId, $entryData);
        }

        if (is_array($entryData)) {
            foreach ($entryData as $fieldName => $fieldValue) {
                EventLogger::log('cv_field_fill', [
                    'profile_id' => $cvId,
                    'entry_id' => $entryId,
                    'field_name' => (string) $fieldName,
                    'value_length' => is_scalar($fieldValue) ? strlen((string) $fieldValue) : 0,
                ]);
            }
        }

        EventLogger::log('cv_section_saved', [
            'profile_id' => $cvId,
            'entry_id' => $entryId,
            'fields_count' => is_array($entryData) ? count($entryData) : 0,
        ]);

        $this->jsonResponse(['success' => true]);
    }

    public function deleteSection(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $entryId = (int) ($data['entry_id'] ?? 0);

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("DELETE FROM cv_entries WHERE id = ?");
        $stmt->execute([$entryId]);

        EventLogger::log('cv_section_delete', [
            'profile_id' => $cvId,
            'entry_id' => $entryId,
        ]);

        $this->jsonResponse(['success' => true]);
    }

    public function reorderSections(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $order = $data['order'] ?? [];

        $db = Database::getInstance()->getConnection();
        foreach ($order as $index => $entryId) {
            $stmt = $db->prepare("UPDATE cv_entries SET entry_order = ? WHERE id = ?");
            $stmt->execute([$index, (int) $entryId]);
        }

        $this->jsonResponse(['success' => true]);
    }

    /**
     * Reorder cv_sections (the sections themselves, not entries within them)
     */
    public function reorderSectionOrder(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $order = $data['order'] ?? [];

        $db = Database::getInstance()->getConnection();
        foreach ($order as $index => $sectionId) {
            $stmt = $db->prepare("UPDATE cv_sections SET section_order = ? WHERE id = ? AND profile_id = ?");
            $stmt->execute([$index + 1, (int) $sectionId, $cvId]);
        }

        $this->jsonResponse(['success' => true]);
    }

    /**
     * Save per-CV settings (heading color, etc.) to cv_profiles.cv_settings
     */
    public function saveSettings(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        if (!isset($data['_token']) || !Auth::verifyToken($data['_token'])) {
            $this->jsonResponse(['error' => 'Invalid request.'], 403);
            return;
        }

        // Only allow known safe setting keys.
        $allowed = ['primaryColor'];
        $settings = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $settings[$key] = (string) $data[$key];
            }
        }

        // Validate hex color format.
        if (isset($settings['primaryColor'])) {
            if (!preg_match('/^#[0-9a-fA-F]{6}$/', $settings['primaryColor'])) {
                $this->jsonResponse(['error' => 'Invalid color format.'], 422);
                return;
            }
        }

        $db = Database::getInstance()->getConnection();

        // Merge with existing settings so we don't overwrite other keys.
        $stmt = $db->prepare("SELECT cv_settings FROM cv_profiles WHERE id = ?");
        $stmt->execute([$cvId]);
        $row = $stmt->fetch();
        $existing = ($row && $row['cv_settings']) ? json_decode($row['cv_settings'], true) : [];
        if (!is_array($existing)) $existing = [];
        $merged = array_merge($existing, $settings);

        $stmt = $db->prepare("UPDATE cv_profiles SET cv_settings = ? WHERE id = ?");
        $stmt->execute([json_encode($merged), $cvId]);

        $this->jsonResponse(['success' => true]);
    }

    public function preview(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $_SESSION['flash_error'] = 'CV not found.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $profile = $this->cvModel->findById($id);

        // Check if compiled PDF exists
        if (!empty($profile['pdf_path']) && file_exists($profile['pdf_path'])) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="' . basename($profile['pdf_path']) . '"');
            header('Content-Length: ' . filesize($profile['pdf_path']));
            header('Cache-Control: no-cache, no-store, must-revalidate');
            readfile($profile['pdf_path']);
            exit;
        }

        $_SESSION['flash_error'] = 'PDF not yet compiled. Click "Compile PDF" first.';
        header('Location: ' . APP_URL . '/cv/edit/' . $id);
        exit;
    }

    public function download(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $_SESSION['flash_error'] = 'CV not found.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $profile = $this->cvModel->findById($id);

        if (!empty($profile['pdf_path']) && file_exists($profile['pdf_path'])) {
            EventLogger::log('pdf_downloaded', ['profile_id' => $id]);
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $profile['name']) . '.pdf"');
            header('Content-Length: ' . filesize($profile['pdf_path']));
            readfile($profile['pdf_path']);
            exit;
        }

        $_SESSION['flash_error'] = 'PDF not yet compiled.';
        header('Location: ' . APP_URL . '/cv/edit/' . $id);
        exit;
    }

    public function compile(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        // Capture any stray PHP output (warnings, notices, var_dumps, etc.)
        // so it never corrupts the JSON response that the editor's fetch()
        // expects. We surface anything that leaked to the error log instead.
        ob_start();
        try {
            $renderer = RendererFactory::make($id);
            $result = $renderer->compile($id);

            // Metrics recording is best-effort and must never break the response.
            try {
                PdfRenderMetrics::record($id, (int) $user['id'], $result);
            } catch (\Throwable $e) {
                error_log('CVController.compile metrics: ' . $e->getMessage());
            }

            if (!empty($result['success'])) {
                $this->cvModel->update($id, [
                    'pdf_path'         => $result['pdf_path'],
                    'last_compiled_at' => date('Y-m-d H:i:s'),
                ]);

                try {
                    EventLogger::log('pdf_compiled', ['profile_id' => $id]);
                } catch (\Throwable $e) {
                    error_log('CVController.compile event log: ' . $e->getMessage());
                }

                $pdfBytes = @file_get_contents($result['pdf_path']);
                if ($pdfBytes === false) {
                    $stray = ob_get_clean();
                    if ($stray !== '') error_log('CVController.compile stray output: ' . $stray);
                    $this->jsonResponse(['error' => 'Compiled PDF could not be read from disk.'], 500);
                    return;
                }

                $stray = ob_get_clean();
                if ($stray !== '') error_log('CVController.compile stray output: ' . $stray);
                $this->jsonResponse(['success' => true, 'pdf_base64' => base64_encode($pdfBytes)]);
                return;
            }

            $stray = ob_get_clean();
            if ($stray !== '') error_log('CVController.compile stray output: ' . $stray);
            $this->jsonResponse(['error' => $result['error'] ?? 'Compilation failed.'], 500);
        } catch (\Throwable $e) {
            $stray = ob_get_clean();
            error_log('CVController.compile exception: ' . $e->getMessage()
                . ' @ ' . $e->getFile() . ':' . $e->getLine()
                . ($stray !== '' ? "\nStray output: " . $stray : ''));
            $this->jsonResponse(['error' => 'Compilation error: ' . $e->getMessage()], 500);
        }
    }

    public function previewData(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $profile = $this->cvModel->findById($id);

        if (!empty($profile['pdf_path']) && file_exists($profile['pdf_path'])) {
            $pdfData = base64_encode(file_get_contents($profile['pdf_path']));
            $this->jsonResponse(['success' => true, 'pdf_base64' => $pdfData]);
        } else {
            $this->jsonResponse(['error' => 'PDF not yet compiled.'], 404);
        }
    }

    public function autosave(): void
    {
        Auth::requireLogin();
        $data = json_decode(file_get_contents('php://input'), true);
        $cvId = (int) ($data['cv_id'] ?? 0);
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        if (isset($data['personal_info'])) {
            $this->cvModel->update($cvId, ['personal_info' => $data['personal_info']]);

            // Sync to user's master personal info
            $userModel = new User();
            $userModel->update($user['id'], ['personal_info' => json_encode($data['personal_info'])]);
        }

        $this->jsonResponse(['success' => true, 'saved_at' => date('H:i:s')]);
    }

    public function getLatex(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $latexService = new LatexService();
        $latex = $latexService->generateLatex($id);

        $this->jsonResponse(['latex' => $latex]);
    }

    /**
     * Lookup DOI metadata via CrossRef API and return publication fields
     */
    public function doiLookup(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        // Check Pro feature
        $featureModel = new Feature();
        if (!$featureModel->planHasFeature($user['subscription_plan'], 'doi_autofill')) {
            $this->jsonResponse(['error' => 'This feature requires a Pro plan.'], 403);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $doi = trim($data['doi'] ?? '');

        if (!$doi) {
            $this->jsonResponse(['error' => 'No DOI provided.'], 400);
            return;
        }

        // Normalize DOI — extract just the DOI part
        $doi = preg_replace('#^https?://(dx\.)?doi\.org/#', '', $doi);

        // Fetch from CrossRef API
        $url = 'https://api.crossref.org/works/' . rawurlencode($doi);
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: CVScholar/1.0 (mailto:support@cvscholar.com)\r\n",
                'timeout' => 10,
                'ignore_errors' => true,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);
        if ($response === false) {
            $this->jsonResponse(['error' => 'Could not reach CrossRef API. Please try again.'], 502);
            return;
        }

        $result = json_decode($response, true);
        if (!isset($result['message'])) {
            $this->jsonResponse(['error' => 'DOI not found. Please verify the DOI is correct.'], 404);
            return;
        }

        $msg = $result['message'];

        // Extract title
        $title = '';
        if (!empty($msg['title'])) {
            $title = is_array($msg['title']) ? $msg['title'][0] : $msg['title'];
        }

        // Extract authors
        $authors = [];
        if (!empty($msg['author'])) {
            foreach ($msg['author'] as $a) {
                $name = trim(($a['given'] ?? '') . ' ' . ($a['family'] ?? ''));
                if ($name) $authors[] = $name;
            }
        }

        // Extract year
        $year = '';
        if (!empty($msg['published-print']['date-parts'][0][0])) {
            $year = (string) $msg['published-print']['date-parts'][0][0];
        } elseif (!empty($msg['published-online']['date-parts'][0][0])) {
            $year = (string) $msg['published-online']['date-parts'][0][0];
        } elseif (!empty($msg['issued']['date-parts'][0][0])) {
            $year = (string) $msg['issued']['date-parts'][0][0];
        }

        // Extract type
        $typeMap = [
            'journal-article' => 'Journal Article',
            'proceedings-article' => 'Conference Paper',
            'book-chapter' => 'Book Chapter',
            'book' => 'Book',
            'posted-content' => 'Preprint',
            'dissertation' => 'Dissertation',
            'report' => 'Report',
        ];
        $pubType = $typeMap[$msg['type'] ?? ''] ?? ucfirst(str_replace('-', ' ', $msg['type'] ?? ''));

        // Extract venue (journal/conference name)
        $venue = '';
        if (!empty($msg['container-title'])) {
            $venue = is_array($msg['container-title']) ? $msg['container-title'][0] : $msg['container-title'];
        }

        // Extract volume/issue/pages
        $vip = '';
        $parts = [];
        if (!empty($msg['volume'])) $parts[] = 'Vol. ' . $msg['volume'];
        if (!empty($msg['issue'])) $parts[] = 'Issue ' . $msg['issue'];
        if (!empty($msg['page'])) $parts[] = 'pp. ' . $msg['page'];
        if ($parts) $vip = implode(', ', $parts);

        // Build URL
        $doiUrl = 'https://doi.org/' . $doi;

        $this->jsonResponse([
            'success' => true,
            'fields' => [
                'title' => $title,
                'authors' => implode(', ', $authors),
                'year' => $year,
                'publication_type' => $pubType,
                'venue' => $venue,
                'volume_issue_pages' => $vip,
                'doi' => $doi,
                'url' => $doiUrl,
                'status' => 'Published',
            ],
        ]);
    }

    // --- Private helpers ---

    public function duplicate(int $id): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $user = Auth::user();
        if (!$this->cvModel->belongsToUser($id, $user['id'])) {
            $_SESSION['flash_error'] = 'CV not found.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        // Check CV limit
        $userModel = new User();
        $cvCount = $userModel->countCVs($user['id']);
        $maxCvs = $user['subscription_plan'] === 'free' ? PLAN_FREE_MAX_CVS : PLAN_PRO_MAX_CVS;

        if ($cvCount >= $maxCvs && $user['subscription_plan'] !== 'enterprise') {
            $_SESSION['flash_error'] = "You've reached the maximum number of CVs for your plan.";
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $source = $this->cvModel->findById($id);
        $newName = $source['name'] . ' (Copy)';

        $newProfileId = $this->cvModel->duplicate($id, $user['id'], $newName);

        $_SESSION['flash_success'] = 'CV duplicated successfully!';
        header('Location: ' . APP_URL . '/cv/edit/' . $newProfileId);
        exit;
    }

    // --- Private helpers below ---

    private function createDefaultSections(int $profileId, int $templateId): void
    {
        $templateSections = $this->templateModel->getSections($templateId);
        $db = Database::getInstance()->getConnection();

        foreach ($templateSections as $section) {
            $stmt = $db->prepare(
                "INSERT INTO cv_sections (profile_id, section_key, section_order) VALUES (?, ?, ?)"
            );
            $stmt->execute([$profileId, $section['section_key'], $section['section_order']]);
        }
    }

    private function jsonResponse(array $data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
