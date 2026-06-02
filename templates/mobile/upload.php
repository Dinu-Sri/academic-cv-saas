<?php
$pageTitle = $pageTitle ?? 'Upload your CV';
ob_start();
?>
<div class="container py-4" style="max-width: 560px;">
    <a href="<?= APP_URL ?>/mobile-start" class="btn btn-link text-decoration-none px-0 mb-2" style="color:#2B6CB0;">
        <i class="bi bi-arrow-left me-1"></i>Back
    </a>

    <?php if (!empty($error)): ?>
        <div class="alert alert-danger" role="alert"><?= e($error) ?></div>
    <?php endif; ?>

    <div class="mb-4">
        <h1 class="fw-bold mb-2" style="color:#1B2A4A; font-size:1.5rem;">Upload your existing CV</h1>
        <p class="text-muted mb-0">We will read your CV and prepare a polished academic version. You can refine everything on your laptop.</p>
    </div>

    <form method="POST" action="<?= APP_URL ?>/mobile-start/upload" enctype="multipart/form-data" id="mobileUploadForm">
        <?= Auth::csrfField() ?>

        <label for="cv_file" class="d-block w-100 text-center p-4 mb-3"
               style="border:2px dashed #9CB8D6; border-radius:16px; cursor:pointer; background:#F7FAFD;">
            <i class="bi bi-cloud-arrow-up fs-1" style="color:#2B6CB0;"></i>
            <div class="fw-semibold mt-2" style="color:#1B2A4A;">Tap to choose your CV</div>
            <div class="small text-muted">PDF, DOC, or DOCX</div>
            <div class="small fw-semibold mt-2" id="mobileFileName" style="color:#2B6CB0;"></div>
        </label>
        <input type="file" class="d-none" id="cv_file" name="cv_file" accept=".pdf,.doc,.docx" required>

        <button type="submit" class="btn btn-lg w-100 fw-semibold text-white" id="mobileUploadBtn"
                style="background:#2B6CB0; border-radius:12px;" disabled>
            <span class="btn-label">Prepare my CV</span>
            <span class="btn-spinner d-none"><span class="spinner-border spinner-border-sm me-2"></span>Preparing your CV...</span>
        </button>
        <p class="small text-muted text-center mt-3 mb-0">This can take up to a minute while we build your CV.</p>
    </form>
</div>

<script>
(function () {
    var input = document.getElementById('cv_file');
    var nameEl = document.getElementById('mobileFileName');
    var btn = document.getElementById('mobileUploadBtn');
    var form = document.getElementById('mobileUploadForm');

    input.addEventListener('change', function () {
        if (input.files && input.files.length) {
            nameEl.textContent = input.files[0].name;
            btn.disabled = false;
        } else {
            nameEl.textContent = '';
            btn.disabled = true;
        }
    });

    form.addEventListener('submit', function () {
        btn.disabled = true;
        btn.querySelector('.btn-label').classList.add('d-none');
        btn.querySelector('.btn-spinner').classList.remove('d-none');
    });
})();
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
