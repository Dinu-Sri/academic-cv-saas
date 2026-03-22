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
                                <li><a class="dropdown-item" href="<?= APP_URL ?>/cv/preview/<?= $cv['id'] ?>">
                                    <i class="bi bi-eye me-2"></i>Preview PDF
                                </a></li>
                                <li><a class="dropdown-item" href="<?= APP_URL ?>/cv/download/<?= $cv['id'] ?>">
                                    <i class="bi bi-download me-2"></i>Download
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <form method="POST" action="<?= APP_URL ?>/cv/delete/<?= $cv['id'] ?>" 
                                          onsubmit="return confirm('Delete this CV?')">
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
