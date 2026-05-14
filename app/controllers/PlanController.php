<?php

class PlanController
{
    public function index(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $creditBalance = 0;
        try {
            $creditBalance = (new Credit())->balance((int) $user['id']);
        } catch (Throwable $e) {}

        include TEMPLATE_PATH . '/plans/index.php';
    }

    public function checkout(string $plan): void
    {
        Auth::requireLogin();

        if ($plan !== 'credits') {
            $_SESSION['flash_error'] = 'Invalid credit package selected.';
            header('Location: ' . APP_URL . '/plans');
            exit;
        }

        $user = Auth::user();
        $creditPack = [
            'slug' => 'credits',
            'name' => '250 Credits',
            'credits' => Credit::PURCHASE_PACK_CREDITS,
            'price' => Credit::PURCHASE_PACK_PRICE,
        ];

        $payhere = new PayHereService();
        $payhereConfigured = $payhere->isConfigured();
        $payhereSandbox = $payhere->isSandbox();

        EventLogger::log('credit_checkout_started', [
            'credits' => $creditPack['credits'],
            'amount' => $creditPack['price'],
        ]);

        include TEMPLATE_PATH . '/plans/checkout.php';
    }
}
