<?php
$pageTitle = 'Payment Successful';
ob_start();
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-6 text-center">

            <?php if ($payment && $payment['status'] === 'completed'): ?>
            <!-- Success -->
            <div class="card shadow-sm border-success">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Payment Successful!</h2>
                    <p class="text-muted mb-4">
                        Thank you for your purchase. Your <?= e(ucfirst($payment['subscription_plan'] ?? 'plan')) ?> plan is now active.
                    </p>

                    <div class="bg-light rounded-3 p-3 mb-4 text-start">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Plan</span>
                            <span class="fw-semibold"><?= e(ucfirst($payment['subscription_plan'] ?? '')) ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Amount</span>
                            <span class="fw-semibold"><?= e($payment['currency'] ?? 'USD') ?> <?= number_format($payment['amount'] ?? 0, 2) ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Billing</span>
                            <span><?= e(ucfirst($payment['billing_cycle'] ?? 'one-time')) ?></span>
                        </div>
                        <?php if (!empty($payment['subscription_expires_at'])): ?>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Active Until</span>
                            <span><?= date('F j, Y', strtotime($payment['subscription_expires_at'])) ?></span>
                        </div>
                        <?php endif; ?>
                    </div>

                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-primary btn-lg">
                        <i class="bi bi-speedometer2 me-2"></i>Go to Dashboard
                    </a>
                </div>
            </div>

            <?php elseif ($payment && $payment['status'] === 'pending'): ?>
            <!-- Pending -->
            <div class="card shadow-sm border-warning">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-hourglass-split text-warning" style="font-size: 4rem;"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Payment Processing</h2>
                    <p class="text-muted mb-4">
                        Your payment is being processed. Your plan will be activated once the payment is confirmed.
                        This usually takes a few moments.
                    </p>
                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-primary btn-lg">
                        <i class="bi bi-speedometer2 me-2"></i>Go to Dashboard
                    </a>
                </div>
            </div>

            <?php else: ?>
            <!-- No payment / failed -->
            <div class="card shadow-sm">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-info-circle text-muted" style="font-size: 4rem;"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Payment Status</h2>
                    <p class="text-muted mb-4">
                        We couldn't find a recent successful payment. If you just completed a payment, please wait a moment and refresh this page.
                    </p>
                    <div class="d-flex gap-2 justify-content-center">
                        <a href="<?= APP_URL ?>/plans" class="btn btn-primary">
                            <i class="bi bi-arrow-left me-1"></i>Back to Plans
                        </a>
                        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
                            Dashboard
                        </a>
                    </div>
                </div>
            </div>
            <?php endif; ?>

        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
