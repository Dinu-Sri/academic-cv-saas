<?php
/**
 * WebsiteController — owner-facing management of the user's academic website.
 *
 * Every user has exactly one auto-generated academic website (created lazily as
 * a draft on first visit). This controller lets the owner configure the slug,
 * template, visibility settings, publish/unpublish, preview, and read messages.
 */
class WebsiteController
{
    private AcademicWebsite $websiteModel;

    public function __construct()
    {
        $this->websiteModel = new AcademicWebsite();
    }

    /**
     * Management dashboard. Creates the draft website on first visit.
     */
    public function index(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $userId = (int) $user['id'];

        [$website, $created] = $this->websiteModel->ensureForUser($userId, $user);
        if ($created) {
            EventLogger::log('website_created', ['website_id' => (int) $website['id']]);
        }

        $fullUser = $this->fullUser($userId, $user);

        // CVs the user can attach as a downloadable PDF source.
        $cvs = (new CVProfile())->findByUser($userId);
        $cvOptions = [];
        foreach ($cvs as $cv) {
            $hasPdf = !empty($cv['pdf_path']) && is_file($cv['pdf_path']);
            $cvOptions[] = [
                'id'      => (int) $cv['id'],
                'title'   => trim((string) ($cv['name'] ?? '')) ?: ('CV #' . (int) $cv['id']),
                'has_pdf' => $hasPdf,
            ];
        }

        $viewModel = (new WebsiteDataBuilder())->build($website, $fullUser);
        $currentAvatarUrl = trim((string) ($fullUser['avatar_url'] ?? ''));
        $unreadMessages = (new WebsiteContactMessage())->unreadCount($userId);
        $publicUrl = APP_URL . '/u/' . $website['slug'];

        $pageTitle = 'My Academic Website';
        ob_start();
        include TEMPLATE_PATH . '/website/manage.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/main.php';
    }

    /**
     * Persist settings (slug, template, headline, visibility, source CV).
     */
    public function saveSettings(): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->json(['error' => 'Invalid token.'], 403);
            return;
        }

        $user = Auth::user();
        $userId = (int) $user['id'];
        [$website] = $this->websiteModel->ensureForUser($userId, $user);

        $fields = [];

        // Slug
        $slug = AcademicWebsite::slugify((string) ($_POST['slug'] ?? ''));
        if ($slug !== '' && $slug !== $website['slug']) {
            if (!AcademicWebsite::isValidSlug($slug)) {
                $this->json(['error' => 'Link must be 3–150 lowercase letters, numbers or hyphens.'], 422);
                return;
            }
            if (!$this->websiteModel->isSlugAvailable($slug, $userId)) {
                $this->json(['error' => 'That link is already taken. Please choose another.'], 409);
                return;
            }
            $fields['slug'] = $slug;
        }

        // Template
        $template = strtolower(trim((string) ($_POST['template_key'] ?? '')));
        $allowedTemplates = AcademicWebsite::ALLOWED_TEMPLATES;
        if ($template !== '' && in_array($template, $allowedTemplates, true)) {
            $fields['template_key'] = $template;
        }

        // Headline override
        $headline = trim((string) ($_POST['headline'] ?? ''));
        $fields['headline'] = $headline !== '' ? mb_substr($headline, 0, 255) : null;

        // Public profile image URL. Google users are prefilled automatically,
        // but the owner can override it here.
        $avatarUrl = trim((string) ($_POST['avatar_url'] ?? ''));
        if ($avatarUrl !== '') {
            $avatarUrl = mb_substr($avatarUrl, 0, 1000);
            if (filter_var($avatarUrl, FILTER_VALIDATE_URL) === false
                || !preg_match('~^https?://~i', $avatarUrl)) {
                $this->json(['error' => 'Profile image must be a valid http or https URL.'], 422);
                return;
            }
        } else {
            $avatarUrl = null;
        }
        (new User())->update($userId, ['avatar_url' => $avatarUrl]);

        // Site mode (single/multi)
        $siteMode = strtolower(trim((string) ($_POST['site_mode'] ?? '')));
        if (in_array($siteMode, ['single', 'multi'], true)) {
            $fields['site_mode'] = $siteMode;
            if ($siteMode === 'multi') {
                $fields['nav_config'] = AcademicWebsite::defaultNavConfig();
            }
        }

        // Source CV (0/empty = auto)
        $sourceCvId = (int) ($_POST['source_cv_id'] ?? 0);
        if ($sourceCvId > 0) {
            $cv = (new CVProfile())->findById($sourceCvId);
            $fields['source_cv_id'] = ($cv && (int) $cv['user_id'] === $userId) ? $sourceCvId : null;
        } else {
            $fields['source_cv_id'] = null;
        }

        // Section visibility
        $sectionVisibility = AcademicWebsite::defaultSectionVisibility();
        $postedSections = $_POST['section_visibility'] ?? [];
        foreach ($sectionVisibility as $key => $default) {
            $sectionVisibility[$key] = !empty($postedSections[$key]);
        }
        $fields['section_visibility'] = $sectionVisibility;

        // Field (sensitive) visibility
        $fieldVisibility = AcademicWebsite::defaultFieldVisibility();
        $postedFields = $_POST['field_visibility'] ?? [];
        foreach ($fieldVisibility as $key => $default) {
            $fieldVisibility[$key] = !empty($postedFields[$key]);
        }
        $fields['field_visibility'] = $fieldVisibility;

        $this->websiteModel->updateSettings($userId, $fields);

        $updated = $this->websiteModel->findByUser($userId);
        $this->json([
            'success'    => true,
            'message'    => 'Website settings saved.',
            'avatar_url' => $avatarUrl ?? '',
            'slug'       => $updated['slug'],
            'public_url' => APP_URL . '/u/' . $updated['slug'],
        ]);
    }

    public function publish(): void
    {
        $this->setStatus('published', 'website_published', 'Your academic website is now live.');
    }

    public function unpublish(): void
    {
        $this->setStatus('draft', 'website_unpublished', 'Your academic website is now a private draft.');
    }

    private function setStatus(string $status, string $eventKey, string $message): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $this->json(['error' => 'Invalid token.'], 403);
            return;
        }
        $user = Auth::user();
        $userId = (int) $user['id'];
        [$website] = $this->websiteModel->ensureForUser($userId, $user);

        $this->websiteModel->setStatus($userId, $status);
        EventLogger::log($eventKey, ['website_id' => (int) $website['id']]);

        $this->json([
            'success'    => true,
            'status'     => $status,
            'message'    => $message,
            'public_url' => APP_URL . '/u/' . $website['slug'],
        ]);
    }

    /**
     * Owner preview of the public template, even while in draft.
     */
    public function preview(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $userId = (int) $user['id'];
        [$website] = $this->websiteModel->ensureForUser($userId, $user);

        $fullUser = $this->fullUser($userId, $user);
        $site = (new WebsiteDataBuilder())->build($website, $fullUser);

        $isPreview = true;
        $templateKey = $website['template_key'] ?? 'elegant';
        $headline = trim((string) ($website['headline'] ?? ''));
        $publicUrl = APP_URL . '/u/' . $website['slug'];
        $status = $website['status'];
        $siteMode = $website['site_mode'] ?? 'single';
        $navConfig = is_array($website['nav_config'] ?? null) ? $website['nav_config'] : AcademicWebsite::defaultNavConfig();
        $currentPage = 'about';
        $stats = $site['stats'] ?? [];

        include TEMPLATE_PATH . '/website/public.php';
    }

    /**
     * Contact-message inbox.
     */
    public function messages(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $userId = (int) $user['id'];

        $messageModel = new WebsiteContactMessage();
        $messages = $messageModel->findByUser($userId, 200);
        $messageModel->markAllRead($userId);

        $pageTitle = 'Website Messages';
        ob_start();
        include TEMPLATE_PATH . '/website/messages.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/main.php';
    }

    // -- Helpers -------------------------------------------------------------

    private function fullUser(int $userId, array $fallback): array
    {
        $full = (new User())->findById($userId);
        return $full ?: $fallback;
    }

    private function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($payload);
    }
}
