<?php
/**
 * Settings Controller — User CV generation settings
 */
class SettingsController
{
    private User $userModel;

    public function __construct()
    {
        $this->userModel = new User();
    }

    public function index(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $settings = $this->userModel->getCvSettings($user['id']);

        $pageTitle = 'Settings';
        include TEMPLATE_PATH . '/settings/index.php';
    }

    public function update(): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request.';
            header('Location: ' . APP_URL . '/settings');
            exit;
        }

        $user = Auth::user();

        $allowedPageSizes = ['A4', 'Letter', 'Legal'];
        $allowedFonts = ['serif', 'sans'];
        $allowedFontSizes = ['10', '11', '12'];
        $allowedLineSpacing = ['compact', 'normal', 'relaxed'];
        $allowedDateFormats = ['F Y', 'M Y', 'm/Y', 'Y'];

        $settings = [
            'page_size'         => in_array($_POST['page_size'] ?? '', $allowedPageSizes) ? $_POST['page_size'] : 'A4',
            'margin_top'        => $this->sanitizeMargin($_POST['margin_top'] ?? '1in'),
            'margin_bottom'     => $this->sanitizeMargin($_POST['margin_bottom'] ?? '1in'),
            'margin_left'       => $this->sanitizeMargin($_POST['margin_left'] ?? '1in'),
            'margin_right'      => $this->sanitizeMargin($_POST['margin_right'] ?? '1in'),
            'font_family'       => in_array($_POST['font_family'] ?? '', $allowedFonts) ? $_POST['font_family'] : 'serif',
            'font_size'         => in_array($_POST['font_size'] ?? '', $allowedFontSizes) ? $_POST['font_size'] : '11',
            'line_spacing'      => in_array($_POST['line_spacing'] ?? '', $allowedLineSpacing) ? $_POST['line_spacing'] : 'normal',
            'show_page_numbers' => isset($_POST['show_page_numbers']),
            'show_last_updated' => isset($_POST['show_last_updated']),
            'date_format'       => in_array($_POST['date_format'] ?? '', $allowedDateFormats) ? $_POST['date_format'] : 'F Y',
        ];

        $this->userModel->updateCvSettings($user['id'], $settings);

        // Clear cached demo PDFs so previews regenerate with new settings
        $demoDir = STORAGE_PATH . '/demos';
        if (is_dir($demoDir)) {
            foreach (glob($demoDir . '/demo_*.pdf') as $f) {
                @unlink($f);
            }
        }

        $_SESSION['flash_success'] = 'Settings saved successfully.';
        header('Location: ' . APP_URL . '/settings');
        exit;
    }

    private function sanitizeMargin(string $value): string
    {
        $value = trim($value);
        if (preg_match('/^\d+(\.\d+)?\s*(in|cm|mm)$/', $value)) {
            return $value;
        }
        return '1in';
    }
}
