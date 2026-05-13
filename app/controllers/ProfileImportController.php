<?php
/**
 * Profile Import Controller
 * Handles ORCID and Google Scholar profile importing
 */
class ProfileImportController
{
    private ProfileImportService $importService;

    public function __construct()
    {
        $this->importService = new ProfileImportService();
    }

    /**
     * Show the import page
     */
    public function index(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $pending = $this->importService->getPendingPublications($user['id']);
        $approved = $this->importService->getApprovedPublications($user['id']);

        include TEMPLATE_PATH . '/profile/import.php';
    }

    /**
     * Handle ORCID import (AJAX)
     */
    public function importOrcid(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        $data = json_decode(file_get_contents('php://input'), true);
        $orcidInput = trim($data['orcid_id'] ?? '');

        if (empty($orcidInput)) {
            $this->jsonResponse(['error' => 'Please enter an ORCID ID or URL.'], 400);
            return;
        }

        $result = $this->importService->importFromOrcid($orcidInput);

        if (!$result['success']) {
            $this->importService->logSync($user['id'], 'orcid', 'failed', 0, $result['error']);
            $this->jsonResponse(['error' => $result['error']], 400);
            return;
        }

        // Save publications to DB as pending (unverified)
        $works = $result['works'] ?? [];
        $saved = $this->importService->savePublications($user['id'], $works, 'orcid');

        // Save education entries directly to CV
        $education = $result['education'] ?? [];
        $eduAdded = $this->importService->addEntriesToCvSection($user['id'], 'education', $education, 'institution');

        // Save employment entries directly to CV
        $employment = $result['employment'] ?? [];
        $empAdded = $this->importService->addEntriesToCvSection($user['id'], 'experience', $employment, 'organization');

        // Update user's ORCID ID
        $userModel = new User();
        $userModel->update($user['id'], ['orcid_id' => $result['profile']['orcid_id']]);

        // Also sync any previously approved publications that weren't added to CV
        $pubsSynced = $this->importService->syncApprovedPublicationsToCV($user['id']);

        $this->importService->logSync($user['id'], 'orcid', 'success', $saved + $eduAdded + $empAdded);
        EventLogger::log('orcid_imported', [
            'new_publications' => $saved,
            'education_added' => $eduAdded,
            'employment_added' => $empAdded,
        ]);

        $parts = [];
        if ($saved > 0) $parts[] = "{$saved} new publications (pending review)";
        if ($pubsSynced > 0) $parts[] = "{$pubsSynced} approved publications synced to CV";
        if ($eduAdded > 0) $parts[] = "{$eduAdded} education entries";
        if ($empAdded > 0) $parts[] = "{$empAdded} work experience entries";
        $msg = !empty($parts) ? 'Imported: ' . implode(', ', $parts) . '.' : 'No new data to import (already up to date).';

        $this->jsonResponse([
            'success'      => true,
            'profile'      => $result['profile'],
            'publications' => count($works),
            'new_saved'    => $saved,
            'pubs_synced'  => $pubsSynced,
            'education_added' => $eduAdded,
            'employment_added' => $empAdded,
            'education'    => $education,
            'employment'   => $employment,
            'message'      => $msg,
        ]);
    }

    /**
     * Handle Google Scholar import (AJAX)
     */
    public function importScholar(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        $data = json_decode(file_get_contents('php://input'), true);
        $scholarInput = trim($data['scholar_id'] ?? '');

        if (empty($scholarInput)) {
            $this->jsonResponse(['error' => 'Please enter a Google Scholar profile URL or ID.'], 400);
            return;
        }

        $result = $this->importService->importFromScholar($scholarInput);

        if (!$result['success']) {
            $this->importService->logSync($user['id'], 'google_scholar', 'failed', 0, $result['error']);
            $this->jsonResponse(['error' => $result['error']], 400);
            return;
        }

        // Save publications as pending
        $pubs = $result['publications'] ?? [];
        $saved = $this->importService->savePublications($user['id'], $pubs, 'google_scholar');

        // Sync any previously approved publications to CV
        $pubsSynced = $this->importService->syncApprovedPublicationsToCV($user['id']);

        // Update user's Scholar ID
        $userModel = new User();
        $userModel->update($user['id'], ['google_scholar_id' => $result['profile']['google_scholar_id']]);

        $this->importService->logSync($user['id'], 'google_scholar', 'success', $saved);
        EventLogger::log('scholar_imported', [
            'new_publications' => $saved,
            'total_found' => count($pubs),
        ]);

        $parts = [];
        if ($saved > 0) $parts[] = "{$saved} new publications (pending review)";
        if ($pubsSynced > 0) $parts[] = "{$pubsSynced} approved publications synced to CV";
        $msg = !empty($parts) ? 'Found: ' . implode(', ', $parts) . '.' : 'No new publications to import (already up to date).';

        $this->jsonResponse([
            'success'      => true,
            'profile'      => $result['profile'],
            'publications' => count($pubs),
            'new_saved'    => $saved,
            'message'      => $msg,
        ]);
    }


    /**
     * Handle uploaded CV PDF import (AJAX)
     */
    public function importCvPdf(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        try {
            $service = new AiCvImportService();
            if (!empty($_FILES['cv_pdf'])) {
                $result = $service->importUploadedPdf($_FILES['cv_pdf'], (int) $user['id']);
            } else {
                $text = trim((string) ($_POST['cv_text'] ?? ''));
                if ($text === '') {
                    $this->jsonResponse(['error' => 'Please upload a CV PDF or paste CV text.'], 400);
                    return;
                }
                $result = $service->importFromText($text);
            }
        } catch (Throwable $e) {
            error_log('ProfileImportController.importCvPdf: ' . $e->getMessage());
            $this->importService->logSync((int) $user['id'], 'ai_cv_pdf', 'failed', 0, $e->getMessage());
            $this->jsonResponse(['error' => $e->getMessage()], 400);
            return;
        }

        if (empty($result['success'])) {
            $this->importService->logSync((int) $user['id'], 'ai_cv_pdf', 'failed', 0, $result['error'] ?? 'Import failed');
            $this->jsonResponse(['error' => $result['error'] ?? 'Import failed.'], 400);
            return;
        }

        $draft = $result['draft'] ?? [];
        $entryCount = $this->countDraftEntries($draft);
        $this->importService->logSync((int) $user['id'], 'ai_cv_pdf', 'success', $entryCount);

        try {
            EventLogger::log('ai_cv_pdf_imported', [
                'provider' => $result['provider'] ?? 'local_extraction',
                'extraction_method' => $result['extraction_method'] ?? 'unknown',
                'ai_status' => $result['ai_status'] ?? 'unknown',
                'text_chars_sent' => $result['text_chars_sent'] ?? 0,
                'text_chars_extracted' => $result['text_chars_extracted'] ?? 0,
                'entries_found' => $entryCount,
            ]);
        } catch (Throwable $e) {
            error_log('ProfileImportController.importCvPdf event log: ' . $e->getMessage());
        }

        $this->jsonResponse([
            'success' => true,
            'draft' => $draft,
            'provider' => $result['provider'] ?? 'local_extraction',
            'extraction_method' => $result['extraction_method'] ?? 'unknown',
            'ai_status' => $result['ai_status'] ?? 'unknown',
            'ai_error' => $result['ai_error'] ?? null,
            'draft_stats' => $result['draft_stats'] ?? [],
            'warnings' => $result['warnings'] ?? [],
            'text_chars_sent' => $result['text_chars_sent'] ?? 0,
            'text_chars_extracted' => $result['text_chars_extracted'] ?? 0,
            'message' => 'CV draft extracted. Review it below before adding it to your CV.',
        ]);
    }

    /**
     * Apply reviewed AI CV draft to the user's CV sections (AJAX)
     */
    public function applyCvDraft(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            $this->jsonResponse(['error' => 'Invalid CV draft data. Please import again and retry.'], 400);
            return;
        }

        try {
            $result = (new AiCvImportService())->applyDraftToCv((int) $user['id'], $data);
        } catch (Throwable $e) {
            error_log('ProfileImportController.applyCvDraft: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Imported CV draft could not be applied. Please try again.'], 500);
            return;
        }

        try {
            EventLogger::log('ai_cv_draft_applied', [
                'profile_id' => $result['profile_id'] ?? 0,
                'sections_added' => array_keys(array_filter($result['added'] ?? [])),
                'entries_added' => array_sum($result['added'] ?? []),
            ]);
        } catch (Throwable $e) {
            error_log('ProfileImportController.applyCvDraft event log: ' . $e->getMessage());
        }

        $this->jsonResponse($result);
    }

    private function countDraftEntries(array $draft): int
    {
        $count = 0;
        foreach ($draft as $key => $value) {
            if ($key === 'personal_info') continue;
            if (is_array($value)) $count += count($value);
        }
        return $count;
    }

    /**
     * Approve selected publications (AJAX)
     */
    public function approvePublications(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        $data = json_decode(file_get_contents('php://input'), true);
        $ids = array_map('intval', $data['publication_ids'] ?? []);

        $approved = $this->importService->approvePublications($user['id'], $ids);

        // Also add approved publications as CV entries
        $synced = $this->importService->syncApprovedPublicationsToCV($user['id']);

        $this->jsonResponse([
            'success' => true,
            'approved' => $approved,
            'message' => "{$approved} publication(s) approved and added to your CV.",
        ]);
    }

    /**
     * Reject selected publications (AJAX)
     */
    public function rejectPublications(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        $data = json_decode(file_get_contents('php://input'), true);
        $ids = array_map('intval', $data['publication_ids'] ?? []);

        $rejected = $this->importService->rejectPublications($user['id'], $ids);

        $this->jsonResponse([
            'success' => true,
            'rejected' => $rejected,
            'message' => "{$rejected} publication(s) removed.",
        ]);
    }

    /**
     * Get pending publications list (AJAX)
     */
    public function getPending(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $pending = $this->importService->getPendingPublications($user['id']);

        $this->jsonResponse(['success' => true, 'publications' => $pending]);
    }

    /**
     * Apply imported profile data to user account (AJAX)
     */
    public function applyProfile(): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            $this->jsonResponse(['error' => 'Invalid profile data. Please import again and retry.'], 400);
            return;
        }

        $updates = [];

        $userModel = new User();
        $fullUser = $userModel->findById((int) $user['id']);
        $personalInfo = [];
        if (!empty($fullUser['personal_info'])) {
            $decoded = json_decode((string) $fullUser['personal_info'], true);
            if (is_array($decoded)) {
                $personalInfo = $decoded;
            }
        }
        $personalInfoTouched = false;

        $allowedFields = ['full_name', 'title', 'affiliation', 'orcid_id', 'google_scholar_id'];
        foreach ($allowedFields as $field) {
            if (isset($data[$field]) && $data[$field] !== '') {
                $updates[$field] = trim($data[$field]);
            }
        }

        $personalInfoMap = [
            'full_name' => 'full_name',
            'title' => 'title',
            'affiliation' => 'affiliation',
            'email' => 'email',
            'website' => 'website',
            'orcid_id' => 'orcid',
            'google_scholar_id' => 'google_scholar',
        ];
        foreach ($personalInfoMap as $source => $target) {
            if (isset($data[$source]) && trim((string) $data[$source]) !== '') {
                $personalInfo[$target] = trim((string) $data[$source]);
                $personalInfoTouched = true;
            }
        }

        if ($personalInfoTouched) {
            $updates['personal_info'] = json_encode($personalInfo);
        }

        if (empty($updates)) {
            $this->jsonResponse(['error' => 'No profile fields were available to apply.'], 400);
            return;
        }

        try {
            $userModel->update($user['id'], $updates);
        } catch (\Throwable $e) {
            error_log('ProfileImportController.applyProfile: ' . $e->getMessage());
            $this->jsonResponse(['error' => 'Profile could not be updated. Please try again.'], 500);
            return;
        }

        try {
            EventLogger::log('profile_import_applied', [
                'updated_fields' => array_values(array_diff(array_keys($updates), ['personal_info'])),
                'personal_info_updated' => isset($updates['personal_info']),
            ]);
        } catch (\Throwable $e) {
            error_log('ProfileImportController.applyProfile event log: ' . $e->getMessage());
        }

        $updatedFields = array_values(array_diff(array_keys($updates), ['personal_info']));
        $this->jsonResponse([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'updated_fields' => $updatedFields,
            'personal_info_updated' => isset($updates['personal_info']),
        ]);
    }

    private function jsonResponse(array $data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
