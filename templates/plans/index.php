<?php
$pageTitle = 'Plans & Pricing';
ob_start();
?>
<div class="container py-5">
    <!-- Header -->
    <div class="text-center mb-5">
        <h2 class="fw-bold mb-2">Choose Your Plan</h2>
        <p class="text-muted fs-5">Simple pricing for academics at every stage</p>

        <!-- Billing Toggle -->
        <div class="d-inline-flex align-items-center gap-3 mt-3 billing-toggle-wrap">
            <span class="billing-label" id="label-monthly">Monthly</span>
            <div class="form-check form-switch mb-0">
                <input class="form-check-input billing-toggle" type="checkbox" role="switch" id="billingToggle">
            </div>
            <span class="billing-label" id="label-annual">
                Annual <span class="badge bg-success-subtle text-success ms-1">Save 50%</span>
            </span>
        </div>
    </div>

    <!-- Pricing Cards -->
    <div class="row g-4 justify-content-center align-items-stretch">

        <!-- Free Plan -->
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 plan-card <?= $currentPlan === 'free' ? 'plan-current' : '' ?>">
                <div class="card-body d-flex flex-column p-4">
                    <div class="plan-header mb-4">
                        <h4 class="fw-bold mb-1">Free</h4>
                        <p class="text-muted small mb-3">Perfect to get started</p>
                        <div class="plan-price">
                            <span class="price-amount">$0</span>
                            <span class="price-period text-muted">/month</span>
                        </div>
                    </div>
                    <ul class="plan-features list-unstyled flex-grow-1">
                        <?php foreach ($plans['free']['features'] as $feature): ?>
                        <li><i class="bi bi-check-circle-fill text-success me-2"></i><?= e($feature) ?></li>
                        <?php endforeach; ?>
                    </ul>
                    <?php if ($currentPlan === 'free'): ?>
                        <button class="btn btn-outline-secondary w-100 mt-3" disabled>
                            <i class="bi bi-check-lg me-1"></i>Current Plan
                        </button>
                    <?php else: ?>
                        <button class="btn btn-outline-primary w-100 mt-3" disabled>Free Plan</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Pro Plan -->
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 plan-card plan-featured <?= $currentPlan === 'pro' ? 'plan-current' : '' ?>">
                <div class="plan-badge">Most Popular</div>
                <div class="card-body d-flex flex-column p-4">
                    <div class="plan-header mb-4">
                        <h4 class="fw-bold mb-1">Pro</h4>
                        <p class="text-muted small mb-3">For serious academics</p>
                        <div class="plan-price">
                            <span class="price-amount" data-monthly="$1" data-annual="$0.50">$1</span>
                            <span class="price-period text-muted">/month</span>
                        </div>
                        <div class="plan-billed text-muted small mt-1">
                            <span data-monthly="Billed monthly" data-annual="Billed $6/year">Billed monthly</span>
                        </div>
                    </div>
                    <ul class="plan-features list-unstyled flex-grow-1">
                        <?php foreach ($plans['pro']['features'] as $feature): ?>
                        <li><i class="bi bi-check-circle-fill text-success me-2"></i><?= e($feature) ?></li>
                        <?php endforeach; ?>
                    </ul>
                    <?php if ($currentPlan === 'pro'): ?>
                        <button class="btn btn-outline-secondary w-100 mt-3" disabled>
                            <i class="bi bi-check-lg me-1"></i>Current Plan
                        </button>
                    <?php else: ?>
                        <a href="<?= APP_URL ?>/plans/checkout/pro?cycle=monthly"
                           class="btn btn-primary btn-lg w-100 mt-3 checkout-btn"
                           data-plan="pro">
                            <i class="bi bi-rocket-takeoff me-1"></i>Upgrade to Pro
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Enterprise Plan -->
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 plan-card <?= $currentPlan === 'enterprise' ? 'plan-current' : '' ?>">
                <div class="card-body d-flex flex-column p-4">
                    <div class="plan-header mb-4">
                        <h4 class="fw-bold mb-1">Enterprise</h4>
                        <p class="text-muted small mb-3">For institutions & departments</p>
                        <div class="plan-price">
                            <span class="price-amount">Custom</span>
                        </div>
                        <div class="plan-billed text-muted small mt-1">Contact us for pricing</div>
                    </div>
                    <ul class="plan-features list-unstyled flex-grow-1">
                        <?php foreach ($plans['enterprise']['features'] as $feature): ?>
                        <li><i class="bi bi-check-circle-fill text-success me-2"></i><?= e($feature) ?></li>
                        <?php endforeach; ?>
                    </ul>
                    <a href="mailto:hello@cvscholar.com?subject=Enterprise%20Plan%20Inquiry" class="btn btn-outline-primary w-100 mt-3">
                        <i class="bi bi-envelope me-1"></i>Contact Sales
                    </a>
                </div>
            </div>
        </div>

    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    var toggle = document.getElementById('billingToggle');
    var priceEls = document.querySelectorAll('[data-monthly]');
    var billedEls = document.querySelectorAll('.plan-billed [data-monthly]');
    var checkoutBtns = document.querySelectorAll('.checkout-btn');
    var labelMonthly = document.getElementById('label-monthly');
    var labelAnnual = document.getElementById('label-annual');

    toggle.addEventListener('change', function() {
        var cycle = this.checked ? 'annual' : 'monthly';

        labelMonthly.classList.toggle('fw-bold', !this.checked);
        labelAnnual.classList.toggle('fw-bold', this.checked);

        priceEls.forEach(function(el) {
            el.textContent = el.getAttribute('data-' + cycle);
        });
        billedEls.forEach(function(el) {
            el.textContent = el.getAttribute('data-' + cycle);
        });
        checkoutBtns.forEach(function(btn) {
            var plan = btn.getAttribute('data-plan');
            btn.href = '<?= APP_URL ?>/plans/checkout/' + plan + '?cycle=' + cycle;
        });
    });

    // Set initial state
    labelMonthly.classList.add('fw-bold');
});
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
