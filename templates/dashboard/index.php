<?php
$pageTitle = 'Dashboard';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1">My CVs</h2>
            <p class="text-muted mb-0">
                <?= count($cvs) ?> CV<?= count($cvs) !== 1 ? 's' : '' ?> created
                <span class="mx-1">•</span>
                Plan: <span class="badge bg-primary"><?= ucfirst(e($user['subscription_plan'])) ?></span>
            </p>
        </div>
        <a href="<?= APP_URL ?>/cv/create" class="btn btn-primary">
            <i class="bi bi-plus-lg me-1"></i>New CV
        </a>
    </div>

    <?php if (!empty($cvs) && !$onboarding['compile_pdf']): ?>
    <!-- Draft compile nudge — shown until user compiles their first PDF -->
    <div class="alert alert-primary d-flex align-items-center gap-3 mb-4 shadow-sm" id="draft-compile-nudge"
         style="border-left:4px solid #0d6efd;">
        <i class="bi bi-filetype-pdf fs-3 text-primary flex-shrink-0"></i>
        <div class="flex-grow-1">
            <div class="fw-semibold">Your CV is ready to compile!</div>
            <div class="small text-muted">You've created a CV but haven't generated a PDF yet. One click and it's done.</div>
        </div>
        <a href="<?= APP_URL ?>/cv/edit/<?= (int)$cvs[0]['id'] ?>" class="btn btn-primary btn-sm flex-shrink-0">
            <i class="bi bi-filetype-pdf me-1"></i>Compile PDF Now
        </a>
        <button type="button" class="btn-close flex-shrink-0" aria-label="Dismiss"
                onclick="this.closest('#draft-compile-nudge').style.display='none';
                         localStorage.setItem('cvs_draft_nudge_dismissed','1');"></button>
    </div>
    <script>
        (function () {
            if (localStorage.getItem('cvs_draft_nudge_dismissed') === '1') {
                var el = document.getElementById('draft-compile-nudge');
                if (el) el.style.display = 'none';
            }
        })();
    </script>
    <?php endif; ?>

    <?php if ($showOnboarding): ?>
    <div class="card border-0 shadow-sm mb-4" id="onboarding-card">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h5 class="mb-1"><i class="bi bi-stars me-1 text-warning"></i>Getting Started</h5>
                    <p class="text-muted mb-0">Complete these 3 steps to finish your first CV workflow.</p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="dismiss-onboarding">
                    Dismiss
                </button>
            </div>
            <div class="row g-2">
                <div class="col-md-4">
                    <div class="p-2 rounded border <?= $onboarding['create_cv'] ? 'border-success bg-success-subtle' : 'border-light bg-light' ?>">
                        <div class="fw-semibold small"><?= $onboarding['create_cv'] ? 'Done' : 'Step 1' ?>: Create your first CV</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-2 rounded border <?= $onboarding['compile_pdf'] ? 'border-success bg-success-subtle' : 'border-light bg-light' ?>">
                        <div class="fw-semibold small"><?= $onboarding['compile_pdf'] ? 'Done' : 'Step 2' ?>: Compile PDF</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-2 rounded border <?= $onboarding['download_pdf'] ? 'border-success bg-success-subtle' : 'border-light bg-light' ?>">
                        <div class="fw-semibold small"><?= $onboarding['download_pdf'] ? 'Done' : 'Step 3' ?>: Download CV</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>
        (function () {
            var key = 'cvscholar_onboarding_dismissed';
            var card = document.getElementById('onboarding-card');
            var btn = document.getElementById('dismiss-onboarding');
            if (!card || !btn) return;

            if (localStorage.getItem(key) === '1') {
                card.style.display = 'none';
                return;
            }

            btn.addEventListener('click', function () {
                localStorage.setItem(key, '1');
                card.style.display = 'none';
            });
        })();
    </script>
    <?php endif; ?>

    <?php if (empty($cvs)): ?>
    <!-- Empty state -->
    <div class="text-center py-5">
        <i class="bi bi-file-earmark-plus display-1 text-muted"></i>
        <h4 class="mt-3">No CVs yet</h4>
        <p class="text-muted">Create your first professional academic CV in minutes.</p>
        <a href="<?= APP_URL ?>/cv/create" class="btn btn-primary btn-lg">
            <i class="bi bi-plus-lg me-1"></i>Create Your First CV
        </a>
    </div>
    <?php else: ?>
    <!-- CV Cards -->
    <div class="row g-4">
        <?php foreach ($cvs as $cv): ?>
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm cv-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0"><?= e($cv['name']) ?></h5>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="<?= APP_URL ?>/cv/edit/<?= $cv['id'] ?>">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><a class="dropdown-item" href="<?= APP_URL ?>/cv/preview/<?= $cv['id'] ?>" target="_blank">
                                    <i class="bi bi-eye me-2"></i>Preview PDF
                                </a></li>
                                <li><a class="dropdown-item" href="<?= APP_URL ?>/cv/download/<?= $cv['id'] ?>">
                                    <i class="bi bi-download me-2"></i>Download
                                </a></li>
                                <?php if (!empty($cv['pdf_path'])): ?>
                                <li><a class="dropdown-item" href="#" onclick="openShareModal(<?= $cv['id'] ?>); return false;">
                                    <i class="bi bi-share me-2"></i>Share
                                </a></li>
                                <?php endif; ?>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <form method="POST" action="<?= APP_URL ?>/cv/duplicate/<?= $cv['id'] ?>"
                                          data-confirm="Duplicate this CV with all its data?"
                                          data-confirm-title="Duplicate CV"
                                          data-confirm-btn="Yes, duplicate"
                                          data-confirm-type="info">
                                        <?= Auth::csrfField() ?>
                                        <button type="submit" class="dropdown-item">
                                            <i class="bi bi-copy me-2"></i>Duplicate
                                        </button>
                                    </form>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <form method="POST" action="<?= APP_URL ?>/cv/delete/<?= $cv['id'] ?>" 
                                          data-confirm="Delete this CV? This action cannot be undone."
                                          data-confirm-title="Delete CV"
                                          data-confirm-btn="Yes, delete">
                                        <?= Auth::csrfField() ?>
                                        <button type="submit" class="dropdown-item text-danger">
                                            <i class="bi bi-trash me-2"></i>Delete
                                        </button>
                                    </form>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <p class="text-muted small mb-3">
                        <i class="bi bi-layout-text-window me-1"></i><?= e($cv['template_name']) ?>
                    </p>
                    <p class="text-muted small mb-0">
                        <i class="bi bi-clock me-1"></i>
                        Updated <?= date('M j, Y', strtotime($cv['updated_at'])) ?>
                    </p>
                </div>
                <div class="card-footer bg-transparent">
                    <a href="<?= APP_URL ?>/cv/edit/<?= $cv['id'] ?>" class="btn btn-outline-primary btn-sm w-100">
                        <i class="bi bi-pencil me-1"></i>Edit CV
                    </a>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
