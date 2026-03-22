<?php
$pageTitle = 'Preview - ' . e($template['name']);
ob_start();
?>
<div class="container py-4">
    <div class="mb-4">
        <a href="<?= APP_URL ?>/templates" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-arrow-left me-1"></i>Back to Templates
        </a>
    </div>

    <div class="row">
        <div class="col-md-8">
            <h3 class="fw-bold"><?= e($template['name']) ?></h3>
            <p class="text-muted"><?= e($template['description']) ?></p>

            <h5 class="mt-4 mb-3">Sections Included:</h5>
            <div class="list-group">
                <?php foreach ($sections as $section): ?>
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong><?= e($section['display_name']) ?></strong>
                            <?php if ($section['is_required']): ?>
                                <span class="badge bg-primary ms-1">Required</span>
                            <?php endif; ?>
                        </div>
                        <span class="text-muted small">
                            <?= count($section['fields_schema']) ?> fields
                        </span>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <div class="mt-4">
                <a href="<?= APP_URL ?>/cv/create?template=<?= $template['id'] ?>" class="btn btn-primary">
                    <i class="bi bi-plus-lg me-1"></i>Create CV with this Template
                </a>
            </div>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
