<?php
$pageTitle = 'Payment Successful';
ob_start();
$entitlementConfirmed = (bool) ($paymentStatus['entitlement_confirmed'] ?? false);
$dashboardButtonClass = $entitlementConfirmed ? 'btn btn-primary btn-lg' : 'btn btn-primary btn-lg disabled';
$dashboardButtonAttrs = $entitlementConfirmed ? '' : ' aria-disabled="true" tabindex="-1"';
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
                    <p class="text-muted mb-4" id="paymentStatusMessage">
                        <?php if ($entitlementConfirmed): ?>
                        Thank you for your purchase. Your <?= e(ucfirst($payment['subscription_plan'] ?? 'plan')) ?> plan is now active.
                        <?php else: ?>
                        Payment confirmed. We are activating your <?= e(ucfirst($payment['subscription_plan'] ?? 'plan')) ?> plan now.
                        <?php endif; ?>
                    </p>

                    <div id="activationStatus" class="alert <?= $entitlementConfirmed ? 'alert-success' : 'alert-info' ?> mb-4">
                        <?php if ($entitlementConfirmed): ?>
                        <i class="bi bi-check-circle me-2"></i>Your plan access is ready.
                        <?php else: ?>
                        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Confirming your plan access...
                        <?php endif; ?>
                    </div>

                    <div class="bg-light rounded-3 p-3 mb-4 text-start">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Plan</span>
                            <span class="fw-semibold" id="activePlanLabel"><?= e(ucfirst($paymentStatus['active_plan'] ?? $payment['subscription_plan'] ?? '')) ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Amount</span>
                            <span class="fw-semibold"><?= e($payment['currency'] ?? 'USD') ?> <?= number_format($payment['amount'] ?? 0, 2) ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Billing</span>
                            <span><?= e(ucfirst($payment['billing_cycle'] ?? 'one-time')) ?></span>
                        </div>
                        <div class="d-flex justify-content-between <?= empty($paymentStatus['subscription_expires_at']) ? 'd-none' : '' ?>" id="activeUntilRow">
                            <span class="text-muted">Active Until</span>
                            <span id="activeUntilLabel"><?= !empty($paymentStatus['subscription_expires_at']) ? date('F j, Y', strtotime($paymentStatus['subscription_expires_at'])) : '' ?></span>
                        </div>
                    </div>

                    <a href="<?= APP_URL ?>/dashboard" id="dashboardButton" class="<?= $dashboardButtonClass ?>"<?= $dashboardButtonAttrs ?>>
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
                    <p class="text-muted mb-4" id="paymentStatusMessage">
                        Your payment is being processed. Your plan will be activated once the payment is confirmed.
                        This usually takes a few moments.
                    </p>
                    <div id="activationStatus" class="alert alert-info mb-4">
                        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Checking payment confirmation...
                    </div>
                    <a href="<?= APP_URL ?>/dashboard" id="dashboardButton" class="btn btn-primary btn-lg disabled" aria-disabled="true" tabindex="-1">
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

<?php if ($payment): ?>
<script>
(function() {
    var paymentPageStartedAt = Date.now();
    var dashboardButton = document.getElementById('dashboardButton');
    var plan = '<?= e($payment['subscription_plan'] ?? '') ?>';
    var planActivated = <?= $entitlementConfirmed ? 'true' : 'false' ?>;

    window.cvPaymentSuccessStartedAt = paymentPageStartedAt;
    window.cvPaymentPlanActivated = planActivated;
    try {
        sessionStorage.setItem('cvscholarPaymentCompletedAt', String(paymentPageStartedAt));
        sessionStorage.setItem('cvscholarPaymentPlan', plan);
    } catch (e) {}

    if (dashboardButton) {
        dashboardButton.addEventListener('click', function() {
            window.cvTrackEvent && window.cvTrackEvent('post_payment_cta_clicked', {
                plan: plan,
                plan_activated: window.cvPaymentPlanActivated === true,
                page: '/payment/success'
            }, { keepalive: true });
        });
    }
})();
</script>
<?php endif; ?>

<?php if ($payment && !$entitlementConfirmed): ?>
<script>
(function() {
    var attempts = 0;
    var maxAttempts = 5;
    var timeoutTracked = false;
    var pageStartedAt = window.cvPaymentSuccessStartedAt || Date.now();
    var statusUrl = '<?= APP_URL ?>/api/payment/status<?= !empty($payment['transaction_id']) ? '?order_id=' . urlencode($payment['transaction_id']) : '' ?>';
    var purchasedPlan = '<?= e($payment['subscription_plan'] ?? '') ?>';
    var userPlanBefore = '<?= e($paymentStatus['active_plan'] ?? 'free') ?>';
    var activationStatus = document.getElementById('activationStatus');
    var statusMessage = document.getElementById('paymentStatusMessage');
    var dashboardButton = document.getElementById('dashboardButton');
    var activePlanLabel = document.getElementById('activePlanLabel');
    var activeUntilRow = document.getElementById('activeUntilRow');
    var activeUntilLabel = document.getElementById('activeUntilLabel');

    function formatDate(value) {
        if (!value) {
            return '';
        }
        var date = new Date(value.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function enableDashboard(data) {
        window.cvPaymentPlanActivated = true;
        activationStatus.className = 'alert alert-success mb-4';
        activationStatus.innerHTML = '<i class="bi bi-check-circle me-2"></i>Your plan access is ready.';
        statusMessage.textContent = 'Thank you for your purchase. Your ' + data.active_plan.charAt(0).toUpperCase() + data.active_plan.slice(1) + ' plan is now active.';
        dashboardButton.classList.remove('disabled');
        dashboardButton.removeAttribute('aria-disabled');
        dashboardButton.removeAttribute('tabindex');

        if (activePlanLabel) {
            activePlanLabel.textContent = data.active_plan.charAt(0).toUpperCase() + data.active_plan.slice(1);
        }

        var activeUntil = formatDate(data.subscription_expires_at);
        if (activeUntilRow && activeUntilLabel && activeUntil) {
            activeUntilLabel.textContent = activeUntil;
            activeUntilRow.classList.remove('d-none');
        }
    }

    function showStillProcessing() {
        if (!timeoutTracked) {
            timeoutTracked = true;
            window.cvTrackEvent && window.cvTrackEvent('plan_refresh_failed', {
                trigger: 'post_payment',
                plan: purchasedPlan,
                error_message: 'entitlement_confirmation_timeout',
                time_since_payment_ms: Date.now() - pageStartedAt,
                page: '/payment/success'
            });
            window.cvTrackEvent && window.cvTrackEvent('post_payment_plan_timeout', {
                plan: purchasedPlan,
                timeout_ms: maxAttempts * 2000,
                page: '/payment/success'
            });
        }
        activationStatus.className = 'alert alert-warning mb-4';
        activationStatus.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Payment confirmed, but plan activation is still processing. Please refresh this page in a moment.';
    }

    function pollStatus() {
        attempts += 1;
        window.cvTrackEvent && window.cvTrackEvent('plan_refresh_attempted', {
            trigger: 'post_payment',
            user_plan_before: userPlanBefore,
            plan: purchasedPlan,
            attempt: attempts,
            page: '/payment/success'
        });

        fetch(statusUrl, {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.entitlement_confirmed) {
                enableDashboard(data);
                window.cvTrackEvent && window.cvTrackEvent('plan_refresh_succeeded', {
                    trigger: 'post_payment',
                    user_plan_after: data.active_plan || purchasedPlan,
                    plan: purchasedPlan,
                    time_since_payment_ms: Date.now() - pageStartedAt,
                    attempts_used: attempts,
                    page: '/payment/success'
                });
                window.cvTrackEvent && window.cvTrackEvent('post_payment_plan_confirmed', {
                    plan: purchasedPlan,
                    time_to_confirm_ms: Date.now() - pageStartedAt,
                    page: '/payment/success'
                });
                return;
            }

            if (attempts >= maxAttempts) {
                showStillProcessing();
                return;
            }

            window.setTimeout(pollStatus, 2000);
        })
        .catch(function() {
            if (attempts >= maxAttempts) {
                showStillProcessing();
                return;
            }

            window.setTimeout(pollStatus, 2000);
        });
    }

    window.setTimeout(pollStatus, 2000);
})();
</script>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
