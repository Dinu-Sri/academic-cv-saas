<?php
$pageTitle = 'Create CV';
ob_start();
?>
<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <h2 class="fw-bold mb-4">Create New CV</h2>

            <form method="POST" action="<?= APP_URL ?>/cv/store">
                <?= Auth::csrfField() ?>

                <div class="mb-4">
                    <label for="name" class="form-label fw-semibold">CV Name</label>
                    <input type="text" class="form-control" id="name" name="name" 
                           required placeholder="e.g., Academic CV 2026, Job Application CV"
                           value="My Academic CV">
                    <div class="form-text">Give your CV a name to identify it later.</div>
                </div>

                <div class="mb-4">
                    <label class="form-label fw-semibold">Choose Template</label>
                    <div class="row g-3">
                        <?php foreach ($templates as $index => $template): ?>
                        <div class="col-md-4">
                            <div class="card template-select-card h-100 <?= $index === 0 ? 'border-primary' : '' ?>">
                                <div class="card-body text-center">
                                    <input type="radio" name="template_id" value="<?= $template['id'] ?>"
                                           id="template_<?= $template['id'] ?>"
                                           class="btn-check" <?= $index === 0 ? 'checked' : '' ?>>
                                    <label for="template_<?= $template['id'] ?>" class="stretched-link d-block">
                                        <div class="template-preview-icon mb-3">
                                            <i class="bi bi-file-text display-4 text-primary"></i>
                                        </div>
                                        <h6 class="fw-semibold"><?= e($template['name']) ?></h6>
                                        <p class="text-muted small mb-0"><?= e($template['description']) ?></p>
                                        <?php if ($template['is_premium']): ?>
                                            <span class="badge bg-warning mt-2">Premium</span>
                                        <?php endif; ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-plus-lg me-1"></i>Create CV
                    </button>
                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
