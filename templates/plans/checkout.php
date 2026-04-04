<?php
$pageTitle = 'Checkout';
$planName = $selectedPlan['name'];
$isOnetime = ($billingCycle === 'onetime');
$isAnnual = ($billingCycle === 'annual');

if ($isOnetime) {
    $priceDisplay = '$' . number_format($selectedPlan['onetime_price'] / 100, 2);
    $totalDisplay = $priceDisplay . ' one-time';
} elseif ($isAnnual) {
    $priceDisplay = '$' . number_format($selectedPlan['annual_price'] / 100 / 12, 2);
    $totalDisplay = '$' . number_format($selectedPlan['annual_price'] / 100, 2) . '/year';
} else {
    $priceDisplay = '$' . number_format($selectedPlan['monthly_price'] / 100, 2);
    $totalDisplay = $priceDisplay . '/month';
}
ob_start();
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-8">

            <!-- Back link -->
            <a href="<?= APP_URL ?>/plans" class="text-decoration-none mb-4 d-inline-block">
                <i class="bi bi-arrow-left me-1"></i>Back to Plans
            </a>

            <div class="row g-4">
                <!-- Order Summary -->
                <div class="col-md-5 order-md-2">
                    <div class="card shadow-sm">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3">Order Summary</h5>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Plan</span>
                                <span class="fw-semibold"><?= e($planName) ?></span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Billing</span>
                                <span><?= $isOnetime ? 'One-time' : ($isAnnual ? 'Annual' : 'Monthly') ?></span>
                            </div>
                            <?php if ($isOnetime): ?>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Access</span>
                                <span><?= $selectedPlan['duration_days'] ?> days</span>
                            </div>
                            <?php else: ?>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Price</span>
                                <span><?= $priceDisplay ?>/mo</span>
                            </div>
                            <?php endif; ?>
                            <hr>
                            <div class="d-flex justify-content-between fw-bold fs-5">
                                <span>Total</span>
                                <span><?= $totalDisplay ?></span>
                            </div>

                            <?php if ($isAnnual): ?>
                            <div class="alert alert-success mt-3 mb-0 py-2 small">
                                <i class="bi bi-piggy-bank me-1"></i>
                                You save $<?= number_format(($selectedPlan['monthly_price'] * 12 - $selectedPlan['annual_price']) / 100, 2) ?>/year with the annual plan!
                            </div>
                            <?php endif; ?>

                            <?php if ($isOnetime): ?>
                            <div class="alert alert-info mt-3 mb-0 py-2 small">
                                <i class="bi bi-lightning me-1"></i>
                                No subscription — one-time payment for <?= $selectedPlan['duration_days'] ?> days of full access.
                            </div>
                            <?php endif; ?>

                            <!-- Toggle billing cycle (Pro only) -->
                            <?php if (!$isOnetime): ?>
                            <div class="text-center mt-3">
                                <?php if ($isAnnual): ?>
                                    <a href="<?= APP_URL ?>/plans/checkout/<?= e($plan) ?>?cycle=monthly" class="small text-muted">Switch to monthly billing</a>
                                <?php else: ?>
                                    <a href="<?= APP_URL ?>/plans/checkout/<?= e($plan) ?>?cycle=annual" class="small text-primary">Switch to annual &amp; save</a>
                                <?php endif; ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>

                    <!-- What you get -->
                    <div class="card mt-3">
                        <div class="card-body p-4">
                            <h6 class="fw-bold mb-3">What's included in <?= e($planName) ?></h6>
                            <ul class="list-unstyled mb-0 small">
                                <?php foreach ($selectedPlan['features'] as $feature): ?>
                                <li class="mb-2">
                                    <?php if (str_contains($feature, 'Coming Soon')): ?>
                                        <i class="bi bi-clock text-info me-2"></i><span class="text-muted"><?= e($feature) ?></span>
                                    <?php else: ?>
                                        <i class="bi bi-check-circle-fill text-success me-2"></i><?= e($feature) ?>
                                    <?php endif; ?>
                                </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Payment Section -->
                <div class="col-md-7 order-md-1">
                    <div class="card shadow-sm">
                        <div class="card-body p-4">
                            <h4 class="fw-bold mb-1"><?= $isOnetime ? 'Get' : 'Upgrade to' ?> <?= e($planName) ?></h4>
                            <p class="text-muted mb-4"><?= $isOnetime ? 'Complete your one-time purchase' : 'Complete your subscription' ?></p>

                            <?php if ($payhereConfigured): ?>
                            <!-- PayHere Payment -->
                            <div class="text-center mb-4">
                                <a href="https://www.payhere.lk" target="_blank">
                                    <img src="https://www.payhere.lk/downloads/images/payhere_square_banner.png" alt="PayHere" width="120" class="rounded">
                                </a>
                            </div>

                            <div id="payhere-status" class="d-none"></div>

                            <button id="payhere-pay-btn" class="btn btn-primary btn-lg w-100" onclick="initiatePayment()">
                                <i class="bi bi-lock-fill me-2"></i><?= $isOnetime ? 'Pay Now' : 'Subscribe Now' ?> — <?= $totalDisplay ?>
                            </button>

                            <p class="text-muted small mt-3 mb-0 text-center">
                                <i class="bi bi-shield-check me-1"></i>
                                Secure payment via PayHere · <?= $isOnetime ? 'One-time charge' : 'Cancel anytime' ?> · No hidden fees
                            </p>

                            <div class="text-center mt-3">
                                <img src="https://www.payhere.lk/downloads/images/visa.png" alt="Visa" height="24" class="me-1">
                                <img src="https://www.payhere.lk/downloads/images/master.png" alt="Mastercard" height="24" class="me-1">
                                <img src="https://www.payhere.lk/downloads/images/amex.png" alt="Amex" height="24">
                            </div>

                            <?php else: ?>
                            <!-- PayHere not configured -->
                            <div class="checkout-payment-placeholder text-center py-5">
                                <i class="bi bi-credit-card display-4 text-muted"></i>
                                <h5 class="mt-3 text-muted">Payment Coming Soon</h5>
                                <p class="text-muted small mb-4">We're setting up secure payment processing.<br>Payments will be available shortly.</p>

                                <button class="btn btn-primary btn-lg w-100" disabled>
                                    <i class="bi bi-lock-fill me-2"></i><?= $isOnetime ? 'Pay Now' : 'Subscribe Now' ?> — <?= $totalDisplay ?>
                                </button>
                                <p class="text-muted small mt-2 mb-0">
                                    <i class="bi bi-shield-check me-1"></i>
                                    Secure payment · <?= $isOnetime ? 'One-time charge' : 'Cancel anytime' ?> · No hidden fees
                                </p>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>

<?php
$content = ob_get_clean();

// Add PayHere JS SDK if configured
if ($payhereConfigured) {
    $extraScripts = '
<script src="' . ($payhereSandbox ? 'https://sandbox.payhere.lk' : 'https://www.payhere.lk') . '/lib/payhere.js"></script>
<script>
// PayHere event handlers
payhere.onCompleted = function onCompleted(orderId) {
    document.getElementById("payhere-status").className = "alert alert-success";
    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-check-circle me-2"></i>Payment completed! Redirecting...\';
    window.location.href = "' . APP_URL . '/payment/success";
};

payhere.onDismissed = function onDismissed() {
    document.getElementById("payhere-status").className = "alert alert-warning";
    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-exclamation-circle me-2"></i>Payment was cancelled. You can try again.\';
    document.getElementById("payhere-pay-btn").disabled = false;
    document.getElementById("payhere-pay-btn").innerHTML = \'<i class="bi bi-lock-fill me-2"></i>' . ($isOnetime ? 'Pay Now' : 'Subscribe Now') . ' — ' . $totalDisplay . '\';
};

payhere.onError = function onError(error) {
    document.getElementById("payhere-status").className = "alert alert-danger";
    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>Payment error: \' + error;
    document.getElementById("payhere-pay-btn").disabled = false;
    document.getElementById("payhere-pay-btn").innerHTML = \'<i class="bi bi-lock-fill me-2"></i>' . ($isOnetime ? 'Pay Now' : 'Subscribe Now') . ' — ' . $totalDisplay . '\';
};

function initiatePayment() {
    var btn = document.getElementById("payhere-pay-btn");
    btn.disabled = true;
    btn.innerHTML = \'<span class="spinner-border spinner-border-sm me-2"></span>Preparing payment...\';
    document.getElementById("payhere-status").className = "d-none";

    // Get hash from server
    var formData = new FormData();
    formData.append("_token", "' . Auth::generateToken() . '");
    formData.append("plan", "' . e($plan) . '");
    formData.append("billing_cycle", "' . e($billingCycle) . '");

    fetch("' . APP_URL . '/api/payment/hash", {
        method: "POST",
        body: formData
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.error) {
            document.getElementById("payhere-status").className = "alert alert-danger";
            document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>\' + data.error;
            btn.disabled = false;
            btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>' . ($isOnetime ? 'Pay Now' : 'Subscribe Now') . ' — ' . $totalDisplay . '\';
            return;
        }

        // Start PayHere payment
        var payment = {
            sandbox: data.sandbox,
            merchant_id: data.merchant_id,
            return_url: undefined,
            cancel_url: undefined,
            notify_url: "' . APP_URL . '/payment/notify",
            order_id: data.order_id,
            items: data.items,
            amount: data.amount,
            currency: data.currency,
            hash: data.hash,
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: "",
            address: "",
            city: "",
            country: "",
            custom_1: "' . Auth::id() . '",
            custom_2: "' . e($plan) . '"
        };

        payhere.startPayment(payment);
    })
    .catch(function(error) {
        document.getElementById("payhere-status").className = "alert alert-danger";
        document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>Failed to initiate payment. Please try again.\';
        btn.disabled = false;
        btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>' . ($isOnetime ? 'Pay Now' : 'Subscribe Now') . ' — ' . $totalDisplay . '\';
    });
}
</script>';
}

include TEMPLATE_PATH . '/layouts/main.php';
