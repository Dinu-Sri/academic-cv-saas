<?php
$pageTitle = 'Payment Settings';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-gear me-2"></i>Payment Settings</h2>
            <p class="text-muted mb-0">Configure PayHere payment gateway credentials</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <?= flash_messages() ?>

    <div class="row g-4">
        <!-- PayHere Configuration -->
        <div class="col-lg-8">
            <div class="card shadow-sm">
                <div class="card-header bg-white py-3">
                    <h5 class="mb-0 fw-bold"><i class="bi bi-credit-card me-2"></i>PayHere Configuration</h5>
                </div>
                <div class="card-body p-4">
                    <form method="POST" action="<?= APP_URL ?>/admin/settings/update">
                        <?= Auth::csrfField() ?>

                        <!-- Sandbox Mode Toggle -->
                        <div class="mb-4 p-3 rounded-3 <?= ($settings['payhere_sandbox'] ?? '1') === '1' ? 'bg-warning-subtle border border-warning' : 'bg-success-subtle border border-success' ?>">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="payhere_sandbox" name="payhere_sandbox" value="1"
                                    <?= ($settings['payhere_sandbox'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label fw-semibold" for="payhere_sandbox">
                                    <i class="bi bi-bug me-1"></i>Sandbox Mode
                                </label>
                            </div>
                            <p class="text-muted small mb-0 mt-1">
                                <?php if (($settings['payhere_sandbox'] ?? '1') === '1'): ?>
                                    Sandbox mode is <strong>ON</strong> — using test environment. No real charges.
                                <?php else: ?>
                                    Sandbox mode is <strong>OFF</strong> — using LIVE environment. Real payments will be processed!
                                <?php endif; ?>
                            </p>
                        </div>

                        <!-- Merchant ID -->
                        <div class="mb-3">
                            <label for="payhere_merchant_id" class="form-label fw-semibold">
                                Merchant ID <span class="text-danger">*</span>
                            </label>
                            <input type="text" class="form-control" id="payhere_merchant_id" name="payhere_merchant_id"
                                value="<?= e($settings['payhere_merchant_id'] ?? '') ?>"
                                placeholder="e.g. 12xxxxx" required>
                            <div class="form-text">Found in PayHere Dashboard → Settings → Domains &amp; Credentials</div>
                        </div>

                        <!-- Merchant Secret -->
                        <div class="mb-3">
                            <label for="payhere_merchant_secret" class="form-label fw-semibold">
                                Merchant Secret <span class="text-danger">*</span>
                            </label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="payhere_merchant_secret" name="payhere_merchant_secret"
                                    value="<?= e($settings['payhere_merchant_secret'] ?? '') ?>"
                                    placeholder="Enter merchant secret" required>
                                <button class="btn btn-outline-secondary" type="button" onclick="togglePassword('payhere_merchant_secret', this)">
                                    <i class="bi bi-eye"></i>
                                </button>
                            </div>
                            <div class="form-text">Used to generate payment hashes. Never shared publicly.</div>
                        </div>

                        <hr class="my-4">
                        <h6 class="fw-bold text-muted mb-3">
                            <i class="bi bi-arrow-repeat me-1"></i>Refund API Credentials
                            <span class="badge bg-secondary ms-1">Optional</span>
                        </h6>

                        <!-- App ID -->
                        <div class="mb-3">
                            <label for="payhere_app_id" class="form-label fw-semibold">App ID</label>
                            <input type="text" class="form-control" id="payhere_app_id" name="payhere_app_id"
                                value="<?= e($settings['payhere_app_id'] ?? '') ?>"
                                placeholder="e.g. 4xxxxxxxxxxxxxxxxxxxxxxx">
                            <div class="form-text">Required for refund processing. Found in PayHere Dashboard → Integrations → Server API.</div>
                        </div>

                        <!-- App Secret -->
                        <div class="mb-3">
                            <label for="payhere_app_secret" class="form-label fw-semibold">App Secret</label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="payhere_app_secret" name="payhere_app_secret"
                                    value="<?= e($settings['payhere_app_secret'] ?? '') ?>"
                                    placeholder="Enter app secret">
                                <button class="btn btn-outline-secondary" type="button" onclick="togglePassword('payhere_app_secret', this)">
                                    <i class="bi bi-eye"></i>
                                </button>
                            </div>
                            <div class="form-text">Required for refund processing.</div>
                        </div>

                        <hr class="my-4">

                        <!-- Currency -->
                        <div class="mb-4">
                            <label for="payhere_currency" class="form-label fw-semibold">Currency</label>
                            <select class="form-select" id="payhere_currency" name="payhere_currency" style="max-width: 200px;">
                                <option value="USD" <?= ($settings['payhere_currency'] ?? 'USD') === 'USD' ? 'selected' : '' ?>>USD — US Dollar</option>
                                <option value="LKR" <?= ($settings['payhere_currency'] ?? '') === 'LKR' ? 'selected' : '' ?>>LKR — Sri Lankan Rupee</option>
                                <option value="EUR" <?= ($settings['payhere_currency'] ?? '') === 'EUR' ? 'selected' : '' ?>>EUR — Euro</option>
                                <option value="GBP" <?= ($settings['payhere_currency'] ?? '') === 'GBP' ? 'selected' : '' ?>>GBP — British Pound</option>
                                <option value="AUD" <?= ($settings['payhere_currency'] ?? '') === 'AUD' ? 'selected' : '' ?>>AUD — Australian Dollar</option>
                            </select>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-check-lg me-1"></i>Save Settings
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Info Sidebar -->
        <div class="col-lg-4">
            <!-- Status Card -->
            <div class="card shadow-sm mb-3 <?= !empty($settings['payhere_merchant_id']) ? 'border-success' : 'border-warning' ?>">
                <div class="card-body text-center py-4">
                    <?php if (!empty($settings['payhere_merchant_id'])): ?>
                        <i class="bi bi-check-circle-fill text-success display-5"></i>
                        <h5 class="mt-2 fw-bold text-success">Configured</h5>
                        <p class="text-muted small mb-0">PayHere is ready to accept payments</p>
                    <?php else: ?>
                        <i class="bi bi-exclamation-triangle-fill text-warning display-5"></i>
                        <h5 class="mt-2 fw-bold text-warning">Not Configured</h5>
                        <p class="text-muted small mb-0">Enter your PayHere credentials to enable payments</p>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Notify URL Card -->
            <div class="card shadow-sm mb-3">
                <div class="card-body">
                    <h6 class="fw-bold mb-2"><i class="bi bi-link-45deg me-1"></i>Notify URL</h6>
                    <p class="small text-muted mb-2">Set this in your PayHere account settings:</p>
                    <div class="bg-light rounded p-2">
                        <code class="small text-break"><?= APP_URL ?>/payment/notify</code>
                    </div>
                    <p class="small text-muted mt-2 mb-0">
                        <i class="bi bi-info-circle me-1"></i>
                        This URL must be publicly accessible for PayHere to send payment notifications.
                    </p>
                </div>
            </div>

            <!-- Help Card -->
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="fw-bold mb-2"><i class="bi bi-question-circle me-1"></i>Where to find credentials</h6>
                    <ol class="small text-muted mb-0 ps-3">
                        <li class="mb-1">Log in to <a href="https://www.payhere.lk/merchant" target="_blank">PayHere Merchant</a></li>
                        <li class="mb-1"><strong>Merchant ID &amp; Secret:</strong> Settings → Domains &amp; Credentials</li>
                        <li class="mb-1"><strong>App ID &amp; Secret:</strong> Integrations → Server API</li>
                        <li class="mb-1">For sandbox testing, create a sandbox account at <a href="https://sandbox.payhere.lk" target="_blank">sandbox.payhere.lk</a></li>
                    </ol>
                </div>
            </div>

            <!-- PayHere Badge -->
            <div class="text-center mt-3">
                <a href="https://www.payhere.lk" target="_blank">
                    <img src="https://www.payhere.lk/downloads/images/payhere_square_banner.png" alt="PayHere" width="150" class="rounded">
                </a>
            </div>
        </div>
    </div>
</div>

<script>
function togglePassword(fieldId, btn) {
    const input = document.getElementById(fieldId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
