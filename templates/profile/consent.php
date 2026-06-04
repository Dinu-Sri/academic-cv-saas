<?php
$pageTitle = 'Accept Terms & Privacy Policy';
$prefs = $prefs ?? ['terms_accepted_at' => null, 'privacy_accepted_at' => null];
?>
<div class="container py-5" style="max-width: 600px;">
    <div class="text-center mb-4">
        <i class="bi bi-shield-check display-4 text-primary"></i>
        <h1 class="h3 mt-3">Welcome to CVScholar</h1>
        <p class="text-muted">Before you continue, please review and accept our terms.</p>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-4">
            <form method="POST" action="<?= APP_URL ?>/profile/consent">
                <?= Auth::csrfField() ?>

                <div class="mb-4 p-3 bg-light rounded">
                    <p class="mb-2 small text-muted">By using CVScholar, you agree to:</p>
                    <ul class="small text-muted mb-0 ps-3">
                        <li>Our <a href="<?= APP_URL ?>/terms" target="_blank" rel="noopener">Terms of Use</a> — governing your use of the platform</li>
                        <li>Our <a href="<?= APP_URL ?>/privacy" target="_blank" rel="noopener">Privacy Policy</a> — how we handle your data</li>
                        <li>Our <a href="<?= APP_URL ?>/cookie-policy" target="_blank" rel="noopener">Cookie Policy</a> — how we use cookies and tracking</li>
                    </ul>
                </div>

                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="accept_all" name="accept_all" required>
                    <label class="form-check-label" for="accept_all">
                        <strong>I accept the Terms of Use, Privacy Policy, and Cookie Policy.</strong>
                    </label>
                </div>

                <p class="small text-muted mb-4">
                    You can manage your preferences anytime in <strong>Profile Menu → Privacy Preferences</strong>.
                    We never sell your data. Email marketing is optional and can be turned off anytime.
                </p>

                <button type="submit" class="btn btn-primary btn-lg w-100">
                    <i class="bi bi-check2 me-2"></i>Accept & Continue
                </button>
            </form>
        </div>
    </div>
</div>
