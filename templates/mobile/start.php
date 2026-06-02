<?php
$pageTitle = $pageTitle ?? 'Start your CV';
ob_start();
?>
<div class="container py-4" style="max-width: 560px;">
    <?= flash_messages() ?>

    <div class="text-center mb-4">
        <h1 class="fw-bold mb-2" style="color:#1B2A4A; font-size:1.6rem;">Start your CV on mobile. Finish beautifully on laptop.</h1>
        <p class="text-muted mb-0">Get a head start now. We will prepare your CV so you can complete and download it on a laptop in minutes.</p>
    </div>

    <div class="row g-3">
        <div class="col-12">
            <a href="<?= APP_URL ?>/mobile-start/upload" class="text-decoration-none">
                <div class="card border-0 shadow-sm h-100" style="border-radius:16px;">
                    <div class="card-body d-flex align-items-center gap-3 p-4">
                        <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                             style="width:56px; height:56px; background:#EBF4FB;">
                            <i class="bi bi-file-earmark-arrow-up fs-3" style="color:#2B6CB0;"></i>
                        </div>
                        <div>
                            <h2 class="h6 fw-bold mb-1" style="color:#1B2A4A;">I already have a CV</h2>
                            <p class="small text-muted mb-0">Upload your existing CV (PDF, DOC, or DOCX) and we will turn it into a polished academic CV.</p>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-12">
            <a href="<?= APP_URL ?>/mobile-start/manual" class="text-decoration-none">
                <div class="card border-0 shadow-sm h-100" style="border-radius:16px;">
                    <div class="card-body d-flex align-items-center gap-3 p-4">
                        <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                             style="width:56px; height:56px; background:#FBF3DE;">
                            <i class="bi bi-pencil-square fs-3" style="color:#E8A817;"></i>
                        </div>
                        <div>
                            <h2 class="h6 fw-bold mb-1" style="color:#1B2A4A;">I am starting fresh</h2>
                            <p class="small text-muted mb-0">Answer a few quick questions and we will build your first academic CV for you.</p>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </div>
                </div>
            </a>
        </div>
    </div>

    <div class="mt-4">
        <ul class="list-unstyled small text-muted mb-0">
            <li class="d-flex align-items-start gap-2 mb-2"><i class="bi bi-check-circle-fill" style="color:#2B6CB0;"></i><span>Built on our Classic Academic template trusted by scholars.</span></li>
            <li class="d-flex align-items-start gap-2 mb-2"><i class="bi bi-check-circle-fill" style="color:#2B6CB0;"></i><span>Your progress is saved automatically.</span></li>
            <li class="d-flex align-items-start gap-2"><i class="bi bi-check-circle-fill" style="color:#2B6CB0;"></i><span>Pick up exactly where you left off on your laptop.</span></li>
        </ul>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
