<?php
/**
 * Payment Controller — PayHere payment processing
 */
class PaymentController
{
    /**
     * Generate PayHere hash for checkout (AJAX POST)
     * Returns JSON with hash and payment details for JS SDK
     */
    public function generateHash(): void
    {
        Auth::requireLogin();

        header('Content-Type: application/json');

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $user = Auth::user();
        $planSlug = $_POST['plan'] ?? '';
        $billingCycle = $_POST['billing_cycle'] ?? 'onetime';

        $plans = Subscription::getPlans();
        if (!isset($plans[$planSlug]) || $planSlug === 'free' || $planSlug === 'enterprise') {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid plan']);
            return;
        }

        $plan = $plans[$planSlug];
        $payhere = new PayHereService();

        if (!$payhere->isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Payment gateway not configured']);
            return;
        }

        // Calculate amount (stored in cents, PayHere wants dollars)
        if ($billingCycle === 'onetime' && $plan['onetime_price']) {
            $amount = $plan['onetime_price'] / 100;
            $subscriptionMonths = 0;
        } elseif ($billingCycle === 'annual' && $plan['annual_price']) {
            $amount = $plan['annual_price'] / 100;
            $subscriptionMonths = 12;
        } elseif ($billingCycle === 'monthly' && $plan['monthly_price']) {
            $amount = $plan['monthly_price'] / 100;
            $subscriptionMonths = 1;
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid billing cycle for this plan']);
            return;
        }

        $currency = $payhere->getCurrency();
        $orderId = 'CVS-' . $user['id'] . '-' . $planSlug . '-' . time();

        // Generate hash
        $hash = $payhere->generateHash($orderId, $amount, $currency);

        // Create pending payment record
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "INSERT INTO payments (user_id, amount, currency, payment_method, transaction_id, status, subscription_plan, subscription_months, billing_cycle)
             VALUES (?, ?, ?, 'payhere', ?, 'pending', ?, ?, ?)"
        );
        $stmt->execute([
            $user['id'],
            $amount,
            $currency,
            $orderId,
            $planSlug,
            $subscriptionMonths,
            $billingCycle,
        ]);

        echo json_encode([
            'hash' => $hash,
            'merchant_id' => $payhere->getMerchantId(),
            'order_id' => $orderId,
            'amount' => number_format($amount, 2, '.', ''),
            'currency' => $currency,
            'sandbox' => $payhere->isSandbox(),
            'items' => $plan['name'] . ' Plan — ' . ucfirst($billingCycle),
            'first_name' => explode(' ', $user['full_name'] ?? $user['username'] ?? '')[0] ?? '',
            'last_name' => explode(' ', $user['full_name'] ?? '', 2)[1] ?? '',
            'email' => $user['email'],
        ]);
    }

    /**
     * PayHere server-to-server notification callback
     * NO auth, NO CSRF — this is called by PayHere servers
     */
    public function notify(): void
    {
        $payhere = new PayHereService();

        // Log the incoming notification
        $payhere->log('Notification received', $_POST);

        // IP whitelist check
        if (!$payhere->verifyIpWhitelist()) {
            $payhere->log('IP whitelist check FAILED', ['ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
            http_response_code(403);
            echo 'Forbidden';
            return;
        }

        // Verify md5sig
        if (!$payhere->verifyNotification($_POST)) {
            $payhere->log('md5sig verification FAILED', $_POST);
            http_response_code(400);
            echo 'Invalid signature';
            return;
        }

        $orderId = $_POST['order_id'] ?? '';
        $paymentId = $_POST['payment_id'] ?? '';
        $statusCode = (int)($_POST['status_code'] ?? -1);
        $amount = $_POST['payhere_amount'] ?? '0';
        $currency = $_POST['payhere_currency'] ?? 'USD';
        $method = $_POST['method'] ?? '';

        $db = Database::getInstance()->getConnection();

        // Find the pending payment by order_id (stored as transaction_id)
        $stmt = $db->prepare("SELECT * FROM payments WHERE transaction_id = ?");
        $stmt->execute([$orderId]);
        $payment = $stmt->fetch();

        if (!$payment) {
            $payhere->log('Payment record not found', ['order_id' => $orderId]);
            http_response_code(404);
            echo 'Payment not found';
            return;
        }

        // Update payment record
        $gatewayResponse = json_encode($_POST);

        if ($statusCode === 2) {
            // SUCCESS — payment completed
            $stmt = $db->prepare(
                "UPDATE payments SET status = 'completed', payhere_payment_id = ?, payment_method = ?, gateway_response = ? WHERE id = ?"
            );
            $stmt->execute([$paymentId, 'payhere_' . $method, $gatewayResponse, $payment['id']]);

            // Update user subscription
            $this->activateSubscription($payment['user_id'], $payment['subscription_plan'], $payment['billing_cycle']);

            $payhere->log('Payment SUCCESS', ['order_id' => $orderId, 'payment_id' => $paymentId]);
        } elseif ($statusCode === 0) {
            // PENDING
            $stmt = $db->prepare(
                "UPDATE payments SET status = 'pending', payhere_payment_id = ?, gateway_response = ? WHERE id = ?"
            );
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);

            $payhere->log('Payment PENDING', ['order_id' => $orderId]);
        } elseif ($statusCode === -1) {
            // CANCELED
            $stmt = $db->prepare(
                "UPDATE payments SET status = 'cancelled', payhere_payment_id = ?, gateway_response = ? WHERE id = ?"
            );
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);

            $payhere->log('Payment CANCELED', ['order_id' => $orderId]);
        } elseif ($statusCode === -3) {
            // CHARGEDBACK — reverse the subscription
            $stmt = $db->prepare(
                "UPDATE payments SET status = 'chargedback', payhere_payment_id = ?, gateway_response = ? WHERE id = ?"
            );
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);

            // Downgrade user back to free
            $userModel = new User();
            $userModel->update($payment['user_id'], [
                'subscription_plan' => 'free',
                'subscription_expires_at' => null,
            ]);

            $payhere->log('Payment CHARGEDBACK — user downgraded', ['order_id' => $orderId, 'user_id' => $payment['user_id']]);
        } else {
            // FAILED (-2 or other)
            $stmt = $db->prepare(
                "UPDATE payments SET status = 'failed', payhere_payment_id = ?, gateway_response = ? WHERE id = ?"
            );
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);

            $payhere->log('Payment FAILED', ['order_id' => $orderId, 'status_code' => $statusCode]);
        }

        http_response_code(200);
        echo 'OK';
    }

    /**
     * Authenticated payment/entitlement status for post-checkout polling.
     */
    public function status(): void
    {
        Auth::requireLogin();

        header('Content-Type: application/json');

        $user = Auth::user();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Please log in to continue.']);
            return;
        }

        $orderId = trim($_GET['order_id'] ?? '');
        $payment = $this->latestPaymentForUser((int) $user['id'], $orderId !== '' ? $orderId : null);

        echo json_encode($this->buildPaymentStatus($user, $payment));
    }

    /**
     * Activate user subscription after successful payment
     */
    private function activateSubscription(int $userId, string $plan, ?string $billingCycle): void
    {
        $plans = Subscription::getPlans();
        $planConfig = $plans[$plan] ?? null;
        if (!$planConfig) return;

        // Calculate expiry date
        if ($billingCycle === 'onetime' && $planConfig['duration_days']) {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+' . $planConfig['duration_days'] . ' days'));
        } elseif ($billingCycle === 'annual') {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+1 year'));
        } elseif ($billingCycle === 'monthly') {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+1 month'));
        } else {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        }

        $userModel = new User();
        $userModel->update($userId, [
            'subscription_plan' => $plan,
            'subscription_expires_at' => $expiresAt,
        ]);

        // Also create a subscription record
        $subscription = new Subscription();
        $subscription->create([
            'user_id' => $userId,
            'plan' => $plan,
            'billing_cycle' => $billingCycle ?? 'onetime',
            'price_cents' => 0, // actual amount is in payments table
            'expires_at' => $expiresAt,
        ]);

        EventLogger::logForUser($userId, 'subscription_activated', [
            'plan' => $plan,
            'source' => 'payment_notify',
        ]);
    }

    private function latestPaymentForUser(int $userId, ?string $orderId = null): ?array
    {
        $db = Database::getInstance()->getConnection();

        if ($orderId) {
            $stmt = $db->prepare(
                "SELECT p.*
                 FROM payments p
                 WHERE p.user_id = ? AND p.transaction_id = ?
                 ORDER BY p.created_at DESC LIMIT 1"
            );
            $stmt->execute([$userId, $orderId]);
            $payment = $stmt->fetch();
            return $payment ?: null;
        }

        $stmt = $db->prepare(
            "SELECT p.*
             FROM payments p
             WHERE p.user_id = ?
             ORDER BY p.created_at DESC LIMIT 1"
        );
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    private function buildPaymentStatus(array $user, ?array $payment): array
    {
        $activePlan = $user['subscription_plan'] ?? 'free';
        $purchasedPlan = $payment['subscription_plan'] ?? null;
        $paymentStatus = $payment['status'] ?? null;
        $entitlementConfirmed = $paymentStatus === 'completed'
            && $purchasedPlan
            && $activePlan === $purchasedPlan
            && $activePlan !== 'free';

        return [
            'payment_found' => (bool) $payment,
            'payment_status' => $paymentStatus,
            'payment_plan' => $purchasedPlan,
            'active_plan' => $activePlan,
            'subscription_expires_at' => $user['subscription_expires_at'] ?? null,
            'entitlement_confirmed' => $entitlementConfirmed,
        ];
    }

    /**
     * Payment success page — shown after PayHere popup completes
     */
    public function success(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $orderId = trim($_GET['order_id'] ?? '');
        $payment = $this->latestPaymentForUser((int) $user['id'], $orderId !== '' ? $orderId : null);
        $paymentStatus = $this->buildPaymentStatus($user, $payment);

        if ($payment) {
            EventLogger::log('payment_success_page_viewed', [
                'plan' => $payment['subscription_plan'] ?? '',
                'amount' => (float) ($payment['amount'] ?? 0),
                'payment_provider' => 'payhere',
                'payment_status' => $payment['status'] ?? '',
                'plan_activated' => (bool) ($paymentStatus['entitlement_confirmed'] ?? false),
                'source' => 'server',
            ]);
        }

        $plans = Subscription::getPlans();

        include TEMPLATE_PATH . '/plans/success.php';
    }

    /**
     * Payment cancel page
     */
    public function cancel(): void
    {
        Auth::requireLogin();
        include TEMPLATE_PATH . '/plans/cancel.php';
    }
}
