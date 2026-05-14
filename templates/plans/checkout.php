<?php
$pageTitle = 'Buy Credits';
$totalDisplay = '$' . number_format($creditPack['price'], 2);
ob_start();
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-8">
            <a href="<?= APP_URL ?>/plans" class="text-decoration-none mb-4 d-inline-block">
                <i class="bi bi-arrow-left me-1"></i>Back to Credits
            </a>

            <div class="row g-4">
                <div class="col-md-5 order-md-2">
                    <div class="card shadow-sm">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3">Order Summary</h5>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Package</span>
                                <span class="fw-semibold"><?= (int) $creditPack['credits'] ?> credits</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Billing</span>
                                <span>One-time</span>
                            </div>
                            <hr>
                            <div class="d-flex justify-content-between fw-bold fs-5">
                                <span>Total</span>
                                <span><?= $totalDisplay ?></span>
                            </div>
                            <div class="alert alert-info mt-3 mb-0 py-2 small">
                                <i class="bi bi-lightning-charge me-1"></i>
                                Credits stack on your account and do not expire.
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-7 order-md-1">
                    <div class="card shadow-sm">
                        <div class="card-body p-4">
                            <h4 class="fw-bold mb-1">Buy <?= (int) $creditPack['credits'] ?> Credits</h4>
                            <p class="text-muted mb-4">Complete your one-time credit purchase.</p>

                            <?php if ($payhereConfigured): ?>
                            <div class="text-center mb-4">
                                <a href="https://www.payhere.lk" target="_blank">
                                    <img src="https://www.payhere.lk/downloads/images/payhere_square_banner.png" alt="PayHere" width="120" class="rounded">
                                </a>
                            </div>
                            <div id="payhere-status" class="d-none"></div>
                            <button id="payhere-pay-btn" class="btn btn-primary btn-lg w-100" onclick="initiatePayment()">
                                <i class="bi bi-lock-fill me-2"></i>Pay Now - <?= $totalDisplay ?>
                            </button>
                            <p class="text-muted small mt-3 mb-0 text-center">
                                <i class="bi bi-shield-check me-1"></i>Secure one-time payment via PayHere
                            </p>
                            <?php else: ?>
                            <div class="checkout-payment-placeholder text-center py-5">
                                <i class="bi bi-credit-card display-4 text-muted"></i>
                                <h5 class="mt-3 text-muted">Payment Coming Soon</h5>
                                <p class="text-muted small mb-4">PayHere is not configured yet.</p>
                                <button class="btn btn-primary btn-lg w-100" disabled>
                                    <i class="bi bi-lock-fill me-2"></i>Pay Now - <?= $totalDisplay ?>
                                </button>
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

if ($payhereConfigured) {
    $extraScripts = '\n<script src="' . ($payhereSandbox ? 'https://sandbox.payhere.lk' : 'https://www.payhere.lk') . '/lib/payhere.js"></script>\n<script>\npayhere.onCompleted = function onCompleted(orderId) {\n    window.cvTrackEvent && window.cvTrackEvent("credit_payment_popup_completed", { page: "/plans/checkout", order_id: orderId }, { keepalive: true });\n    document.getElementById("payhere-status").className = "alert alert-success";\n    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-check-circle me-2"></i>Payment completed! Redirecting...\';\n    window.location.href = "' . APP_URL . '/payment/success?order_id=" + encodeURIComponent(orderId);\n};\n\npayhere.onDismissed = function onDismissed() {\n    document.getElementById("payhere-status").className = "alert alert-warning";\n    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-exclamation-circle me-2"></i>Payment was cancelled. You can try again.\';\n    var btn = document.getElementById("payhere-pay-btn");\n    btn.disabled = false;\n    btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>Pay Now - ' . $totalDisplay . '\';\n};\n\npayhere.onError = function onError(error) {\n    document.getElementById("payhere-status").className = "alert alert-danger";\n    document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>Payment error: \' + error;\n    var btn = document.getElementById("payhere-pay-btn");\n    btn.disabled = false;\n    btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>Pay Now - ' . $totalDisplay . '\';\n};\n\nfunction initiatePayment() {\n    var btn = document.getElementById("payhere-pay-btn");\n    btn.disabled = true;\n    btn.innerHTML = \'<span class="spinner-border spinner-border-sm me-2"></span>Preparing payment...\';\n    document.getElementById("payhere-status").className = "d-none";\n\n    var formData = new FormData();\n    formData.append("_token", "' . Auth::generateToken() . '");\n    formData.append("purchase", "credits");\n\n    fetch("' . APP_URL . '/api/payment/hash", { method: "POST", body: formData })\n    .then(function(response) { return response.json(); })\n    .then(function(data) {\n        if (data.error) {\n            document.getElementById("payhere-status").className = "alert alert-danger";\n            document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>\' + data.error;\n            btn.disabled = false;\n            btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>Pay Now - ' . $totalDisplay . '\';\n            return;\n        }\n\n        payhere.startPayment({\n            sandbox: data.sandbox,\n            merchant_id: data.merchant_id,\n            return_url: undefined,\n            cancel_url: undefined,\n            notify_url: "' . APP_URL . '/payment/notify",\n            order_id: data.order_id,\n            items: data.items,\n            amount: data.amount,\n            currency: data.currency,\n            hash: data.hash,\n            first_name: data.first_name,\n            last_name: data.last_name,\n            email: data.email,\n            phone: "",\n            address: "",\n            city: "",\n            country: "",\n            custom_1: "' . Auth::id() . '",\n            custom_2: "credits"\n        });\n    })\n    .catch(function() {\n        document.getElementById("payhere-status").className = "alert alert-danger";\n        document.getElementById("payhere-status").innerHTML = \'<i class="bi bi-x-circle me-2"></i>Failed to initiate payment. Please try again.\';\n        btn.disabled = false;\n        btn.innerHTML = \'<i class="bi bi-lock-fill me-2"></i>Pay Now - ' . $totalDisplay . '\';\n    });\n}\n</script>';
}

include TEMPLATE_PATH . '/layouts/main.php';
