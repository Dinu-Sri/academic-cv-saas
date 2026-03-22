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
        $updates = [];

        $allowedFields = ['full_name', 'title', 'affiliation', 'orcid_id', 'google_scholar_id'];
        foreach ($allowedFields as $field) {
            if (isset($data[$field]) && $data[$field] !== '') {
                $updates[$field] = trim($data[$field]);
            }
        }

        if (!empty($updates)) {
            $userModel = new User();
            $userModel->update($user['id'], $updates);
            // Refresh session
            $_SESSION['user'] = array_merge($user, $updates);
        }

        $this->jsonResponse(['success' => true, 'message' => 'Profile updated.']);
    }

    private function jsonResponse(array $data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
