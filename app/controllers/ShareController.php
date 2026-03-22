<?php
/**
 * Share Controller - Public CV sharing with short links
 */
class ShareController
{
    private CVProfile $cvModel;
    private PDO $db;

    public function __construct()
    {
        $this->cvModel = new CVProfile();
        $this->db = Database::getInstance()->getConnection();
    }

    /**
     * Create or get share link for a CV (AJAX)
     */
    public function create(int $cvId): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->jsonResponse(['error' => 'Invalid token.'], 403);
            return;
        }
        $user = Auth::user();

        // Check feature access
        $featureModel = new Feature();
        if (!$featureModel->planHasFeature($user['subscription_plan'], 'cv_sharing')) {
            $this->jsonResponse(['error' => 'CV sharing is available on Pro and Enterprise plans.'], 403);
            return;
        }

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $profile = $this->cvModel->findById($cvId);

        // Check if PDF exists
        if (empty($profile['pdf_path']) || !file_exists($profile['pdf_path'])) {
            $this->jsonResponse(['error' => 'Please compile your CV first before sharing.'], 400);
            return;
        }

        // Check if share already exists
        $existing = $this->getShareByProfile($cvId);
        if ($existing) {
            $shareUrl = APP_URL . '/s/' . $existing['share_slug'];
            $this->jsonResponse([
                'success'    => true,
                'share_url'  => $shareUrl,
                'share_slug' => $existing['share_slug'],
                'is_active'  => (bool) $existing['is_active'],
                'view_count' => (int) $existing['view_count'],
                'created'    => false,
            ]);
            return;
        }

        // Generate academic-style slug from user's name
        $slug = $this->generateSlug($user, $profile);

        $stmt = $this->db->prepare(
            "INSERT INTO cv_shares (profile_id, user_id, share_slug) VALUES (?, ?, ?)"
        );
        $stmt->execute([$cvId, $user['id'], $slug]);

        $shareUrl = APP_URL . '/s/' . $slug;
        $this->jsonResponse([
            'success'    => true,
            'share_url'  => $shareUrl,
            'share_slug' => $slug,
            'is_active'  => true,
            'view_count' => 0,
            'created'    => true,
        ]);
    }

    /**
     * Toggle share link active/inactive (AJAX)
     */
    public function toggle(int $cvId): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->jsonResponse(['error' => 'Invalid token.'], 403);
            return;
        }
        $user = Auth::user();

        // Check feature access
        $featureModel = new Feature();
        if (!$featureModel->planHasFeature($user['subscription_plan'], 'cv_sharing')) {
            $this->jsonResponse(['error' => 'CV sharing is available on Pro and Enterprise plans.'], 403);
            return;
        }

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $share = $this->getShareByProfile($cvId);
        if (!$share) {
            $this->jsonResponse(['error' => 'No share link found.'], 404);
            return;
        }

        $newStatus = $share['is_active'] ? 0 : 1;
        $stmt = $this->db->prepare("UPDATE cv_shares SET is_active = ? WHERE id = ?");
        $stmt->execute([$newStatus, $share['id']]);

        $this->jsonResponse([
            'success'   => true,
            'is_active' => (bool) $newStatus,
        ]);
    }

    /**
     * Get share info for a CV (AJAX)
     */
    public function info(int $cvId): void
    {
        Auth::requireLogin();
        $user = Auth::user();

        // Check feature access
        $featureModel = new Feature();
        if (!$featureModel->planHasFeature($user['subscription_plan'], 'cv_sharing')) {
            // Auto-deactivate any existing share link
            $share = $this->getShareByProfile($cvId);
            if ($share && $share['is_active']) {
                $stmt = $this->db->prepare("UPDATE cv_shares SET is_active = 0 WHERE id = ?");
                $stmt->execute([$share['id']]);
            }
            $this->jsonResponse(['error' => 'CV sharing is available on Pro and Enterprise plans.'], 403);
            return;
        }

        if (!$this->cvModel->belongsToUser($cvId, $user['id'])) {
            $this->jsonResponse(['error' => 'CV not found.'], 404);
            return;
        }

        $share = $this->getShareByProfile($cvId);
        if (!$share) {
            $this->jsonResponse(['success' => true, 'exists' => false]);
            return;
        }

        $this->jsonResponse([
            'success'    => true,
            'exists'     => true,
            'share_url'  => APP_URL . '/s/' . $share['share_slug'],
            'share_slug' => $share['share_slug'],
            'is_active'  => (bool) $share['is_active'],
            'view_count' => (int) $share['view_count'],
        ]);
    }

    /**
     * Public view page — no auth required
     */
    public function view(string $slug): void
    {
        $share = $this->getShareBySlug($slug);

        if (!$share || !$share['is_active']) {
            http_response_code(404);
            $this->render404();
            return;
        }

        $profile = $this->cvModel->findById($share['profile_id']);
        if (!$profile || empty($profile['pdf_path']) || !file_exists($profile['pdf_path'])) {
            http_response_code(404);
            $this->render404();
            return;
        }

        // Get user info for OG meta tags
        $userModel = new User();
        $owner = $userModel->findById($share['user_id']);

        // Increment view count
        $stmt = $this->db->prepare(
            "UPDATE cv_shares SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ?"
        );
        $stmt->execute([$share['id']]);

        // Build OG metadata
        $personalInfo = $profile['personal_info'] ?? [];
        if (is_string($personalInfo)) {
            $personalInfo = json_decode($personalInfo, true) ?? [];
        }

        $ogTitle = ($personalInfo['full_name'] ?? $owner['full_name'] ?? 'Academic CV');
        $ogSubtitle = '';
        if (!empty($personalInfo['title'])) {
            $ogSubtitle .= $personalInfo['title'];
        }
        if (!empty($personalInfo['affiliation'])) {
            $ogSubtitle .= ($ogSubtitle ? ', ' : '') . $personalInfo['affiliation'];
        }
        if ($ogSubtitle) {
            $ogTitle .= ' — ' . $ogSubtitle;
        }

        $ogDescription = 'Academic Curriculum Vitae';
        if (!empty($personalInfo['title']) && !empty($personalInfo['affiliation'])) {
            $ogDescription = $personalInfo['title'] . ' at ' . $personalInfo['affiliation'];
        } elseif (!empty($personalInfo['affiliation'])) {
            $ogDescription = $personalInfo['affiliation'];
        }

        $fullName = $personalInfo['full_name'] ?? $owner['full_name'] ?? 'CV';
        $pdfUrl = APP_URL . '/s/' . $slug . '/pdf';

        $shareData = [
            'og_title'       => $ogTitle,
            'og_description' => $ogDescription,
            'full_name'      => $fullName,
            'title'          => $personalInfo['title'] ?? '',
            'affiliation'    => $personalInfo['affiliation'] ?? '',
            'pdf_url'        => $pdfUrl,
            'share_slug'     => $slug,
        ];

        include TEMPLATE_PATH . '/share/view.php';
    }

    /**
     * Serve the actual PDF file for shared link
     */
    public function servePdf(string $slug): void
    {
        $share = $this->getShareBySlug($slug);

        if (!$share || !$share['is_active']) {
            http_response_code(404);
            echo 'Not found.';
            return;
        }

        $profile = $this->cvModel->findById($share['profile_id']);
        if (!$profile || empty($profile['pdf_path']) || !file_exists($profile['pdf_path'])) {
            http_response_code(404);
            echo 'PDF not available.';
            return;
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $profile['name']) . '.pdf"');
        header('Content-Length: ' . filesize($profile['pdf_path']));
        header('Cache-Control: public, max-age=300');
        readfile($profile['pdf_path']);
        exit;
    }

    // --- Private helpers ---

    private function generateSlug(array $user, array $profile): string
    {
        $personalInfo = $profile['personal_info'] ?? [];
        if (is_string($personalInfo)) {
            $personalInfo = json_decode($personalInfo, true) ?? [];
        }

        // Use full name from personal info or user record
        $name = $personalInfo['full_name'] ?? $user['full_name'] ?? $user['username'] ?? 'user';

        // Create slug: "dinu-sri-madhusanka" style
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
        $slug = preg_replace('/[\s\-]+/', '-', $slug);
        $slug = trim($slug, '-');

        if (empty($slug)) {
            $slug = 'cv-' . substr(md5($user['id'] . time()), 0, 6);
        }

        // Ensure uniqueness
        $baseSlug = $slug;
        $counter = 1;
        while ($this->slugExists($slug)) {
            $counter++;
            $slug = $baseSlug . '-' . $counter;
        }

        return $slug;
    }

    private function slugExists(string $slug): bool
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM cv_shares WHERE share_slug = ?");
        $stmt->execute([$slug]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function getShareByProfile(int $profileId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM cv_shares WHERE profile_id = ?");
        $stmt->execute([$profileId]);
        return $stmt->fetch() ?: null;
    }

    private function getShareBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM cv_shares WHERE share_slug = ?");
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    private function jsonResponse(array $data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    private function render404(): void
    {
        echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title>'
            . '<style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}'
            . '.e{text-align:center}h1{font-size:72px;font-weight:700;color:#ccc;margin:0}p{font-size:18px;color:#666;margin:12px 0}</style>'
            . '</head><body><div class="e"><h1>404</h1><p>This CV is not available.</p></div></body></html>';
    }
}
