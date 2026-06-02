<?php
$pageTitle = $pageTitle ?? 'Start your CV';
$user = Auth::user();
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
        <h1 class="fw-bold mb-2" style="color:#1B2A4A; font-size:1.5rem;">A few quick questions</h1>
        <p class="text-muted mb-0">We will create your academic CV from these answers. You can add education, experience, and publications on your laptop.</p>
    </div>

    <form method="POST" action="<?= APP_URL ?>/mobile-start/manual" id="mobileManualForm">
        <?= Auth::csrfField() ?>

        <div class="mb-3">
            <label for="full_name" class="form-label fw-semibold">Full name <span class="text-danger">*</span></label>
            <input type="text" class="form-control form-control-lg" id="full_name" name="full_name" required
                   value="<?= e($user['full_name'] ?? '') ?>" placeholder="e.g., Dr. Jane Doe">
        </div>

        <div class="mb-3">
            <label for="title" class="form-label fw-semibold">Current title or role</label>
            <input type="text" class="form-control form-control-lg" id="title" name="title"
                   value="<?= e($user['title'] ?? '') ?>" placeholder="e.g., PhD Candidate, Lecturer">
        </div>

        <div class="mb-3">
            <label for="affiliation" class="form-label fw-semibold">Institution or affiliation</label>
            <input type="text" class="form-control form-control-lg" id="affiliation" name="affiliation"
                   value="<?= e($user['affiliation'] ?? '') ?>" placeholder="e.g., University of Oxford">
        </div>

        <div class="mb-3">
            <label for="field" class="form-label fw-semibold">Field or area of study</label>
            <input type="text" class="form-control form-control-lg" id="field" name="field"
                   placeholder="e.g., Molecular Biology">
        </div>

        <div class="mb-3">
            <label for="email" class="form-label fw-semibold">Email</label>
            <input type="email" class="form-control form-control-lg" id="email" name="email"
                   value="<?= e($user['email'] ?? '') ?>" placeholder="you@example.com">
        </div>

        <div class="mb-3">
            <label for="phone" class="form-label fw-semibold">Phone</label>
            <input type="text" class="form-control form-control-lg" id="phone" name="phone" placeholder="Optional">
        </div>

        <div class="mb-4">
            <label for="goal" class="form-label fw-semibold">What is this CV for?</label>
            <input type="text" class="form-control form-control-lg" id="goal" name="goal"
                   placeholder="e.g., PhD applications, faculty position">
        </div>

        <button type="submit" class="btn btn-lg w-100 fw-semibold text-white" id="mobileManualBtn"
                style="background:#2B6CB0; border-radius:12px;">
            <span class="btn-label">Build my CV</span>
            <span class="btn-spinner d-none"><span class="spinner-border spinner-border-sm me-2"></span>Building your CV...</span>
        </button>
        <p class="small text-muted text-center mt-3 mb-0">This can take up to a minute while we build your CV.</p>
    </form>
</div>

<script>
(function () {
    var form = document.getElementById('mobileManualForm');
    var btn = document.getElementById('mobileManualBtn');
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
