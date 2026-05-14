<?php
$pageTitle = 'Payment Successful';
ob_start();
$creditsConfirmed = (bool) ($paymentStatus['credits_confirmed'] ?? false);
$creditsPurchased = (int) ($paymentStatus['credits_purchased'] ?? $payment['credit_amount'] ?? 0);
$creditBalance = (int) ($paymentStatus['credits_balance'] ?? 0);
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-6 text-center">
            <?php if ($payment && $payment['status'] === 'completed'): ?>
            <div class="card shadow-sm border-success">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Payment Successful!</h2>
                    <p class="text-muted mb-4">
                        <?= $creditsConfirmed ? 'Your credits are ready.' : 'Payment confirmed. We are adding your credits now.' ?>
                    </p>
                    <div class="bg-light rounded-3 p-3 mb-4 text-start">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Credits Added</span>
                            <span class="fw-semibold"><?= $creditsPurchased ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">New Balance</span>
                            <span class="fw-semibold"><?= $creditBalance ?></span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Amount</span>
                            <span class="fw-semibold"><?= e($payment['currency'] ?? 'USD') ?> <?= number_format($payment['amount'] ?? 0, 2) ?></span>
                        </div>
                    </div>
                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-primary btn-lg">
                        <i class="bi bi-speedometer2 me-2"></i>Go to Dashboard
                    </a>
                </div>
            </div>
            <?php elseif ($payment && $payment['status'] === 'pending'): ?>
            <div class="card shadow-sm border-warning">
                <div class="card-body p-5">
                    <i class="bi bi-hourglass-split text-warning mb-3" style="font-size: 4rem;"></i>
                    <h2 class="fw-bold mb-2">Payment Processing</h2>
                    <p class="text-muted mb-4">Your credits will be added once PayHere confirms the payment.</p>
                    <a href="<?= APP_URL ?>/plans" class="btn btn-primary">Back to Credits</a>
                </div>
            </div>
            <?php else: ?>
            <div class="card shadow-sm">
                <div class="card-body p-5">
                    <i class="bi bi-info-circle text-muted mb-3" style="font-size: 4rem;"></i>
                    <h2 class="fw-bold mb-2">Payment Status</h2>
                    <p class="text-muted mb-4">We could not find a recent successful credit purchase.</p>
                    <div class="d-flex gap-2 justify-content-center">
                        <a href="<?= APP_URL ?>/plans" class="btn btn-primary">Back to Credits</a>
                        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">Dashboard</a>
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
