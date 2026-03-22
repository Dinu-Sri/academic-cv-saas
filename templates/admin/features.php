<?php
$pageTitle = 'Feature Management';
$categoryLabels = [
    'limits' => 'Plan Limits',
    'templates' => 'Templates',
    'import' => 'Import & Sync',
    'core' => 'Core Features',
    'auth' => 'Authentication',
    'editor' => 'CV Editor',
    'sections' => 'CV Sections',
    'support' => 'Support',
    'general' => 'General',
];
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-toggles me-2"></i>Feature Management</h2>
            <p class="text-muted mb-0">Control which features are available for each plan</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <form method="POST" action="<?= APP_URL ?>/admin/features/update">
        <?= Auth::csrfField() ?>

        <div class="card shadow-sm">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th style="width: 35%;">Feature</th>
                            <th class="text-center" style="width: 20%;">
                                <span class="badge bg-secondary">Free</span>
                            </th>
                            <th class="text-center" style="width: 20%;">
                                <span class="badge bg-primary">Pro</span>
                            </th>
                            <th class="text-center" style="width: 20%;">
                                <span class="badge bg-warning text-dark">Enterprise</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($grouped as $category => $categoryFeatures): ?>
                        <tr class="table-light">
                            <td colspan="4" class="fw-bold text-uppercase small text-muted py-2">
                                <?= e($categoryLabels[$category] ?? ucfirst($category)) ?>
                            </td>
                        </tr>
                        <?php foreach ($categoryFeatures as $feature): ?>
                        <tr>
                            <td>
                                <div class="fw-semibold"><?= e($feature['feature_name']) ?></div>
                                <?php if ($feature['description']): ?>
                                    <div class="text-muted small"><?= e($feature['description']) ?></div>
                                <?php endif; ?>
                            </td>
                            <?php foreach ($plans as $plan): ?>
                            <?php
                                $key = $plan . '_' . $feature['feature_key'];
                                $enabled = $matrix[$plan][$feature['feature_key']]['is_enabled'] ?? false;
                                $configVal = $matrix[$plan][$feature['feature_key']]['config_value'] ?? '';
                            ?>
                            <td class="text-center">
                                <?php if ($feature['value_type'] === 'number'): ?>
                                    <!-- Number input with toggle -->
                                    <div class="d-flex align-items-center justify-content-center gap-2">
                                        <div class="form-check form-switch mb-0">
                                            <input class="form-check-input" type="checkbox"
                                                   name="toggle[<?= $key ?>]" value="1"
                                                   <?= $enabled ? 'checked' : '' ?>>
                                        </div>
                                        <input type="text" class="form-control form-control-sm text-center"
                                               name="config[<?= $key ?>]"
                                               value="<?= e($configVal) ?>"
                                               style="width: 70px;"
                                               placeholder="—">
                                    </div>
                                <?php else: ?>
                                    <!-- Boolean toggle -->
                                    <div class="form-check form-switch d-flex justify-content-center mb-0">
                                        <input class="form-check-input" type="checkbox"
                                               name="toggle[<?= $key ?>]" value="1"
                                               <?= $enabled ? 'checked' : '' ?>>
                                    </div>
                                <?php endif; ?>
                            </td>
                            <?php endforeach; ?>
                        </tr>
                        <?php endforeach; ?>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="text-end mt-3">
            <button type="submit" class="btn btn-primary btn-lg">
                <i class="bi bi-check-lg me-1"></i>Save Changes
            </button>
        </div>
    </form>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
