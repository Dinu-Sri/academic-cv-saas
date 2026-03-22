<?php
$pageTitle = 'Templates';
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1">Template Gallery</h2>
            <p class="text-muted mb-0">Choose a template to start building your CV.</p>
        </div>
    </div>

    <div class="row g-4">
        <?php foreach ($templates as $template): ?>
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm">
                <div class="card-body text-center py-4">
                    <div class="mb-3">
                        <i class="bi bi-file-text display-3 text-primary"></i>
                    </div>
                    <h5 class="fw-bold"><?= e($template['name']) ?></h5>
                    <p class="text-muted"><?= e($template['description']) ?></p>
                    <?php if ($template['is_premium']): ?>
                        <span class="badge bg-warning mb-2">Premium</span>
                    <?php else: ?>
                        <span class="badge bg-success mb-2">Free</span>
                    <?php endif; ?>
                </div>
                <div class="card-footer bg-transparent text-center">
                    <a href="<?= APP_URL ?>/templates/preview/<?= $template['id'] ?>" class="btn btn-outline-primary btn-sm me-1">
                        <i class="bi bi-eye me-1"></i>Preview
                    </a>
                    <a href="<?= APP_URL ?>/cv/create?template=<?= $template['id'] ?>" class="btn btn-primary btn-sm">
                        <i class="bi bi-plus-lg me-1"></i>Use Template
                    </a>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
