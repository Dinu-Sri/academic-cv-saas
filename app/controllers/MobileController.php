<?php
/**
 * MobileController
 *
 * Implements the "Start on mobile, finish on laptop" retention flow.
 * Mobile users either upload an existing CV (AI extraction) or fill a short
 * manual form. Either way we build a Classic Academic CV (template id=1),
 * generate a preview PDF, and hand off a secure non-expiring continuation
 * link so the user finishes on a laptop.
 */
class MobileController
{
    private const CLASSIC_TEMPLATE_ID = 1;

    private CVProfile $cvModel;
    private MobileCvSession $sessionModel;

    public function __construct()
    {
        $this->cvModel = new CVProfile();
        $this->sessionModel = new MobileCvSession();
    }

    /**
     * Mobile landing page with the two start options.
     */
    public function start(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $this->logEvent('mobile_start_page_viewed');

        $pageTitle = 'Start your CV';
        include TEMPLATE_PATH . '/mobile/start.php';
    }

    public function uploadForm(): void
    {
        Auth::requireLogin();
        $this->logEvent('mobile_upload_option_selected');

        $pageTitle = 'Upload your CV';
        $error = $_SESSION['flash_error'] ?? '';
        unset($_SESSION['flash_error']);
        include TEMPLATE_PATH . '/mobile/upload.php';
    }

    public function uploadSubmit(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Your session expired. Please try again.';
            $this->redirect('/mobile-start/upload');
        }

        $file = $_FILES['cv_file'] ?? null;
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $_SESSION['flash_error'] = 'We could not upload your file. Please try again with PDF, DOC, or DOCX.';
            $this->redirect('/mobile-start/upload');
        }

        $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        if (!in_array($ext, ['pdf', 'doc', 'docx'], true)) {
            $_SESSION['flash_error'] = 'We could not upload your file. Please try again with PDF, DOC, or DOCX.';
            $this->redirect('/mobile-start/upload');
        }

        $this->logEvent('mobile_cv_uploaded', ['ext' => $ext]);

        $sessionId = $this->sessionModel->create([
            'user_id' => (int) $user['id'],
            'mobile_flow_type' => 'uploaded_cv',
            'source_device' => Auth::deviceType(),
            'extraction_status' => 'pending',
            'pdf_generation_status' => 'pending',
        ]);

        // Persist a copy of the upload for traceability (storage is a volume).
        $storedPath = $this->storeUpload($file, (int) $user['id'], $ext);
        if ($storedPath !== '') {
            $this->sessionModel->update($sessionId, ['uploaded_cv_file_path' => $storedPath]);
        }

        // Only PDFs can be extracted by the AI vision pipeline today.
        $draft = [];
        $extractionOk = false;
        if ($ext === 'pdf') {
            try {
                $service = new AiCvImportService();
                $result = $service->importUploadedPdf($file, (int) $user['id']);
                if (!empty($result['success']) && !empty($result['draft'])) {
                    $draft = $result['draft'];
                    $extractionOk = true;
                }
            } catch (Throwable $e) {
                error_log('MobileController.uploadSubmit extraction: ' . $e->getMessage());
            }
        }

        $this->sessionModel->update($sessionId, [
            'extraction_status' => $extractionOk ? 'success' : 'failed',
        ]);
        $this->logEvent(
            $extractionOk ? 'mobile_cv_upload_extraction_success' : 'mobile_cv_upload_extraction_failed'
        );

        // Build the Classic CV. Even if extraction failed we still create an
        // empty Classic workspace so the user can finish on laptop.
        $profileId = $this->buildProfileFromDraft((int) $user['id'], $draft);
        if ($profileId <= 0) {
            $_SESSION['flash_error'] = 'We created your workspace, but some details could not be extracted. You can complete them on laptop.';
            $this->redirect('/mobile-start/upload');
        }

        $this->finalizeSession($sessionId, $profileId, (int) $user['id']);
        $this->redirect('/mobile-cv-ready/' . $profileId);
    }

    public function manualForm(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $this->logEvent('mobile_manual_option_selected');

        $pageTitle = 'Start your CV';
        $error = $_SESSION['flash_error'] ?? '';
        unset($_SESSION['flash_error']);
        include TEMPLATE_PATH . '/mobile/manual.php';
    }

    public function manualSubmit(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Your session expired. Please try again.';
            $this->redirect('/mobile-start/manual');
        }

        $fullName = trim((string) ($_POST['full_name'] ?? ''));
        $title = trim((string) ($_POST['title'] ?? ''));
        $affiliation = trim((string) ($_POST['affiliation'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $field = trim((string) ($_POST['field'] ?? ''));
        $goal = trim((string) ($_POST['goal'] ?? ''));

        if ($fullName === '') {
            $_SESSION['flash_error'] = 'Please enter your full name to continue.';
            $this->redirect('/mobile-start/manual');
        }

        $this->logEvent('mobile_manual_form_submitted');

        $sessionId = $this->sessionModel->create([
            'user_id' => (int) $user['id'],
            'mobile_flow_type' => 'manual_start',
            'source_device' => Auth::deviceType(),
            'extraction_status' => 'success',
            'pdf_generation_status' => 'pending',
        ]);

        $personalInfo = array_filter([
            'full_name' => $fullName,
            'title' => $title,
            'affiliation' => $affiliation,
            'email' => $email !== '' ? $email : ($user['email'] ?? ''),
            'phone' => $phone,
        ], static fn($v) => $v !== '');

        $profileId = $this->cvModel->create([
            'user_id' => (int) $user['id'],
            'template_id' => self::CLASSIC_TEMPLATE_ID,
            'name' => $fullName !== '' ? ($fullName . ' - Academic CV') : 'My Academic CV',
            'personal_info' => $personalInfo,
        ]);
        $this->cvModel->createDefaultSections($profileId, self::CLASSIC_TEMPLATE_ID);

        // AI-generated academic profile summary (on by default). Invents nothing.
        try {
            $summary = (new AiCvImportService())->generateProfileSummary([
                'full_name' => $fullName,
                'title' => $title,
                'affiliation' => $affiliation,
                'field' => $field,
                'goal' => $goal,
            ]);
            if ($summary !== '') {
                $this->cvModel->addEntryToSection($profileId, 'academic_profile', ['summary' => $summary]);
            }
        } catch (Throwable $e) {
            error_log('MobileController.manualSubmit summary: ' . $e->getMessage());
        }

        $this->logEvent('mobile_draft_created', ['profile_id' => $profileId]);
        $this->finalizeSession($sessionId, $profileId, (int) $user['id']);
        $this->redirect('/mobile-cv-ready/' . $profileId);
    }

    public function ready(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!$this->cvModel->belongsToUser($id, (int) $user['id'])) {
            $_SESSION['flash_error'] = 'CV not found.';
            $this->redirect('/dashboard');
        }

        $profile = $this->cvModel->findById($id);
        $session = $this->sessionModel->findByProfile($id);
        $continueUrl = $this->continuationUrl($id, (int) $user['id']);

        $this->logEvent('mobile_preview_viewed', ['profile_id' => $id]);

        $pageTitle = 'Your CV is ready';
        include TEMPLATE_PATH . '/mobile/ready.php';
    }

    public function emailLink(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->jsonResponse(['error' => 'Invalid request.'], 403);
            return;
        }
        if (!$this->cvModel->belongsToUser($id, (int) $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $toEmail = trim((string) ($user['email'] ?? ''));
        if ($toEmail === '') {
            $this->jsonResponse(['error' => 'We could not send the email right now. Please copy the laptop link instead.'], 400);
            return;
        }

        $link = $this->continuationUrl($id, (int) $user['id']);
        $name = (string) ($user['full_name'] ?? $user['username'] ?? 'there');

        $sent = false;
        try {
            $sent = EmailService::sendContinuationLink($toEmail, $name, $link);
        } catch (Throwable $e) {
            error_log('MobileController.emailLink: ' . $e->getMessage());
        }

        if (!$sent) {
            $this->jsonResponse(['error' => 'We could not send the email right now. Please copy the laptop link instead.'], 502);
            return;
        }

        $session = $this->sessionModel->findByProfile($id);
        if ($session) {
            $this->sessionModel->markTimestamp((int) $session['id'], 'emailed_link_at');
        }
        $this->logEvent('mobile_continue_link_emailed', ['profile_id' => $id]);

        $this->jsonResponse(['success' => true, 'message' => 'We emailed your laptop link.']);
    }

    public function trackShare(int $id): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->jsonResponse(['error' => 'Invalid request.'], 403);
            return;
        }
        if (!$this->cvModel->belongsToUser($id, (int) $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $channel = (string) ($_POST['channel'] ?? '');
        $session = $this->sessionModel->findByProfile($id);

        if ($channel === 'whatsapp') {
            if ($session) {
                $this->sessionModel->markTimestamp((int) $session['id'], 'whatsapp_clicked_at');
            }
            $this->logEvent('mobile_continue_link_whatsapp_clicked', ['profile_id' => $id]);
        } elseif ($channel === 'copy') {
            if ($session) {
                $this->sessionModel->markTimestamp((int) $session['id'], 'copied_link_at');
            }
            $this->logEvent('mobile_continue_link_copied', ['profile_id' => $id]);
        } else {
            $this->jsonResponse(['error' => 'Unknown channel.'], 400);
            return;
        }

        $this->jsonResponse(['success' => true]);
    }

    // -- Internals -----------------------------------------------------------

    /**
     * Build a Classic Academic profile from an extracted draft (force template 1).
     */
    private function buildProfileFromDraft(int $userId, array $draft): int
    {
        try {
            $service = new AiCvImportService();
            $result = $service->applyDraftToCv($userId, $draft, [
                'merge_strategy' => 'fill_missing_add_new',
                'force_new' => true,
                'force_template_id' => self::CLASSIC_TEMPLATE_ID,
                'name' => 'Imported Academic CV',
            ]);
            $profileId = (int) ($result['profile_id'] ?? 0);
            if ($profileId > 0) {
                $this->logEvent('mobile_draft_created', ['profile_id' => $profileId]);
            }
            return $profileId;
        } catch (Throwable $e) {
            error_log('MobileController.buildProfileFromDraft: ' . $e->getMessage());
            // Fall back to an empty Classic workspace.
            $profileId = $this->cvModel->create([
                'user_id' => $userId,
                'template_id' => self::CLASSIC_TEMPLATE_ID,
                'name' => 'My Academic CV',
                'personal_info' => [],
            ]);
            $this->cvModel->createDefaultSections($profileId, self::CLASSIC_TEMPLATE_ID);
            $this->logEvent('mobile_draft_created', ['profile_id' => $profileId, 'fallback' => true]);
            return $profileId;
        }
    }

    /**
     * Generate a preview PDF, store the continuation token, and link the
     * session row to the profile. Best-effort: failures never block handoff.
     */
    private function finalizeSession(int $sessionId, int $profileId, int $userId): void
    {
        $token = MobileCvSession::issueToken($userId, $profileId);
        $this->sessionModel->update($sessionId, [
            'cv_profile_id' => $profileId,
            'continuation_token' => $token,
        ]);

        $pdfOk = false;
        try {
            $renderer = RendererFactory::make($profileId);
            $result = $renderer->compile($profileId);
            if (!empty($result['success']) && !empty($result['pdf_path'])) {
                $this->cvModel->update($profileId, [
                    'pdf_path' => $result['pdf_path'],
                    'last_compiled_at' => date('Y-m-d H:i:s'),
                ]);
                $pdfOk = true;
            }
        } catch (Throwable $e) {
            error_log('MobileController.finalizeSession compile: ' . $e->getMessage());
        }

        $this->sessionModel->update($sessionId, [
            'pdf_generation_status' => $pdfOk ? 'success' : 'failed',
        ]);

        if ($pdfOk) {
            $this->logEvent('mobile_pdf_generated', ['profile_id' => $profileId]);
            $this->logEvent('cv_generated', ['profile_id' => $profileId, 'source' => 'mobile_flow']);
        }
    }

    private function continuationUrl(int $profileId, int $userId): string
    {
        $token = MobileCvSession::issueToken($userId, $profileId);
        return APP_URL . '/cv/edit/' . $profileId . '?continue_token=' . urlencode($token);
    }

    private function storeUpload(array $file, int $userId, string $ext): string
    {
        $dir = UPLOAD_DIR . '/mobile_cv_uploads';
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return '';
        }
        if (!is_writable($dir)) {
            return '';
        }
        $dest = $dir . '/user-' . $userId . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
        $tmp = (string) ($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            return '';
        }
        // Copy (not move) so the AI import path can still read the upload.
        if (!@copy($tmp, $dest)) {
            return '';
        }
        return $dest;
    }

    private function logEvent(string $eventKey, array $metadata = []): void
    {
        try {
            EventLogger::log($eventKey, $metadata);
        } catch (Throwable $e) {
            error_log('MobileController event log (' . $eventKey . '): ' . $e->getMessage());
        }
    }

    private function redirect(string $path): void
    {
        header('Location: ' . APP_URL . $path);
        exit;
    }

    private function jsonResponse(array $data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
