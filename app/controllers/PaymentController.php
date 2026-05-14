<?php

class PaymentController
{
    public function generateHash(): void
    {
        Auth::requireLogin();

        header('Content-Type: application/json');

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $purchase = $_POST['purchase'] ?? $_POST['plan'] ?? '';
        if ($purchase !== 'credits') {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid credit package']);
            return;
        }

        $user = Auth::user();
        $payhere = new PayHereService();
        if (!$payhere->isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Payment gateway not configured']);
            return;
        }

        $amount = Credit::PURCHASE_PACK_PRICE;
        $credits = Credit::PURCHASE_PACK_CREDITS;
        $currency = $payhere->getCurrency();
        $orderId = 'CVS-' . $user['id'] . '-credits-' . time();
        $hash = $payhere->generateHash($orderId, $amount, $currency);

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "INSERT INTO payments (user_id, amount, currency, payment_method, transaction_id, status, subscription_plan, subscription_months, billing_cycle, credit_amount, purchase_type)
             VALUES (?, ?, ?, 'payhere', ?, 'pending', 'credits', 0, 'onetime', ?, 'credit_pack')"
        );
        $stmt->execute([(int) $user['id'], $amount, $currency, $orderId, $credits]);

        echo json_encode([
            'hash' => $hash,
            'merchant_id' => $payhere->getMerchantId(),
            'order_id' => $orderId,
            'amount' => number_format($amount, 2, '.', ''),
            'currency' => $currency,
            'sandbox' => $payhere->isSandbox(),
            'items' => $credits . ' CVScholar Credits',
            'first_name' => explode(' ', $user['full_name'] ?? $user['username'] ?? '')[0] ?? '',
            'last_name' => explode(' ', $user['full_name'] ?? '', 2)[1] ?? '',
            'email' => $user['email'],
        ]);
    }

    public function notify(): void
    {
        $payhere = new PayHereService();
        $payhere->log('Notification received', $_POST);

        if (!$payhere->verifyIpWhitelist()) {
            $payhere->log('IP whitelist check FAILED', ['ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
            http_response_code(403);
            echo 'Forbidden';
            return;
        }

        if (!$payhere->verifyNotification($_POST)) {
            $payhere->log('md5sig verification FAILED', $_POST);
            http_response_code(400);
            echo 'Invalid signature';
            return;
        }

        $orderId = $_POST['order_id'] ?? '';
        $paymentId = $_POST['payment_id'] ?? '';
        $statusCode = (int) ($_POST['status_code'] ?? -1);
        $method = $_POST['method'] ?? '';
        $gatewayResponse = json_encode($_POST);

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare('SELECT * FROM payments WHERE transaction_id = ?');
        $stmt->execute([$orderId]);
        $payment = $stmt->fetch();

        if (!$payment) {
            $payhere->log('Payment record not found', ['order_id' => $orderId]);
            http_response_code(404);
            echo 'Payment not found';
            return;
        }

        if ($statusCode === 2) {
            $stmt = $db->prepare("UPDATE payments SET status = 'completed', payhere_payment_id = ?, payment_method = ?, gateway_response = ? WHERE id = ?");
            $stmt->execute([$paymentId, 'payhere_' . $method, $gatewayResponse, $payment['id']]);
            $this->applyCreditPurchase((int) $payment['id']);
            $payhere->log('Credit payment SUCCESS', ['order_id' => $orderId, 'payment_id' => $paymentId]);
        } elseif ($statusCode === 0) {
            $stmt = $db->prepare("UPDATE payments SET status = 'pending', payhere_payment_id = ?, gateway_response = ? WHERE id = ?");
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);
        } elseif ($statusCode === -1) {
            $stmt = $db->prepare("UPDATE payments SET status = 'cancelled', payhere_payment_id = ?, gateway_response = ? WHERE id = ?");
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);
        } elseif ($statusCode === -3) {
            $stmt = $db->prepare("UPDATE payments SET status = 'chargedback', payhere_payment_id = ?, gateway_response = ? WHERE id = ?");
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);
        } else {
            $stmt = $db->prepare("UPDATE payments SET status = 'failed', payhere_payment_id = ?, gateway_response = ? WHERE id = ?");
            $stmt->execute([$paymentId, $gatewayResponse, $payment['id']]);
        }

        http_response_code(200);
        echo 'OK';
    }

    public function status(): void
    {
        Auth::requireLogin();
        header('Content-Type: application/json');

        $user = Auth::user();
        $orderId = trim($_GET['order_id'] ?? '');
        $payment = $this->latestPaymentForUser((int) $user['id'], $orderId !== '' ? $orderId : null);

        echo json_encode($this->buildPaymentStatus((int) $user['id'], $payment));
    }

    public function success(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $orderId = trim($_GET['order_id'] ?? '');
        $payment = $this->latestPaymentForUser((int) $user['id'], $orderId !== '' ? $orderId : null);

        if ($payment && $payment['status'] === 'completed') {
            $this->applyCreditPurchase((int) $payment['id']);
        }

        $paymentStatus = $this->buildPaymentStatus((int) $user['id'], $payment);

        if ($payment) {
            EventLogger::log('payment_success_page_viewed', [
                'purchase_type' => $payment['purchase_type'] ?? 'credit_pack',
                'credits' => (int) ($payment['credit_amount'] ?? 0),
                'amount' => (float) ($payment['amount'] ?? 0),
                'payment_provider' => 'payhere',
                'payment_status' => $payment['status'] ?? '',
                'credits_confirmed' => (bool) ($paymentStatus['credits_confirmed'] ?? false),
                'source' => 'server',
            ]);
        }

        include TEMPLATE_PATH . '/plans/success.php';
    }

    public function cancel(): void
    {
        Auth::requireLogin();
        include TEMPLATE_PATH . '/plans/cancel.php';
    }

    private function applyCreditPurchase(int $paymentId): void
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare('SELECT * FROM payments WHERE id = ? LIMIT 1');
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();
        if (!$payment || ($payment['status'] ?? '') !== 'completed') {
            return;
        }

        $credits = (int) ($payment['credit_amount'] ?? Credit::PURCHASE_PACK_CREDITS);
        if ($credits <= 0) {
            $credits = Credit::PURCHASE_PACK_CREDITS;
        }

        $result = (new Credit())->credit((int) $payment['user_id'], $credits, 'credit_pack_purchase', 'credit_purchase_payment_' . $paymentId, [
            'reference_type' => 'payment',
            'reference_id' => $paymentId,
            'transaction_id' => $payment['transaction_id'] ?? '',
            'amount' => (float) ($payment['amount'] ?? 0),
            'currency' => $payment['currency'] ?? 'USD',
        ]);

        if (!empty($result['success']) && empty($result['already_recorded'])) {
            EventLogger::logForUser((int) $payment['user_id'], 'credits_purchased', [
                'credits' => $credits,
                'payment_id' => $paymentId,
                'balance' => $result['balance'],
            ]);
        }
    }

    private function latestPaymentForUser(int $userId, ?string $orderId = null): ?array
    {
        $db = Database::getInstance()->getConnection();
        if ($orderId) {
            $stmt = $db->prepare('SELECT * FROM payments WHERE user_id = ? AND transaction_id = ? ORDER BY created_at DESC LIMIT 1');
            $stmt->execute([$userId, $orderId]);
            return $stmt->fetch() ?: null;
        }

        $stmt = $db->prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    private function buildPaymentStatus(int $userId, ?array $payment): array
    {
        $balance = (new Credit())->balance($userId);
        $creditsConfirmed = false;

        if ($payment && ($payment['status'] ?? '') === 'completed') {
            $stmt = Database::getInstance()->getConnection()->prepare('SELECT COUNT(*) FROM credit_transactions WHERE idempotency_key = ?');
            $stmt->execute(['credit_purchase_payment_' . (int) $payment['id']]);
            $creditsConfirmed = ((int) $stmt->fetchColumn()) > 0;
        }

        return [
            'payment_found' => (bool) $payment,
            'payment_status' => $payment['status'] ?? null,
            'purchase_type' => $payment['purchase_type'] ?? null,
            'credits_purchased' => (int) ($payment['credit_amount'] ?? 0),
            'credits_balance' => $balance,
            'credits_confirmed' => $creditsConfirmed,
            'entitlement_confirmed' => $creditsConfirmed,
            'active_plan' => 'free',
            'subscription_expires_at' => null,
        ];
    }
}
