<?php
/**
 * Admin Controller — Dashboard, User Management, Feature Management
 */
class AdminController
{
    /**
     * Admin Dashboard — statistics overview
     */
    public function dashboard(): void
    {
        Auth::requireAdmin();

        $db = Database::getInstance()->getConnection();

        // User stats
        $stats = [];
        $stats['total_users'] = (int) $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $stats['active_users'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE is_active = 1")->fetchColumn();
        $stats['users_free'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan = 'free'")->fetchColumn();
        $stats['users_pro'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan = 'pro'")->fetchColumn();
        $stats['users_enterprise'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan = 'enterprise'")->fetchColumn();

        // CV stats
        $stats['total_cvs'] = (int) $db->query("SELECT COUNT(*) FROM cv_profiles")->fetchColumn();
        $stats['total_entries'] = (int) $db->query("SELECT COUNT(*) FROM cv_entries")->fetchColumn();

        // Recent signups (last 7 days)
        $stats['recent_signups'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();

        // Recent logins (last 7 days)
        $stats['recent_logins'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();

        // Template usage
        $templateUsage = $db->query(
            "SELECT t.name, COUNT(cp.id) as cv_count
             FROM templates t
             LEFT JOIN cv_profiles cp ON cp.template_id = t.id
             GROUP BY t.id, t.name
             ORDER BY cv_count DESC"
        )->fetchAll();

        // Recent users (last 10)
        $recentUsers = $db->query(
            "SELECT id, email, username, full_name, subscription_plan, created_at, last_login_at
             FROM users ORDER BY created_at DESC LIMIT 10"
        )->fetchAll();

        // Publications stats
        $stats['total_publications'] = (int) $db->query("SELECT COUNT(*) FROM publications")->fetchColumn();

        // Google auth users
        $stats['google_users'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE google_id IS NOT NULL")->fetchColumn();

        // Ticket stats for nav badge
        $ticketModel = new Ticket();
        $ticketStats = $ticketModel->getStats();

        include TEMPLATE_PATH . '/admin/dashboard.php';
    }

    /**
     * User management — list all users
     */
    public function users(): void
    {
        Auth::requireAdmin();

        $db = Database::getInstance()->getConnection();

        $search = $_GET['search'] ?? '';
        $planFilter = $_GET['plan'] ?? '';

        $sql = "SELECT u.*, 
                (SELECT COUNT(*) FROM cv_profiles WHERE user_id = u.id) as cv_count
                FROM users u WHERE 1=1";
        $params = [];

        if ($search !== '') {
            $sql .= " AND (u.email LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        if ($planFilter !== '') {
            $sql .= " AND u.subscription_plan = ?";
            $params[] = $planFilter;
        }

        $sql .= " ORDER BY u.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        include TEMPLATE_PATH . '/admin/users.php';
    }

    /**
     * Update a user's plan (AJAX POST)
     */
    public function updateUserPlan(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $userId = (int) ($_POST['user_id'] ?? 0);
        $newPlan = $_POST['plan'] ?? '';

        if (!in_array($newPlan, ['free', 'pro', 'enterprise'])) {
            $_SESSION['flash_error'] = 'Invalid plan.';
            header('Location: ' . APP_URL . '/admin/users');
            exit;
        }

        $userModel = new User();
        $user = $userModel->findById($userId);

        if (!$user) {
            $_SESSION['flash_error'] = 'User not found.';
            header('Location: ' . APP_URL . '/admin/users');
            exit;
        }

        $userModel->update($userId, ['subscription_plan' => $newPlan]);

        $_SESSION['flash_success'] = 'Plan updated to ' . ucfirst($newPlan) . ' for ' . ($user['full_name'] ?: $user['username']);
        header('Location: ' . APP_URL . '/admin/users');
        exit;
    }

    /**
     * Toggle user active status
     */
    public function toggleUserStatus(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $userId = (int) ($_POST['user_id'] ?? 0);
        $userModel = new User();
        $user = $userModel->findById($userId);

        if (!$user) {
            $_SESSION['flash_error'] = 'User not found.';
            header('Location: ' . APP_URL . '/admin/users');
            exit;
        }

        // Don't allow deactivating yourself
        if ($userId === Auth::id()) {
            $_SESSION['flash_error'] = 'Cannot deactivate your own account.';
            header('Location: ' . APP_URL . '/admin/users');
            exit;
        }

        $newStatus = $user['is_active'] ? 0 : 1;
        $userModel->update($userId, ['is_active' => $newStatus]);

        $_SESSION['flash_success'] = ($user['full_name'] ?: $user['username']) . ' ' . ($newStatus ? 'activated' : 'deactivated');
        header('Location: ' . APP_URL . '/admin/users');
        exit;
    }

    /**
     * Feature management — matrix view
     */
    public function features(): void
    {
        Auth::requireAdmin();

        $featureModel = new Feature();
        $features = $featureModel->getAll();
        $grouped = $featureModel->getAllGrouped();
        $matrix = $featureModel->getMatrix();
        $plans = ['free', 'pro', 'enterprise'];

        include TEMPLATE_PATH . '/admin/features.php';
    }

    /**
     * Update feature flags (POST)
     */
    public function updateFeatures(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/features');
            exit;
        }

        $featureModel = new Feature();
        $features = $featureModel->getAll();
        $plans = ['free', 'pro', 'enterprise'];

        foreach ($features as $feature) {
            foreach ($plans as $plan) {
                $key = $plan . '_' . $feature['feature_key'];
                $enabled = isset($_POST['toggle'][$key]) ? true : false;
                $configValue = $_POST['config'][$key] ?? null;

                if ($configValue === '') {
                    $configValue = null;
                }

                $featureModel->updatePlanFeature($plan, $feature['feature_key'], $enabled, $configValue);
            }
        }

        $_SESSION['flash_success'] = 'Feature configuration updated.';
        header('Location: ' . APP_URL . '/admin/features');
        exit;
    }
}
