<?php
$pageTitle = $pageTitle ?? 'Your CV is ready';
$user = Auth::user();
$pdfReady = !empty($session['pdf_generation_status']) && $session['pdf_generation_status'] === 'success' && !empty($profile['pdf_path']);
$csrf = Auth::generateToken();
$waText = rawurlencode('Here is my CVScholar laptop link to finish my CV: ' . $continueUrl);
ob_start();
?>
<div class="container py-4" style="max-width: 560px;">
    <?= flash_messages() ?>

    <div class="text-center mb-4">
        <div class="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
             style="width:64px; height:64px; background:#E8F6EE;">
            <i class="bi bi-check-lg fs-1" style="color:#1E9E5A;"></i>
        </div>
        <h1 class="fw-bold mb-2" style="color:#1B2A4A; font-size:1.5rem;">Your CV draft is ready!</h1>
        <p class="text-muted mb-0">We have prepared your academic CV. Finish the remaining sections and download the final version on your laptop.</p>
    </div>

    <div class="card border-0 shadow-sm mb-4" style="border-radius:16px; overflow:hidden;">
        <?php if ($pdfReady): ?>
            <iframe src="<?= APP_URL ?>/cv/preview/<?= (int) $profile['id'] ?>" title="CV preview"
                    style="width:100%; height:360px; border:0; background:#f1f1f1;"></iframe>
        <?php else: ?>
            <div class="p-4 text-center text-muted">
                <i class="bi bi-hourglass-split fs-3 d-block mb-2" style="color:#E8A817;"></i>
                Your draft is saved. PDF preview is being prepared. You can continue editing on laptop.
            </div>
        <?php endif; ?>
    </div>

    <a href="<?= e($continueUrl) ?>" class="btn btn-lg w-100 fw-semibold text-white mb-3"
       style="background:#2B6CB0; border-radius:12px;">
        <i class="bi bi-laptop me-2"></i>Continue on Laptop
    </a>

    <div class="d-grid gap-2 mb-3">
        <button type="button" class="btn btn-outline-primary btn-lg fw-semibold" id="emailLinkBtn" style="border-radius:12px;">
            <i class="bi bi-envelope me-2"></i>Email me the laptop link
        </button>

        <a href="https://wa.me/?text=<?= $waText ?>" target="_blank" rel="noopener"
           class="btn btn-outline-success btn-lg fw-semibold" id="whatsappLinkBtn" style="border-radius:12px;">
            <i class="bi bi-whatsapp me-2"></i>Send link to WhatsApp
        </a>

        <button type="button" class="btn btn-outline-secondary btn-lg fw-semibold" id="copyLinkBtn" style="border-radius:12px;">
            <i class="bi bi-clipboard me-2"></i>Copy link
        </button>
    </div>

    <div class="text-center">
        <a href="<?= APP_URL ?>/mobile-start" class="text-decoration-none text-muted small">I will continue later</a>
    </div>

    <div id="readyToast" class="position-fixed start-50 translate-middle-x px-3 py-2 rounded text-white small d-none"
         style="bottom:24px; background:#1B2A4A; z-index:1080;"></div>
</div>

<script>
(function () {
    var cvId = <?= (int) $profile['id'] ?>;
    var csrf = <?= json_encode($csrf) ?>;
    var tokenName = <?= json_encode(CSRF_TOKEN_NAME) ?>;
    var continueUrl = <?= json_encode($continueUrl) ?>;
    var base = <?= json_encode(APP_URL) ?>;
    var toast = document.getElementById('readyToast');

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.remove('d-none');
        setTimeout(function () { toast.classList.add('d-none'); }, 3200);
    }

    function post(url, body) {
        var data = new URLSearchParams();
        data.append(tokenName, csrf);
        Object.keys(body || {}).forEach(function (k) { data.append(k, body[k]); });
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString()
        });
    }

    document.getElementById('emailLinkBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        post(base + '/mobile-cv-ready/' + cvId + '/email', {})
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                showToast(res.ok ? (res.j.message || 'We emailed your laptop link.') : (res.j.error || 'We could not send the email right now. Please copy the laptop link instead.'));
            })
            .catch(function () { showToast('We could not send the email right now. Please copy the laptop link instead.'); })
            .finally(function () { btn.disabled = false; });
    });

    document.getElementById('whatsappLinkBtn').addEventListener('click', function () {
        post(base + '/mobile-cv-ready/' + cvId + '/track', { channel: 'whatsapp' });
    });

    document.getElementById('copyLinkBtn').addEventListener('click', function () {
        var done = function () {
            showToast('Link copied. Open it on your laptop.');
            post(base + '/mobile-cv-ready/' + cvId + '/track', { channel: 'copy' });
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(continueUrl).then(done).catch(function () {
                window.prompt('Copy this link:', continueUrl);
                done();
            });
        } else {
            window.prompt('Copy this link:', continueUrl);
            done();
        }
    });
})();
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
