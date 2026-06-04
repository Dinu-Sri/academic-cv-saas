<?php
/**
 * PublicWebsiteController — renders the public, unauthenticated academic website
 * at /u/{slug}, streams the optional CV download, and accepts contact-form
 * submissions (honeypot + IP rate-limit protected).
 */
class PublicWebsiteController
{
    private AcademicWebsite $websiteModel;

    /** Max contact submissions allowed per IP per hour. */
    private const CONTACT_RATE_LIMIT = 5;

    public function __construct()
    {
        $this->websiteModel = new AcademicWebsite();
    }

    /**
     * Public one-page website. Only published sites are visible.
     */
    public function show(string $slug): void
    {
        $website = $this->websiteModel->findBySlug($slug);
        if (!$website || $website['status'] !== 'published') {
            $this->notFound();
            return;
        }

        $owner = (new User())->findById((int) $website['user_id']);
        if (!$owner) {
            $this->notFound();
            return;
        }

        $site = (new WebsiteDataBuilder())->build($website, $owner);

        // In multi-page mode, show only the about-page sections.
        if (($website['site_mode'] ?? 'single') === 'multi') {
            $site = (new WebsiteDataBuilder())->buildForPage($website, $owner, 'about');
        }

        $this->websiteModel->incrementViews((int) $website['id']);
        EventLogger::log('website_viewed', ['website_id' => (int) $website['id']]);

        $isPreview = false;
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
     * Stream the owner's selected CV PDF if the download is enabled.
     */
    public function downloadCv(string $slug): void
    {
        $website = $this->websiteModel->findBySlug($slug);
        if (!$website || $website['status'] !== 'published') {
            $this->notFound();
            return;
        }

        $owner = (new User())->findById((int) $website['user_id']);
        if (!$owner) {
            $this->notFound();
            return;
        }

        $site = (new WebsiteDataBuilder())->build($website, $owner);
        if (empty($site['download']['available']) || empty($site['download']['cv_id'])) {
            $this->notFound();
            return;
        }

        $cv = (new CVProfile())->findById((int) $site['download']['cv_id']);
        if (!$cv || (int) $cv['user_id'] !== (int) $website['user_id']
            || empty($cv['pdf_path']) || !is_file($cv['pdf_path'])) {
            $this->notFound();
            return;
        }

        EventLogger::log('cv_download_clicked', ['website_id' => (int) $website['id']]);

        $name = trim((string) ($owner['full_name'] ?? '')) ?: 'cv';
        $fileName = preg_replace('/[^a-zA-Z0-9_\-]+/', '_', $name) . '_CV.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . filesize($cv['pdf_path']));
        header('Cache-Control: private, max-age=0, must-revalidate');
        readfile($cv['pdf_path']);
        exit;
    }

    /**
     * Multi-page: publications-only page.
     */
    public function publications(string $slug): void
    {
        $this->renderMultiPage($slug, 'publications');
    }

    /**
     * Multi-page: teaching page.
     */
    public function teaching(string $slug): void
    {
        $this->renderMultiPage($slug, 'teaching');
    }

    /**
     * Multi-page: contact page (standalone contact form).
     */
    public function contactPage(string $slug): void
    {
        $this->renderMultiPage($slug, 'contact');
    }

    /**
     * Render a specific page in multi-page mode. Falls back to home if site is
     * in single mode or the requested page is not enabled.
     */
    private function renderMultiPage(string $slug, string $page): void
    {
        $website = $this->websiteModel->findBySlug($slug);
        if (!$website || $website['status'] !== 'published') {
            $this->notFound();
            return;
        }

        // If site is single mode, redirect to main page.
        if (($website['site_mode'] ?? 'single') !== 'multi') {
            header('Location: ' . APP_URL . '/u/' . rawurlencode($slug));
            exit;
        }

        // Check if this page is enabled in nav_config.
        $navConfig = is_array($website['nav_config'] ?? null) ? $website['nav_config'] : AcademicWebsite::defaultNavConfig();
        if (empty($navConfig[$page])) {
            $this->notFound();
            return;
        }

        $owner = (new User())->findById((int) $website['user_id']);
        if (!$owner) {
            $this->notFound();
            return;
        }

        $site = (new WebsiteDataBuilder())->build($website, $owner);
        $pageSite = (new WebsiteDataBuilder())->buildForPage($website, $owner, $page);

        $isPreview = false;
        $templateKey = $website['template_key'] ?? 'elegant';
        $headline = trim((string) ($website['headline'] ?? ''));
        $publicUrl = APP_URL . '/u/' . $website['slug'];
        $status = $website['status'];
        $siteMode = $website['site_mode'] ?? 'multi';
        $currentPage = $page;
        $stats = $pageSite['stats'] ?? [];
        $site = $pageSite;

        include TEMPLATE_PATH . '/website/public.php';
    }

    /**
     * Handle a public contact-form submission.
     */
    public function submitContact(string $slug): void
    {
        $website = $this->websiteModel->findBySlug($slug);
        if (!$website || $website['status'] !== 'published') {
            $this->contactRedirect($slug, 'error', 'This website is not available.');
            return;
        }

        // Contact form must be enabled.
        if (empty($website['section_visibility']['contact_form'])) {
            $this->contactRedirect($slug, 'error', 'Contact form is disabled.');
            return;
        }

        // Honeypot: a filled hidden field means a bot — silently succeed.
        if (trim((string) ($_POST['website'] ?? '')) !== '') {
            $this->contactRedirect($slug, 'success', 'Thanks! Your message has been sent.');
            return;
        }

        $messageModel = new WebsiteContactMessage();
        $ipHash = $this->ipHash();
        $since = (new DateTime('-1 hour'))->format('Y-m-d H:i:s');
        if ($messageModel->recentCountByIp($ipHash, $since) >= self::CONTACT_RATE_LIMIT) {
            $this->contactRedirect($slug, 'error', 'Too many messages sent. Please try again later.');
            return;
        }

        $name    = trim((string) ($_POST['visitor_name'] ?? ''));
        $email   = trim((string) ($_POST['visitor_email'] ?? ''));
        $subject = trim((string) ($_POST['subject'] ?? ''));
        $message = trim((string) ($_POST['message'] ?? ''));

        if ($name === '' || $email === '' || $message === '') {
            $this->contactRedirect($slug, 'error', 'Please fill in your name, email and message.');
            return;
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $this->contactRedirect($slug, 'error', 'Please enter a valid email address.');
            return;
        }

        $name    = mb_substr($name, 0, 150);
        $email   = mb_substr($email, 0, 255);
        $subject = mb_substr($subject, 0, 255);
        $message = mb_substr($message, 0, 5000);

        $messageModel->create([
            'website_id'    => (int) $website['id'],
            'user_id'       => (int) $website['user_id'],
            'visitor_name'  => $name,
            'visitor_email' => $email,
            'subject'       => $subject,
            'message'       => $message,
            'ip_hash'       => $ipHash,
        ]);

        $owner = (new User())->findById((int) $website['user_id']);
        if ($owner && !empty($owner['email'])) {
            try {
                EmailService::sendContactNotification(
                    (string) $owner['email'],
                    (string) ($owner['full_name'] ?? 'there'),
                    $name,
                    $email,
                    $subject,
                    $message,
                    APP_URL . '/u/' . $website['slug']
                );
            } catch (Throwable $e) {
                // Delivery failure must not block the visitor — message is stored.
            }
        }

        EventLogger::log('contact_form_submitted', ['website_id' => (int) $website['id']]);
        $this->contactRedirect($slug, 'success', 'Thanks! Your message has been sent.');
    }

    // -- Helpers -------------------------------------------------------------

    private function ipHash(): string
    {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip === '') {
            return '';
        }
        return hash('sha256', $ip . '|' . (defined('JWT_SECRET') ? JWT_SECRET : ''));
    }

    private function contactRedirect(string $slug, string $status, string $message): void
    {
        $url = APP_URL . '/u/' . rawurlencode($slug)
            . '?contact=' . $status . '#contact';
        $_SESSION['website_contact_flash'] = ['status' => $status, 'message' => $message];
        header('Location: ' . $url);
        exit;
    }

    private function notFound(): void
    {
        http_response_code(404);
        $pageTitle = 'Page not found';
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>Not found</title>'
            . '<style>body{font-family:Inter,system-ui,sans-serif;background:#f8f9fa;color:#1B2A4A;'
            . 'display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}'
            . '.box{padding:2rem}h1{font-size:3rem;margin:0;color:#2B6CB0}p{color:#555}'
            . 'a{color:#2B6CB0;text-decoration:none;font-weight:600}</style></head><body>'
            . '<div class="box"><h1>404</h1><p>This academic website could not be found.</p>'
            . '<p><a href="' . htmlspecialchars(APP_URL, ENT_QUOTES, 'UTF-8') . '">Go to '
            . htmlspecialchars(defined('APP_NAME') ? APP_NAME : 'home', ENT_QUOTES, 'UTF-8')
            . '</a></p></div></body></html>';
        exit;
    }
}
