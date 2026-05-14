<?php
/**
 * MarketingController — Public marketing pages (no auth required)
 */
class MarketingController
{
    public function home(): void
    {
        // Authenticated users go to dashboard
        if (Auth::check()) {
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        $metaTitle       = 'Academic CV Builder for Researchers & Professors';
        $metaDescription = 'Build professional academic CVs rendered through a real LaTeX engine. Import from ORCID & Google Scholar. 18+ academic sections, 6 beautiful templates. Free forever.';
        $canonicalUrl    = APP_URL;
        $activeNav       = 'home';

        $structuredData = SchemaService::render([
            SchemaService::organization(),
            SchemaService::webSite(),
            SchemaService::softwareApplication(),
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/home.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function pricing(): void
    {
        $metaTitle       = 'Pricing — CVScholar Credits';
        $metaDescription = 'Start with free CVScholar credits. Buy 250 credits for $5 when you need more PDF compiles or PDF import applies.';
        $canonicalUrl    = APP_URL . '/pricing';
        $activeNav       = 'pricing';

        $faqs = [
            ['question' => 'Is CVScholar really free to start?', 'answer' => 'Yes. New users receive 50 credits to start building, importing, compiling, and testing without a subscription.'],
            ['question' => 'How much do credits cost?', 'answer' => 'A credit pack costs $5 and adds 250 credits to your account. Purchases are one-time and stackable.'],
            ['question' => 'When are credits used?', 'answer' => 'A successful PDF compile uses 1 credit. Applying details from a PDF import uses 3 credits. ORCID and Google Scholar publication imports remain free.'],
            ['question' => 'Do credits expire?', 'answer' => 'No. Purchased credits stay on your account until you use them.'],
            ['question' => 'What payment methods do you accept?', 'answer' => 'Payments are processed securely through PayHere.'],
            ['question' => 'What makes CVScholar different from other CV builders?', 'answer' => 'CVScholar is built exclusively for academics. We render CV PDFs through a real LaTeX engine, support ORCID/Google Scholar import, include academic sections, and offer templates designed for scholarly careers.'],
        ];

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl),
            SchemaService::faqPage($faqs),
            SchemaService::itemList([
                ['name' => 'Free Starter Credits', 'description' => '50 credits included for new users'],
                ['name' => 'Credit Pack', 'description' => '250 credits for $5, one-time and stackable'],
            ], 'CVScholar Credit Pricing'),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/pricing.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function contact(): void
    {
        $metaTitle       = 'Contact Us — CVScholar Support';
        $metaDescription = 'Have questions about CVScholar? Get in touch with our team. We\'re here to help researchers, professors, and PhD students build better academic CVs.';
        $canonicalUrl    = APP_URL . '/contact';
        $activeNav       = 'contact';

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl, 'ContactPage'),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/contact.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function templateDemo(int $id): void
    {
        $templateModel = new Template();
        $template = $templateModel->findById($id);

        if (!$template || empty($template['is_active'])) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Template not found.']);
            exit;
        }

        $renderer = new LatexRenderer();
        $result = $renderer->generateDemoPDF($id);

        if (empty($result['success']) || empty($result['pdf_path']) || !is_file($result['pdf_path'])) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to generate production LaTeX demo PDF.']);
            exit;
        }

        header('Content-Type: application/json');
        echo json_encode([
            'pdf_base64' => base64_encode((string) file_get_contents($result['pdf_path'])),
            'engine' => $result['engine'] ?? 'xelatex',
            'cached' => !empty($result['cached']),
        ]);
        exit;
    }

    public function contactSubmit(): void
    {
        // CSRF check
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid form submission. Please try again.';
            header('Location: ' . APP_URL . '/contact');
            exit;
        }

        $name    = trim($_POST['name'] ?? '');
        $email   = trim($_POST['email'] ?? '');
        $subject = trim($_POST['subject'] ?? '');
        $message = trim($_POST['message'] ?? '');

        // Basic validation
        if (!$name || !$email || !$subject || !$message) {
            $_SESSION['flash_error'] = 'Please fill in all fields.';
            header('Location: ' . APP_URL . '/contact');
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $_SESSION['flash_error'] = 'Please enter a valid email address.';
            header('Location: ' . APP_URL . '/contact');
            exit;
        }

        // Store as a support ticket (source: website)
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            'INSERT INTO support_tickets (user_id, subject, status, created_at) VALUES (NULL, :subject, :status, NOW())'
        );
        $stmt->execute([
            ':subject' => '[Website] ' . $subject,
            ':status'  => 'open',
        ]);
        $ticketId = $db->lastInsertId();

        // Add the message as first reply
        $body = "From: {$name} <{$email}>\n\n{$message}";
        $stmt = $db->prepare(
            'INSERT INTO ticket_replies (ticket_id, sender, message, created_at) VALUES (:tid, :sender, :msg, NOW())'
        );
        $stmt->execute([
            ':tid'    => $ticketId,
            ':sender' => 'user',
            ':msg'    => $body,
        ]);

        $_SESSION['flash_success'] = 'Thank you! Your message has been sent. We\'ll get back to you soon.';
        header('Location: ' . APP_URL . '/contact');
        exit;
    }

    public function privacy(): void
    {
        $metaTitle       = 'Privacy Policy';
        $metaDescription = 'CVScholar privacy policy. Learn how we collect, use, and protect your personal information when you use our academic CV builder.';
        $canonicalUrl    = APP_URL . '/privacy';
        $activeNav       = '';

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/privacy.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function terms(): void
    {
        $metaTitle       = 'Terms of Use';
        $metaDescription = 'CVScholar terms of use. Review the terms and conditions governing your use of our academic CV builder platform.';
        $canonicalUrl    = APP_URL . '/terms';
        $activeNav       = '';

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/terms.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function refundPolicy(): void
    {
        $metaTitle       = 'Refund Policy';
        $metaDescription = 'CVScholar refund policy. Learn about our refund, cancellation, and subscription billing policies for paid plans.';
        $canonicalUrl    = APP_URL . '/refund-policy';
        $activeNav       = '';

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/marketing/refund-policy.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }
}
