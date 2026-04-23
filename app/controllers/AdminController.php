<?php
/**
 * Admin Controller — Dashboard, User Management, Feature Management
 */
class AdminController
{
    /**
     * Accept CSRF token from legacy and new field/header names.
     */
    private function requestToken(?array $jsonBody = null): string
    {
        $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        return (string) (
            $_POST['_token']
            ?? $_POST['csrf_token']
            ?? ($jsonBody['_token'] ?? null)
            ?? ($jsonBody['csrf_token'] ?? null)
            ?? $headerToken
            ?? ''
        );
    }

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
     * Retention dashboard — onboarding funnel and user activity segments
     */
    public function retention(): void
    {
        Auth::requireAdmin();

        $db = Database::getInstance()->getConnection();
        $period = (int) ($_GET['period'] ?? 30);
        $allowedPeriods = [7, 30, 90];
        if (!in_array($period, $allowedPeriods, true)) {
            $period = 30;
        }

        $trackingReady = false;
        $funnel = [
            'registered' => 0,
            'cv_created' => 0,
            'pdf_compiled' => 0,
            'pdf_downloaded' => 0,
        ];

        $segments = [
            'active' => 0,
            'dormant' => 0,
            'churned' => 0,
            'never_returned' => 0,
        ];

        $avgDaysToFirstCv = null;
        $zeroCvUsers = [];

        // Ticket stats for nav badge
        $ticketModel = new Ticket();
        $ticketStats = $ticketModel->getStats();

        // Check if event tracking migration is applied
        $tableCheck = $db->query("SHOW TABLES LIKE 'user_events'");
        $trackingReady = (bool) $tableCheck->fetchColumn();

        // Funnel metrics for selected period
        $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
        $stmt->execute([$period]);
        $funnel['registered'] = (int) $stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COUNT(DISTINCT user_id) FROM cv_profiles WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
        $stmt->execute([$period]);
        $funnel['cv_created'] = (int) $stmt->fetchColumn();

        if ($trackingReady) {
            $stmt = $db->prepare(
                "SELECT COUNT(DISTINCT user_id) FROM user_events
                 WHERE event_key = 'pdf_compiled' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)"
            );
            $stmt->execute([$period]);
            $funnel['pdf_compiled'] = (int) $stmt->fetchColumn();

            $stmt = $db->prepare(
                "SELECT COUNT(DISTINCT user_id) FROM user_events
                 WHERE event_key = 'pdf_downloaded' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)"
            );
            $stmt->execute([$period]);
            $funnel['pdf_downloaded'] = (int) $stmt->fetchColumn();
        }

        // User activity segments
        $segments['active'] = (int) $db->query(
            "SELECT COUNT(*) FROM users WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )->fetchColumn();

        $segments['dormant'] = (int) $db->query(
            "SELECT COUNT(*) FROM users
             WHERE last_login_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
             AND last_login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )->fetchColumn();

        $segments['churned'] = (int) $db->query(
            "SELECT COUNT(*) FROM users WHERE last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )->fetchColumn();

        $segments['never_returned'] = (int) $db->query(
            "SELECT COUNT(*) FROM users
             WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
             AND (
                 last_login_at IS NULL
                 OR TIMESTAMPDIFF(MINUTE, created_at, last_login_at) <= 5
             )"
        )->fetchColumn();

        // Average days from signup to first CV
        $avgDaysToFirstCv = $db->query(
            "SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, u.created_at, first_cv.first_created_at)) / 24, 2)
             FROM users u
             INNER JOIN (
                 SELECT user_id, MIN(created_at) AS first_created_at
                 FROM cv_profiles
                 GROUP BY user_id
             ) AS first_cv ON first_cv.user_id = u.id"
        )->fetchColumn();

        // Latest users with zero CVs (highest-risk drop-off)
        $zeroCvUsers = $db->query(
            "SELECT u.id, u.email, u.username, u.full_name, u.subscription_plan, u.created_at, u.last_login_at
             FROM users u
             LEFT JOIN cv_profiles cp ON cp.user_id = u.id
             WHERE cp.id IS NULL
             ORDER BY u.created_at DESC
             LIMIT 25"
        )->fetchAll();

        include TEMPLATE_PATH . '/admin/retention.php';
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
        $settings = $settingsModel->getMultiple([
            'payhere_merchant_id', 'payhere_merchant_secret',
            'payhere_app_id', 'payhere_app_secret',
            'payhere_sandbox', 'payhere_currency',
            'pricing_starter_onetime', 'pricing_pro_monthly', 'pricing_pro_annual',
            'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_username',
            'smtp_password', 'smtp_from_address', 'smtp_from_name', 'smtp_encryption',
            'behavior_tracking_enabled', 'behavior_tracking_mode', 'behavior_retention_days',
            'behavior_mask_inputs', 'behavior_sampling_rate',
        ]);

        include TEMPLATE_PATH . '/admin/settings.php';
    }

    /**
     * Update admin settings (POST)
     */
    public function updateSettings(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($this->requestToken())) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/settings');
            exit;
        }

        $settingsModel = new SiteSetting();

        $form = $_POST['_form'] ?? 'payhere';

        if ($form === 'smtp') {
            $settingsModel->setMultiple([
                'smtp_enabled'      => isset($_POST['smtp_enabled']) ? '1' : '0',
                'smtp_host'         => trim($_POST['smtp_host'] ?? ''),
                'smtp_port'         => (string) max(1, (int) ($_POST['smtp_port'] ?? 465)),
                'smtp_username'     => trim($_POST['smtp_username'] ?? ''),
                'smtp_from_address' => trim($_POST['smtp_from_address'] ?? ''),
                'smtp_from_name'    => trim($_POST['smtp_from_name'] ?? 'CVScholar'),
                'smtp_encryption'   => in_array($_POST['smtp_encryption'] ?? '', ['ssl', 'tls', 'none']) ? $_POST['smtp_encryption'] : 'ssl',
            ]);
            if (!empty($_POST['smtp_password'])) {
                $settingsModel->set('smtp_password', trim($_POST['smtp_password']));
            }
            $_SESSION['flash_success'] = 'SMTP settings saved successfully.';
        } elseif ($form === 'behavior') {
            $settingsModel->setMultiple([
                'behavior_tracking_enabled' => isset($_POST['behavior_tracking_enabled']) ? '1' : '0',
                'behavior_tracking_mode'    => 'timeline',
                'behavior_retention_days'   => (string) max(1, min((int) ($_POST['behavior_retention_days'] ?? 180), 3650)),
                'behavior_mask_inputs'      => isset($_POST['behavior_mask_inputs']) ? '1' : '0',
                'behavior_sampling_rate'    => (string) max(1, min((int) ($_POST['behavior_sampling_rate'] ?? 100), 100)),
            ]);
            $_SESSION['flash_success'] = 'Behavior tracking settings saved successfully.';
        } elseif ($form === 'pricing') {
            $settingsModel->setMultiple([
                'pricing_starter_onetime' => (string) max(0, (int) ($_POST['pricing_starter_onetime'] ?? 500)),
                'pricing_pro_monthly' => (string) max(0, (int) ($_POST['pricing_pro_monthly'] ?? 200)),
                'pricing_pro_annual' => (string) max(0, (int) ($_POST['pricing_pro_annual'] ?? 1900)),
            ]);
            $_SESSION['flash_success'] = 'Plan pricing updated successfully.';
        } else {
            $settingsModel->setMultiple([
                'payhere_merchant_id' => trim($_POST['payhere_merchant_id'] ?? ''),
                'payhere_merchant_secret' => trim($_POST['payhere_merchant_secret'] ?? ''),
                'payhere_app_id' => trim($_POST['payhere_app_id'] ?? ''),
                'payhere_app_secret' => trim($_POST['payhere_app_secret'] ?? ''),
                'payhere_sandbox' => isset($_POST['payhere_sandbox']) ? '1' : '0',
                'payhere_currency' => $_POST['payhere_currency'] ?? 'USD',
            ]);
            $_SESSION['flash_success'] = 'Payment settings saved successfully.';
        }
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

        if (!Auth::verifyToken($this->requestToken())) {
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

    /**
     * Manually approve a pending payment and activate user subscription (POST)
     */
    public function approvePayment(): void
    {
        Auth::requireAdmin();
        if (!Auth::verifyToken($this->requestToken())) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }
        $paymentId = (int) ($_POST['payment_id'] ?? 0);
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT p.*, u.email FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ?");
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();
        if (!$payment) {
            $_SESSION['flash_error'] = 'Payment not found.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }
        if ($payment['status'] === 'completed') {
            $_SESSION['flash_error'] = 'Payment is already completed.';
            header('Location: ' . APP_URL . '/admin/payments');
            exit;
        }
        $db->prepare("UPDATE payments SET status = 'completed' WHERE id = ?")->execute([$paymentId]);
        $plans = Subscription::getPlans();
        $plan = $payment['subscription_plan'];
        $billingCycle = $payment['billing_cycle'];
        $planConfig = $plans[$plan] ?? null;
        if ($planConfig) {
            if ($billingCycle === 'onetime' && !empty($planConfig['duration_days'])) {
                $expiresAt = date('Y-m-d H:i:s', strtotime('+' . $planConfig['duration_days'] . ' days'));
            } elseif ($billingCycle === 'annual') {
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 year'));
            } elseif ($billingCycle === 'monthly') {
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 month'));
            } else {
                $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
            }
            $userModel = new User();
            $userModel->update($payment['user_id'], ['subscription_plan' => $plan, 'subscription_expires_at' => $expiresAt]);
            $subModel = new Subscription();
            $subModel->create(['user_id' => $payment['user_id'], 'plan' => $plan, 'billing_cycle' => $billingCycle ?? 'onetime', 'price_cents' => (int) round($payment['amount'] * 100), 'expires_at' => $expiresAt]);
            EventLogger::logForUser($payment['user_id'], 'subscription_activated', ['plan' => $plan, 'approved_by' => 'admin', 'payment_id' => $paymentId]);
        }
        $_SESSION['flash_success'] = 'Payment #' . $paymentId . ' approved — ' . e($payment['email']) . ' upgraded to ' . ucfirst($plan ?? 'plan') . ' (expires ' . date('M j, Y', strtotime($expiresAt ?? 'now')) . ').';
        header('Location: ' . APP_URL . '/admin/payments');
        exit;
    }

    /**
     * Admin Email Templates + Campaign page
     */
    public function emails(): void
    {
        Auth::requireAdmin();
        $ticketModel = new Ticket();
        $ticketStats = $ticketModel->getStats();
        $emailTemplatesDir = TEMPLATE_PATH . '/emails';
        $templateFiles = [];
        if (is_dir($emailTemplatesDir)) {
            foreach (glob($emailTemplatesDir . '/*.php') as $file) {
                $key = basename($file, '.php');
                $templateFiles[] = ['key' => $key, 'label' => ucwords(str_replace('_', ' ', $key)), 'modified' => date('M j, Y H:i', filemtime($file))];
            }
        }
        $db = Database::getInstance()->getConnection();
        $groupCounts = [
            'all'        => (int) $db->query("SELECT COUNT(*) FROM users WHERE is_active=1")->fetchColumn(),
            'free'       => (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan='free' AND is_active=1")->fetchColumn(),
            'starter'    => (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan='starter' AND is_active=1")->fetchColumn(),
            'pro'        => (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan='pro' AND is_active=1")->fetchColumn(),
            'enterprise' => (int) $db->query("SELECT COUNT(*) FROM users WHERE subscription_plan='enterprise' AND is_active=1")->fetchColumn(),
        ];
        include TEMPLATE_PATH . '/admin/emails.php';
    }

    /**
     * Send test email for a template (POST JSON)
     */
    public function testEmail(): void
    {
        Auth::requireAdmin();
        header('Content-Type: application/json');
        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: '', true);
        if (!is_array($json)) {
            $json = [];
        }

        if (!Auth::verifyToken($this->requestToken($json))) {
            echo json_encode(['success' => false, 'message' => 'Invalid token']);
            return;
        }

        $toEmail = filter_var(trim((string)($_POST['to_email'] ?? $json['to_email'] ?? $json['email'] ?? '')), FILTER_VALIDATE_EMAIL);
        $templateKey = preg_replace('/[^a-z0-9_]/', '', (string)($_POST['template_key'] ?? $json['template_key'] ?? $json['template'] ?? 'welcome'));
        if (!$toEmail) {
            echo json_encode(['success' => false, 'message' => 'Invalid email address']);
            return;
        }
        $user = Auth::user();
        $name = $user['full_name'] ?: $user['username'] ?: 'Admin';
        try {
            $sent = EmailService::sendTemplate($toEmail, '[Test] ' . ucwords(str_replace('_', ' ', $templateKey)), $templateKey, ['name' => $name, 'app_url' => APP_URL]);
            if ($sent) {
                echo json_encode(['success' => true, 'message' => 'Test email sent to ' . $toEmail]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Email function returned false — check SMTP settings or server mail config.']);
            }
        } catch (Throwable $e) {
            echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
        }
    }

    /**
     * Send campaign email to a group of users (POST)
     */
    public function sendCampaignEmail(): void
    {
        Auth::requireAdmin();
        if (!Auth::verifyToken($this->requestToken())) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/emails');
            exit;
        }
        $group    = $_POST['recipient_group'] ?? $_POST['group'] ?? 'all';
        $subject  = trim($_POST['subject'] ?? '');
        $body     = trim($_POST['body'] ?? '');
        $specific = filter_var(trim($_POST['specific_email'] ?? ''), FILTER_VALIDATE_EMAIL);
        if (empty($subject) || empty($body)) {
            $_SESSION['flash_error'] = 'Subject and message body are required.';
            header('Location: ' . APP_URL . '/admin/emails');
            exit;
        }
        $db = Database::getInstance()->getConnection();
        if ($group === 'specific') {
            if (!$specific) {
                $_SESSION['flash_error'] = 'Invalid specific email address.';
                header('Location: ' . APP_URL . '/admin/emails');
                exit;
            }
            $stmt = $db->prepare("SELECT id, email, full_name, username FROM users WHERE email = ? AND is_active = 1");
            $stmt->execute([$specific]);
            $recipients = $stmt->fetchAll();
        } elseif (in_array($group, ['free', 'starter', 'pro', 'enterprise'])) {
            $stmt = $db->prepare("SELECT id, email, full_name, username FROM users WHERE subscription_plan = ? AND is_active = 1");
            $stmt->execute([$group]);
            $recipients = $stmt->fetchAll();
        } else {
            $recipients = $db->query("SELECT id, email, full_name, username FROM users WHERE is_active = 1")->fetchAll();
        }
        $sent = 0; $failed = 0;
        foreach ($recipients as $r) {
            $name = $r['full_name'] ?: $r['username'] ?: $r['email'];
            $personalBody = str_replace(['{{name}}', '{{email}}'], [$name, $r['email']], $body);
            if (EmailService::sendRaw($r['email'], $name, $subject, $personalBody)) {
                $sent++;
                EventLogger::logForUser((int) $r['id'], 'campaign_email_sent', ['subject' => $subject]);
            } else {
                $failed++;
            }
        }
        $_SESSION['flash_success'] = "Campaign sent: {$sent} delivered" . ($failed > 0 ? ", {$failed} failed." : '.');
        header('Location: ' . APP_URL . '/admin/emails');
        exit;
    }

    /**
     * Cron job dashboard
     */
    public function crons(): void
    {
        Auth::requireAdmin();
        $db = Database::getInstance()->getConnection();
        $tableExists = (bool) $db->query("SHOW TABLES LIKE 'cron_jobs'")->fetchColumn();
        $cronJobs = $tableExists ? $db->query("SELECT * FROM cron_jobs ORDER BY id ASC")->fetchAll() : [];
        $ticketModel = new Ticket();
        $ticketStats = $ticketModel->getStats();
        include TEMPLATE_PATH . '/admin/crons.php';
    }

    /**
     * Toggle cron job enabled/disabled (POST)
     */
    public function toggleCron(): void
    {
        Auth::requireAdmin();
        if (!Auth::verifyToken($this->requestToken())) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/crons');
            exit;
        }
        $jobKey = preg_replace('/[^a-z0-9_]/', '', $_POST['job_key'] ?? '');
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT id, is_enabled, label FROM cron_jobs WHERE job_key = ?");
        $stmt->execute([$jobKey]);
        $job = $stmt->fetch();
        if (!$job) {
            $_SESSION['flash_error'] = 'Job not found.';
            header('Location: ' . APP_URL . '/admin/crons');
            exit;
        }
        $newStatus = $job['is_enabled'] ? 0 : 1;
        $db->prepare("UPDATE cron_jobs SET is_enabled = ? WHERE job_key = ?")->execute([$newStatus, $jobKey]);
        $_SESSION['flash_success'] = ($job['label'] ?? $jobKey) . ' has been ' . ($newStatus ? 'enabled' : 'disabled') . '.';
        header('Location: ' . APP_URL . '/admin/crons');
        exit;
    }

    /**
     * WhatsApp support button settings page
     */
    public function whatsapp(): void
    {
        Auth::requireAdmin();
        $settingsModel = new SiteSetting();
        $settings = $settingsModel->getMultiple([
            'whatsapp_enabled', 'whatsapp_phone', 'whatsapp_agent_name',
            'whatsapp_show_for_plans', 'whatsapp_questions',
        ]);
        $ticketModel = new Ticket();
        $ticketStats = $ticketModel->getStats();
        include TEMPLATE_PATH . '/admin/whatsapp.php';
    }

    /**
     * Update WhatsApp settings (POST)
     */
    public function updateWhatsapp(): void
    {
        Auth::requireAdmin();
        if (!Auth::verifyToken($this->requestToken())) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/whatsapp');
            exit;
        }
        $settingsModel = new SiteSetting();
        $allPlans = ['free', 'starter', 'pro', 'enterprise'];
        $selectedPlans = array_values(array_intersect($_POST['show_for_plans'] ?? $allPlans, $allPlans));
        if (empty($selectedPlans)) $selectedPlans = $allPlans;
        $questions = array_values(array_filter(array_map('trim', $_POST['questions'] ?? []), fn($q) => $q !== ''));
        $settingsModel->setMultiple([
            'whatsapp_enabled'        => isset($_POST['whatsapp_enabled']) ? '1' : '0',
            'whatsapp_phone'          => preg_replace('/[^0-9]/', '', $_POST['whatsapp_phone'] ?? ''),
            'whatsapp_agent_name'     => trim($_POST['whatsapp_agent_name'] ?? 'Support'),
            'whatsapp_show_for_plans' => json_encode($selectedPlans),
            'whatsapp_questions'      => json_encode($questions),
        ]);
        $_SESSION['flash_success'] = 'WhatsApp support settings saved.';
        header('Location: ' . APP_URL . '/admin/whatsapp');
        exit;
    }

    /**
     * Behavior Analytics Dashboard — view per-user behavior timeline
     */
    public function behaviorAnalytics(): void
    {
        Auth::requireAdmin();
        
        $db = Database::getInstance()->getConnection();
        
        // Get all users for dropdown
        $stmt = $db->query("SELECT id, email FROM users ORDER BY email ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $selected_user_id = (int)($_GET['user_id'] ?? 0);
        $selected_user = null;
        $date_from = $_GET['date_from'] ?? date('Y-m-d', strtotime('-7 days'));
        $date_to = $_GET['date_to'] ?? date('Y-m-d');
        $event_type = $_GET['event_type'] ?? '';
        
        $events = [];
        $session_summary = null;
        
        if ($selected_user_id > 0) {
            // Find selected user
            foreach ($users as $u) {
                if ($u['id'] == $selected_user_id) {
                    $selected_user = $u;
                    break;
                }
            }
            
            // Get behavior events for this user
            $query = "SELECT * FROM behavior_events 
                      WHERE user_id = :user_id 
                      AND DATE(event_at) >= :date_from 
                      AND DATE(event_at) <= :date_to";
            
            $params = [
                ':user_id' => $selected_user_id,
                ':date_from' => $date_from,
                ':date_to' => $date_to
            ];
            
            if ($event_type) {
                $query .= " AND event_type = :event_type";
                $params[':event_type'] = $event_type;
            }
            
            $query .= " ORDER BY event_at DESC LIMIT 500";
            
            $stmt = $db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get session summary
            $summaryStmt = $db->prepare("
                SELECT 
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(*) as total_events,
                    SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as total_pageviews,
                    SUM(CASE WHEN event_type = 'rage_click' THEN 1 ELSE 0 END) as total_rage_clicks
                FROM behavior_events 
                WHERE user_id = :user_id
                AND DATE(event_at) >= :date_from 
                AND DATE(event_at) <= :date_to
            ");
            $summaryStmt->bindValue(':user_id', $selected_user_id);
            $summaryStmt->bindValue(':date_from', $date_from);
            $summaryStmt->bindValue(':date_to', $date_to);
            $summaryStmt->execute();
            $session_summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);
        }
        
        include TEMPLATE_PATH . '/admin/behavior.php';
    }

    /**
     * Export behavior data as CSV or JSON (POST)
     */
    public function behaviorExport(): void
    {
        Auth::requireAdmin();
        
        $user_id = (int)($_POST['user_id'] ?? 0);
        $date_from = $_POST['date_from'] ?? date('Y-m-d', strtotime('-7 days'));
        $date_to = $_POST['date_to'] ?? date('Y-m-d');
        $format = $_POST['format'] ?? 'csv';
        
        if ($user_id <= 0) {
            $_SESSION['flash_error'] = 'Invalid user ID.';
            header('Location: ' . APP_URL . '/admin/behavior');
            exit;
        }
        
        $db = Database::getInstance()->getConnection();
        
        // Get user email for filename
        $userStmt = $db->prepare("SELECT email FROM users WHERE id = :user_id");
        $userStmt->bindValue(':user_id', $user_id);
        $userStmt->execute();
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            $_SESSION['flash_error'] = 'User not found.';
            header('Location: ' . APP_URL . '/admin/behavior');
            exit;
        }
        
        // Get behavior events
        $stmt = $db->prepare("
            SELECT * FROM behavior_events 
            WHERE user_id = :user_id 
            AND DATE(event_at) >= :date_from 
            AND DATE(event_at) <= :date_to
            ORDER BY event_at DESC
        ");
        $stmt->bindValue(':user_id', $user_id);
        $stmt->bindValue(':date_from', $date_from);
        $stmt->bindValue(':date_to', $date_to);
        $stmt->execute();
        $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $filename = 'behavior_' . preg_replace('/[^a-z0-9]/', '_', strtolower($user['email'])) 
                  . '_' . $date_from . '_to_' . $date_to;
        
        if ($format === 'json') {
            // JSON export
            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="' . $filename . '.json"');
            echo json_encode([
                'user_email' => $user['email'],
                'exported_at' => date('Y-m-d H:i:s'),
                'date_range' => "$date_from to $date_to",
                'total_events' => count($events),
                'events' => $events
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        } else {
            // CSV export
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $filename . '.csv"');
            
            $output = fopen('php://output', 'w');
            
            // CSV headers
            fputcsv($output, [
                'Event At',
                'Event Type',
                'Path',
                'Selector',
                'Frustration Score',
                'Duration (ms)',
                'Scroll Depth (%)',
                'Metadata'
            ]);
            
            // CSV rows
            foreach ($events as $event) {
                fputcsv($output, [
                    $event['event_at'],
                    $event['event_type'],
                    $event['path'],
                    $event['selector'],
                    $event['frustration_score'],
                    $event['duration_ms'],
                    $event['scroll_depth'],
                    json_encode(json_decode($event['metadata'], true) ?? [])
                ]);
            }
            
            fclose($output);
        }
        exit;
    }
}
