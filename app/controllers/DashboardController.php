<?php
/**
 * Dashboard Controller
 */
class DashboardController
{
    public function index(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $cvModel = new CVProfile();
        $cvs = $cvModel->findByUser($user['id']);

        $templateModel = new Template();
        $templates = $templateModel->getAvailableForUser($user['subscription_plan']);

        include TEMPLATE_PATH . '/dashboard/index.php';
    }
}
