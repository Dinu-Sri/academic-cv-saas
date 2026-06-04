<!-- Cookie Consent Banner — GDPR / UK GDPR / CCPA compliant -->
<div id="cookie-consent-banner" class="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-modal="true" style="display:none;">
    <div class="cookie-banner-content">
        <div class="cookie-banner-body">
            <h3 id="cookie-title" class="cookie-banner-title">We value your privacy</h3>
            <p class="cookie-banner-text">
                We use cookies to provide our service, understand usage, and improve CVScholar.
                By clicking "Accept All", you consent to our use of cookies.
                <a href="<?= APP_URL ?>/cookie-policy" target="_blank" rel="noopener">Learn more</a> in our Cookie Policy.
            </p>
            <div id="cookie-customize-panel" class="cookie-customize" style="display:none;">
                <label class="cookie-toggle disabled">
                    <input type="checkbox" checked disabled> <span>Essential</span>
                    <small>Required for the site to function</small>
                </label>
                <label class="cookie-toggle">
                    <input type="checkbox" id="cookie-opt-functional" checked> <span>Functional</span>
                    <small>Preferences, themes, settings</small>
                </label>
                <label class="cookie-toggle">
                    <input type="checkbox" id="cookie-opt-analytics" checked> <span>Analytics</span>
                    <small>Google Analytics, PostHog — product improvement</small>
                </label>
                <label class="cookie-toggle">
                    <input type="checkbox" id="cookie-opt-marketing"> <span>Marketing</span>
                    <small>Currently disabled — no advertising cookies</small>
                </label>
            </div>
        </div>
        <div class="cookie-banner-actions">
            <button type="button" class="cookie-btn cookie-btn-outline" id="cookie-btn-customize">Customize</button>
            <button type="button" class="cookie-btn cookie-btn-outline" id="cookie-btn-reject">Reject All</button>
            <button type="button" class="cookie-btn cookie-btn-primary" id="cookie-btn-accept">Accept All</button>
        </div>
    </div>
</div>

<style>
.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -4px 24px rgba(0,0,0,.08);padding:16px 0;font-family:Inter,system-ui,sans-serif}
.cookie-banner-content{max-width:960px;margin:0 auto;padding:0 20px;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap}
.cookie-banner-body{flex:1;min-width:260px}
.cookie-banner-title{font-size:16px;font-weight:700;color:#1B2A4A;margin:0 0 6px}
.cookie-banner-text{font-size:14px;color:#4b5563;margin:0;line-height:1.55}
.cookie-banner-text a{color:#2B6CB0;font-weight:600;text-decoration:underline}
.cookie-banner-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;padding-top:4px}
.cookie-btn{border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .12s ease}
.cookie-btn-primary{background:#2B6CB0;color:#fff}
.cookie-btn-primary:hover{background:#245a96}
.cookie-btn-outline{background:#fff;color:#374151;border:1px solid #d1d5db}
.cookie-btn-outline:hover{background:#f3f4f6}
.cookie-customize{margin-top:12px;padding:12px 16px;background:#f8fafc;border-radius:8px;display:flex;flex-direction:column;gap:10px}
.cookie-toggle{display:flex;align-items:flex-start;gap:8px;font-size:14px;cursor:pointer}
.cookie-toggle input[type=checkbox]{margin-top:2px;accent-color:#2B6CB0}
.cookie-toggle span{font-weight:600;color:#1B2A4A}
.cookie-toggle small{display:block;color:#6b7280;font-weight:400}
.cookie-toggle.disabled{opacity:.65;cursor:default}
.cookie-toggle.disabled input{cursor:default}
@media(max-width:640px){
    .cookie-banner-content{flex-direction:column}
    .cookie-banner-actions{width:100%}
    .cookie-btn{flex:1;text-align:center}
}
</style>

<script>
(function(){
    var COOKIE_NAME = 'cvscholar_consent';
    var COOKIE_DAYS = 365;
    var banner = document.getElementById('cookie-consent-banner');
    var panel = document.getElementById('cookie-customize-panel');

    function getConsent() {
        try { return JSON.parse(localStorage.getItem(COOKIE_NAME) || 'null'); } catch(e) { return null; }
    }
    function setConsent(obj) {
        localStorage.setItem(COOKIE_NAME, JSON.stringify(obj));
        document.cookie = COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(obj)) + ';path=/;max-age=' + (COOKIE_DAYS*86400) + ';SameSite=Lax';
    }

    var existing = getConsent();
    if (!existing) {
        banner.style.display = 'block';
    }

    function hideBanner() { banner.style.display = 'none'; }

    function saveAndHide(cats) {
        setConsent({essential:true, functional:cats.functional, analytics:cats.analytics, marketing:cats.marketing, timestamp:Date.now()});
        hideBanner();
        if (cats.analytics && typeof gtag === 'function') { gtag('consent','update',{analytics_storage:'granted'}); }
    }

    document.getElementById('cookie-btn-accept').addEventListener('click', function(){
        saveAndHide({functional:true, analytics:true, marketing:true});
    });
    document.getElementById('cookie-btn-reject').addEventListener('click', function(){
        saveAndHide({functional:false, analytics:false, marketing:false});
    });
    document.getElementById('cookie-btn-customize').addEventListener('click', function(){
        var isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        this.textContent = isOpen ? 'Customize' : 'Save Preferences';
        if (isOpen) return;
        this.addEventListener('click', function handler(){
            saveAndHide({
                functional: document.getElementById('cookie-opt-functional').checked,
                analytics: document.getElementById('cookie-opt-analytics').checked,
                marketing: document.getElementById('cookie-opt-marketing').checked
            });
            this.removeEventListener('click', handler);
            this.textContent = 'Customize';
        }, {once:true});
    });

    // Allow re-opening from Cookie Settings link
    document.addEventListener('cvscholar:cookie:show', function(){
        banner.style.display = 'block';
        panel.style.display = 'flex';
        document.getElementById('cookie-btn-customize').textContent = 'Save Preferences';
    });
})();
</script>
