<?php
/**
 * Dashboard Controller
 */
class DashboardController
{
    public function index(): void
    {
        Auth::requireLogin();

        // Phone-class devices use the dedicated mobile start/handoff flow.
        if (is_mobile_request()) {
            header('Location: ' . APP_URL . '/mobile-start');
            exit;
        }

        $user = Auth::user();
        $cvModel = new CVProfile();
        $cvs = $cvModel->findByUser($user['id']);

        $onboarding = [
            'create_cv' => count($cvs) > 0,
            'compile_pdf' => false,
            'download_pdf' => false,
        ];

        $db = Database::getInstance()->getConnection();
        $tableCheck = $db->query("SHOW TABLES LIKE 'user_events'");
        $trackingReady = (bool) $tableCheck->fetchColumn();

        if ($trackingReady) {
            $stmt = $db->prepare(
                "SELECT event_key FROM user_events
                 WHERE user_id = ? AND event_key IN ('pdf_compiled', 'pdf_downloaded')"
            );
            $stmt->execute([$user['id']]);
            $events = array_column($stmt->fetchAll(), 'event_key');
            $onboarding['compile_pdf'] = in_array('pdf_compiled', $events, true);
            $onboarding['download_pdf'] = in_array('pdf_downloaded', $events, true);
        } else {
            foreach ($cvs as $cv) {
                if (!empty($cv['last_compiled_at'])) {
                    $onboarding['compile_pdf'] = true;
                    break;
                }
            }
        }

        $showOnboarding = !($onboarding['create_cv'] && $onboarding['compile_pdf'] && $onboarding['download_pdf']);

        $templateModel = new Template();
        $templates = $templateModel->getAvailableForUser($user['subscription_plan']);
        $creditBalance = 0;
        try {
            $creditBalance = (new Credit())->balance((int) $user['id']);
        } catch (Throwable $e) {}

        include TEMPLATE_PATH . '/dashboard/index.php';
    }
}
