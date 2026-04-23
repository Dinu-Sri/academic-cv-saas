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
                    <?php $userPlan = $user['subscription_plan'] ?? 'free'; ?>
                    <div class="row g-3">
                        <?php foreach ($templates as $index => $template): ?>
                        <?php $isLocked = $template['is_premium'] && $userPlan === 'free'; ?>
                        <div class="col-md-4">
                            <div class="card template-select-card h-100 <?= $index === 0 ? 'border-primary' : '' ?> <?= $isLocked ? 'opacity-75' : '' ?> position-relative">
                                <?php if ($isLocked): ?>
                                <div class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center rounded"
                                     style="background:rgba(255,255,255,0.85);z-index:2;pointer-events:none">
                                    <i class="bi bi-lock-fill text-warning fs-3"></i>
                                    <span class="badge bg-warning text-dark mt-1">Pro Plan Required</span>
                                </div>
                                <?php endif; ?>
                                <div class="card-body text-center">
                                    <input type="radio" name="template_id" value="<?= $template['id'] ?>"
                                           id="template_<?= $template['id'] ?>"
                                           class="btn-check template-radio"
                                           data-locked="<?= $isLocked ? '1' : '0' ?>"
                                           <?= $index === 0 && !$isLocked ? 'checked' : '' ?>>
                                    <label for="template_<?= $template['id'] ?>" class="stretched-link d-block">
                                        <div class="template-preview-icon mb-3">
                                            <i class="bi bi-file-text display-4 <?= $isLocked ? 'text-secondary' : 'text-primary' ?>"></i>
                                        </div>
                                        <h6 class="fw-semibold"><?= e($template['name']) ?></h6>
                                        <p class="text-muted small mb-0"><?= e($template['description']) ?></p>
                                        <?php if ($template['is_premium']): ?>
                                            <?php if ($isLocked): ?>
                                            <a href="<?= APP_URL ?>/plans" class="btn btn-warning btn-sm mt-2"
                                               style="position:relative;z-index:3;pointer-events:all">
                                                <i class="bi bi-arrow-up-circle me-1"></i>Upgrade
                                            </a>
                                            <?php else: ?>
                                            <span class="badge bg-warning mt-2">Premium</span>
                                            <?php endif; ?>
                                        <?php endif; ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-primary" id="createCvBtn">
                        <i class="bi bi-plus-lg me-1"></i>Create CV
                    </button>
                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
document.querySelector('form').addEventListener('submit', function(e) {
    const checked = document.querySelector('.template-radio:checked');
    if (checked && checked.dataset.locked === '1') {
        e.preventDefault();
        if (confirm('This template requires the Pro plan. Go to the plans page to upgrade?')) {
            window.location.href = '<?= APP_URL ?>/plans';
        }
    }
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
