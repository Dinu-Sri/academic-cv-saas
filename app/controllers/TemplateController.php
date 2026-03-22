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
}
