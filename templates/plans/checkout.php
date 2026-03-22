<?php
$pageTitle = 'Checkout';
$planName = $selectedPlan['name'];
$isAnnual = ($billingCycle === 'annual');
$priceDisplay = $isAnnual ? '$0.50' : '$1.00';
$totalDisplay = $isAnnual ? '$6.00/year' : '$1.00/month';
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
                                <span><?= $isAnnual ? 'Annual' : 'Monthly' ?></span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Price</span>
                                <span><?= $priceDisplay ?>/mo</span>
                            </div>
                            <hr>
                            <div class="d-flex justify-content-between fw-bold fs-5">
                                <span>Total</span>
                                <span><?= $totalDisplay ?></span>
                            </div>

                            <?php if ($isAnnual): ?>
                            <div class="alert alert-success mt-3 mb-0 py-2 small">
                                <i class="bi bi-piggy-bank me-1"></i>
                                You save $6.00/year with the annual plan!
                            </div>
                            <?php endif; ?>

                            <!-- Toggle billing cycle -->
                            <div class="text-center mt-3">
                                <?php if ($isAnnual): ?>
                                    <a href="<?= APP_URL ?>/plans/checkout/pro?cycle=monthly" class="small text-muted">Switch to monthly billing</a>
                                <?php else: ?>
                                    <a href="<?= APP_URL ?>/plans/checkout/pro?cycle=annual" class="small text-primary">Switch to annual &amp; save 50%</a>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- What you get -->
                    <div class="card mt-3">
                        <div class="card-body p-4">
                            <h6 class="fw-bold mb-3">What's included in Pro</h6>
                            <ul class="list-unstyled mb-0 small">
                                <?php foreach ($selectedPlan['features'] as $feature): ?>
                                <li class="mb-2">
                                    <i class="bi bi-check-circle-fill text-success me-2"></i><?= e($feature) ?>
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
                            <h4 class="fw-bold mb-1">Upgrade to <?= e($planName) ?></h4>
                            <p class="text-muted mb-4">Complete your subscription</p>

                            <!-- Payment method placeholder -->
                            <div class="checkout-payment-placeholder text-center py-5">
                                <i class="bi bi-credit-card display-4 text-muted"></i>
                                <h5 class="mt-3 text-muted">Payment Coming Soon</h5>
                                <p class="text-muted small mb-4">We're integrating secure payment processing.<br>PayPal and card payments will be available shortly.</p>

                                <button class="btn btn-primary btn-lg w-100" disabled>
                                    <i class="bi bi-lock-fill me-2"></i>Subscribe Now — <?= $totalDisplay ?>
                                </button>
                                <p class="text-muted small mt-2 mb-0">
                                    <i class="bi bi-shield-check me-1"></i>
                                    Secure payment · Cancel anytime · No hidden fees
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
