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
        $stats['users_starter'] = (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan = 'starter'")->fetchColumn();
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

        if (!in_array($newPlan, ['free', 'starter', 'pro', 'enterprise'])) {
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
        $plans = ['free', 'starter', 'pro', 'enterprise'];

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
        $plans = ['free', 'starter', 'pro', 'enterprise'];

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

    /**
     * Admin Settings page — PayHere payment gateway configuration
     */
    public function settings(): void
    {
        Auth::requireAdmin();

        $settingsModel = new SiteSetting();
        $settings = $settingsModel->getPayHereConfig();

        include TEMPLATE_PATH . '/admin/settings.php';
    }

    /**
     * Update admin settings (POST)
     */
    public function updateSettings(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/settings');
            exit;
        }

        $settingsModel = new SiteSetting();
        $settingsModel->setMultiple([
            'payhere_merchant_id' => trim($_POST['payhere_merchant_id'] ?? ''),
            'payhere_merchant_secret' => trim($_POST['payhere_merchant_secret'] ?? ''),
            'payhere_app_id' => trim($_POST['payhere_app_id'] ?? ''),
            'payhere_app_secret' => trim($_POST['payhere_app_secret'] ?? ''),
            'payhere_sandbox' => isset($_POST['payhere_sandbox']) ? '1' : '0',
            'payhere_currency' => $_POST['payhere_currency'] ?? 'USD',
        ]);

        $_SESSION['flash_success'] = 'Payment settings saved successfully.';
        header('Location: ' . APP_URL . '/admin/settings');
        exit;
    }

    /**
     * Payment history — list all payments with search/filter
     */
    public function payments(): void
    {
        Auth::requireAdmin();

        $db = Database::getInstance()->getConnection();

        $search = $_GET['search'] ?? '';
        $statusFilter = $_GET['status'] ?? '';

        $sql = "SELECT p.*, u.email, u.username, u.full_name
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE 1=1";
        $params = [];

        if ($search !== '') {
            $sql .= " AND (u.email LIKE ? OR p.transaction_id LIKE ? OR p.payhere_payment_id LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        if ($statusFilter !== '') {
            $sql .= " AND p.status = ?";
            $params[] = $statusFilter;
        }

        $sql .= " ORDER BY p.created_at DESC LIMIT 200";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $payments = $stmt->fetchAll();

        // Payment stats
        $paymentStats = [];
        $paymentStats['total_revenue'] = (float) $db->query("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed'")->fetchColumn();
        $paymentStats['total_completed'] = (int) $db->query("SELECT COUNT(*) FROM payments WHERE status = 'completed'")->fetchColumn();
        $paymentStats['total_pending'] = (int) $db->query("SELECT COUNT(*) FROM payments WHERE status = 'pending'")->fetchColumn();
        $paymentStats['total_refunded'] = (float) $db->query("SELECT COALESCE(SUM(refund_amount), 0) FROM payments WHERE refund_status = 'refunded'")->fetchColumn();

        include TEMPLATE_PATH . '/admin/payments.php';
    }

    /**
     * Process refund via PayHere Refund API (POST)
     */
    public function refund(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }

        $paymentId = (int) ($_POST['payment_id'] ?? 0);
        $refundNote = trim($_POST['refund_note'] ?? '');
        $downgradeUser = isset($_POST['downgrade_user']);

        $db = Database::getInstance()->getConnection();

        // Find the payment
        $stmt = $db->prepare("SELECT * FROM payments WHERE id = ?");
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();

        if (!$payment) {
            $_SESSION['flash_error'] = 'Payment not found.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }

        if ($payment['status'] !== 'completed') {
            $_SESSION['flash_error'] = 'Can only refund completed payments.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }

        if (!empty($payment['refund_status'])) {
            $_SESSION['flash_error'] = 'This payment has already been refunded.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }

        if (empty($payment['payhere_payment_id'])) {
            $_SESSION['flash_error'] = 'No PayHere payment ID — cannot process refund.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }

        // Call PayHere Refund API
        $payhere = new PayHereService();
        $result = $payhere->refundPayment($payment['payhere_payment_id'], $refundNote ?: 'Admin refund');

        if ($result['success']) {
            // Update payment record
            $stmt = $db->prepare(
                "UPDATE payments SET refund_status = 'refunded', refund_amount = ?, refunded_at = NOW(), refund_note = ?, status = 'refunded' WHERE id = ?"
            );
            $stmt->execute([$payment['amount'], $refundNote, $paymentId]);

            // Optionally downgrade user
            if ($downgradeUser) {
                $userModel = new User();
                $userModel->update($payment['user_id'], [
                    'subscription_plan' => 'free',
                    'subscription_expires_at' => null,
                ]);
            }

            $payhere->log('Refund SUCCESS', ['payment_id' => $paymentId, 'payhere_id' => $payment['payhere_payment_id'], 'downgraded' => $downgradeUser]);

            $_SESSION['flash_success'] = 'Refund processed successfully.' . ($downgradeUser ? ' User downgraded to Free plan.' : '');
        } else {
            $payhere->log('Refund FAILED', ['payment_id' => $paymentId, 'error' => $result['message']]);

            // Mark as refund attempted but failed
            $stmt = $db->prepare(
                "UPDATE payments SET refund_status = 'failed', refund_note = ? WHERE id = ?"
            );
            $stmt->execute(['Refund failed: ' . $result['message'] . ($refundNote ? " | Note: $refundNote" : ''), $paymentId]);

            $_SESSION['flash_error'] = 'Refund failed: ' . $result['message'];
        }

        header('Location: ' . APP_URL . '/admin/payments');
        exit;
    }
}
