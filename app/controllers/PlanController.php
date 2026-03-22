<?php
/**
 * Plan Controller — Pricing & Checkout
 */
class PlanController
{
    /**
     * Show pricing plans page
     */
    public function index(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $plans = Subscription::getPlans();
        $currentPlan = $user['subscription_plan'] ?? 'free';

        $subscriptionModel = new Subscription();
        $activeSubscription = $subscriptionModel->findByUser($user['id']);

        include TEMPLATE_PATH . '/plans/index.php';
    }

    /**
     * Show checkout page for a specific plan
     */
    public function checkout(string $plan): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $plans = Subscription::getPlans();

        if (!isset($plans[$plan]) || $plan === 'free') {
            $_SESSION['flash_error'] = 'Invalid plan selected.';
            header('Location: ' . APP_URL . '/plans');
            exit;
        }

        if ($plan === 'enterprise') {
            $_SESSION['flash_info'] = 'Enterprise plans require custom pricing. Please contact us.';
            header('Location: ' . APP_URL . '/plans');
            exit;
        }

        $selectedPlan = $plans[$plan];
        $currentPlan = $user['subscription_plan'] ?? 'free';
        $billingCycle = $_GET['cycle'] ?? 'monthly';

        if (!in_array($billingCycle, ['monthly', 'annual'])) {
            $billingCycle = 'monthly';
        }

        include TEMPLATE_PATH . '/plans/checkout.php';
    }
}
