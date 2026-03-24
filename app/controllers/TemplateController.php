<?php
/**
 * Template Controller
 */
class TemplateController
{
    private Template $templateModel;

    public function __construct()
    {
        $this->templateModel = new Template();
    }

    public function gallery(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $templates = $this->templateModel->getAvailableForUser($user['subscription_plan']);

        include TEMPLATE_PATH . '/templates/gallery.php';
    }

    public function preview(int $id): void
    {
        Auth::requireLogin();
        $template = $this->templateModel->findById($id);

        if (!$template) {
            $_SESSION['flash_error'] = 'Template not found.';
            header('Location: ' . APP_URL . '/templates');
            exit;
        }

        $sections = $this->templateModel->getSections($id);

        include TEMPLATE_PATH . '/templates/preview.php';
    }

    public function demo(int $id): void
    {
        Auth::requireLogin();
        $template = $this->templateModel->findById($id);

        if (!$template) {
            http_response_code(404);
            echo 'Template not found.';
            exit;
        }

        $latexService = new LatexService();
        $result = $latexService->generateDemoPDF($id);

        if (!$result['success']) {
            http_response_code(500);
            echo 'Failed to generate demo PDF.';
            exit;
        }

        $pdfPath = $result['pdf_path'];
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="demo_' . $template['slug'] . '.pdf"');
        header('Content-Length: ' . filesize($pdfPath));
        header('Cache-Control: public, max-age=86400');
        readfile($pdfPath);
        exit;
    }
}
