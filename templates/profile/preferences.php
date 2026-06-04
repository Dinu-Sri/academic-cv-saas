<?php $pageTitle = 'Privacy & Marketing Preferences'; ob_start(); ?>
<div class="container py-4" style="max-width: 800px;">
    <h1 class="h3 mb-1"><i class="bi bi-shield-check me-2 text-primary"></i>Privacy & Marketing Preferences</h1>
    <p class="text-muted mb-4">Manage your consent, marketing preferences, and data privacy settings.</p>

    <?php if (!empty($saved)): ?>
    <div class="alert alert-success"><i class="bi bi-check-circle me-1"></i> Preferences saved successfully.</div>
    <?php endif; ?>

    <form method="POST" action="<?= APP_URL ?>/profile/preferences">
        <?= Auth::csrfField() ?>

        <!-- Marketing Communications -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <h2 class="h6 mb-3">Marketing Communications</h2>
                <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="marketing_emails" name="marketing_emails" value="1"
                           <?= !empty($prefs['marketing_emails']) ? 'checked' : '' ?>>
                    <label class="form-check-label" for="marketing_emails">
                        <strong>Email marketing</strong>
                        <br><small class="text-muted">Receive product updates, new features, academic CV tips, and relevant offers by email.</small>
                    </label>
                </div>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="marketing_sms" name="marketing_sms" value="1"
                           <?= !empty($prefs['marketing_sms']) ? 'checked' : '' ?>>
                    <label class="form-check-label" for="marketing_sms">
                        <strong>SMS marketing</strong>
                        <br><small class="text-muted">Receive occasional product updates via SMS. Currently disabled by default. You will only receive SMS if you explicitly opt in.</small>
                    </label>
                </div>
            </div>
        </div>

        <!-- Product Updates -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <h2 class="h6 mb-3">Product Updates</h2>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="product_updates" name="product_updates" value="1"
                           <?= !empty($prefs['product_updates']) ? 'checked' : '' ?>>
                    <label class="form-check-label" for="product_updates">
                        <strong>Service &amp; product updates</strong>
                        <br><small class="text-muted">Important service notifications, security updates, and billing-related communications. These are transactional and may be sent regardless of marketing preferences.</small>
                    </label>
                </div>
            </div>
        </div>

        <!-- Cookie Consent -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <h2 class="h6 mb-3">Cookie Preferences</h2>
                <p class="small text-muted mb-3">Manage your cookie consent choices. Essential cookies cannot be disabled.</p>
                <div id="cookie-prefs-inline">
                    <label class="d-flex align-items-start gap-2 mb-2" style="opacity:.65">
                        <input type="checkbox" checked disabled class="mt-1">
                        <span><strong>Essential</strong><br><small class="text-muted">Required for the site to function</small></span>
                    </label>
                    <label class="d-flex align-items-start gap-2 mb-2">
                        <input type="checkbox" id="inline-functional" class="mt-1">
                        <span><strong>Functional</strong><br><small class="text-muted">Preferences, themes, settings</small></span>
                    </label>
                    <label class="d-flex align-items-start gap-2 mb-2">
                        <input type="checkbox" id="inline-analytics" class="mt-1">
                        <span><strong>Analytics</strong><br><small class="text-muted">Google Analytics, PostHog — product improvement</small></span>
                    </label>
                    <label class="d-flex align-items-start gap-2 mb-0">
                        <input type="checkbox" id="inline-marketing" class="mt-1">
                        <span><strong>Marketing</strong><br><small class="text-muted">Currently disabled — no advertising cookies</small></span>
                    </label>
                </div>
                <button type="button" class="btn btn-outline-secondary btn-sm mt-3" id="save-cookie-prefs">Save Cookie Preferences</button>
            </div>
        </div>

        <!-- Data & Privacy -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <h2 class="h6 mb-3">Your Data &amp; Privacy</h2>
                <p class="small text-muted mb-3">We never sell your personal data. You control what is shared.</p>
                <div class="d-flex flex-wrap gap-2">
                    <a href="<?= APP_URL ?>/privacy" class="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener">
                        <i class="bi bi-shield me-1"></i> Privacy Policy
                    </a>
                    <a href="<?= APP_URL ?>/terms" class="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener">
                        <i class="bi bi-file-text me-1"></i> Terms of Use
                    </a>
                    <a href="<?= APP_URL ?>/cookie-policy" class="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener">
                        <i class="bi bi-cookie me-1"></i> Cookie Policy
                    </a>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.dispatchEvent(new Event('cvscholar:cookie:show'))">
                        <i class="bi bi-gear me-1"></i> Cookie Settings
                    </button>
                </div>
            </div>
        </div>

        <!-- Terms Acceptance Status -->
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-body">
                <h2 class="h6 mb-3">Agreements</h2>
                <p class="small text-muted mb-2">
                    <i class="bi <?= !empty($prefs['terms_accepted_at']) ? 'bi-check-circle text-success' : 'bi-exclamation-circle text-warning' ?> me-1"></i>
                    Terms of Use <?= !empty($prefs['terms_accepted_at']) ? 'accepted on ' . date('M j, Y', strtotime($prefs['terms_accepted_at'])) : 'not yet accepted' ?>
                </p>
                <p class="small text-muted mb-0">
                    <i class="bi <?= !empty($prefs['privacy_accepted_at']) ? 'bi-check-circle text-success' : 'bi-exclamation-circle text-warning' ?> me-1"></i>
                    Privacy Policy <?= !empty($prefs['privacy_accepted_at']) ? 'accepted on ' . date('M j, Y', strtotime($prefs['privacy_accepted_at'])) : 'not yet accepted' ?>
                </p>
            </div>
        </div>

        <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-1"></i> Save All Preferences</button>
    </form>
</div>

<script>
(function(){
    var consent = (function(){
        try { return JSON.parse(localStorage.getItem('cvscholar_consent') || 'null'); } catch(e) { return null; }
    })();
    if (consent) {
        document.getElementById('inline-functional').checked = consent.functional;
        document.getElementById('inline-analytics').checked = consent.analytics;
        document.getElementById('inline-marketing').checked = consent.marketing;
    }
    document.getElementById('save-cookie-prefs').addEventListener('click', function(){
        var obj = {
            essential: true,
            functional: document.getElementById('inline-functional').checked,
            analytics: document.getElementById('inline-analytics').checked,
            marketing: document.getElementById('inline-marketing').checked,
            timestamp: Date.now()
        };
        localStorage.setItem('cvscholar_consent', JSON.stringify(obj));
        document.cookie = 'cvscholar_consent=' + encodeURIComponent(JSON.stringify(obj)) + ';path=/;max-age=' + (365*86400) + ';SameSite=Lax';
        alert('Cookie preferences saved.');
    });
})();
</script>
<?php $content = ob_get_clean(); include TEMPLATE_PATH . '/layouts/main.php'; ?>
