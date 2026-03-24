<?php
$pageTitle = 'Settings';
ob_start();
?>
<div class="container py-4" style="max-width: 820px;">
    <div class="mb-4">
        <h2 class="fw-bold mb-1"><i class="bi bi-gear me-2"></i>Settings</h2>
        <p class="text-muted mb-0">Configure default settings for all your CVs. These apply globally unless a template overrides them.</p>
    </div>

    <form method="POST" action="<?= APP_URL ?>/settings/update">
        <input type="hidden" name="<?= CSRF_TOKEN_NAME ?>" value="<?= Auth::generateToken() ?>">

        <!-- Page Layout -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h5 class="mb-0 fw-semibold"><i class="bi bi-file-earmark me-2"></i>Page Layout</h5>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label fw-medium">Page Size</label>
                        <select name="page_size" class="form-select">
                            <option value="A4" <?= ($settings['page_size'] ?? '') === 'A4' ? 'selected' : '' ?>>A4 (210 × 297 mm)</option>
                            <option value="Letter" <?= ($settings['page_size'] ?? '') === 'Letter' ? 'selected' : '' ?>>US Letter (8.5 × 11 in)</option>
                            <option value="Legal" <?= ($settings['page_size'] ?? '') === 'Legal' ? 'selected' : '' ?>>US Legal (8.5 × 14 in)</option>
                        </select>
                        <div class="form-text">A4 is standard in most countries. US Letter is common in North America.</div>
                    </div>
                </div>

                <hr class="my-3">
                <label class="form-label fw-medium">Margins</label>
                <div class="row g-3">
                    <div class="col-md-3 col-6">
                        <label class="form-label small text-muted">Top</label>
                        <div class="input-group input-group-sm">
                            <input type="text" name="margin_top" class="form-control" value="<?= e($settings['margin_top'] ?? '1in') ?>" placeholder="1in">
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <label class="form-label small text-muted">Bottom</label>
                        <div class="input-group input-group-sm">
                            <input type="text" name="margin_bottom" class="form-control" value="<?= e($settings['margin_bottom'] ?? '1in') ?>" placeholder="1in">
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <label class="form-label small text-muted">Left</label>
                        <div class="input-group input-group-sm">
                            <input type="text" name="margin_left" class="form-control" value="<?= e($settings['margin_left'] ?? '1in') ?>" placeholder="1in">
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <label class="form-label small text-muted">Right</label>
                        <div class="input-group input-group-sm">
                            <input type="text" name="margin_right" class="form-control" value="<?= e($settings['margin_right'] ?? '1in') ?>" placeholder="1in">
                        </div>
                    </div>
                </div>
                <div class="form-text mt-2">Use values like <code>1in</code>, <code>2.54cm</code>, or <code>25.4mm</code>. Standard academic CV uses 1 inch margins.</div>
            </div>
        </div>

        <!-- Typography -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h5 class="mb-0 fw-semibold"><i class="bi bi-fonts me-2"></i>Typography</h5>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label fw-medium">Font Family</label>
                        <select name="font_family" class="form-select">
                            <option value="serif" <?= ($settings['font_family'] ?? '') === 'serif' ? 'selected' : '' ?>>Serif (Computer Modern)</option>
                            <option value="sans" <?= ($settings['font_family'] ?? '') === 'sans' ? 'selected' : '' ?>>Sans-serif (CM Sans)</option>
                        </select>
                        <div class="form-text">Serif is the traditional academic standard.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-medium">Base Font Size</label>
                        <select name="font_size" class="form-select">
                            <option value="10" <?= ($settings['font_size'] ?? '') === '10' ? 'selected' : '' ?>>10pt — Compact</option>
                            <option value="11" <?= ($settings['font_size'] ?? '') === '11' ? 'selected' : '' ?>>11pt — Standard</option>
                            <option value="12" <?= ($settings['font_size'] ?? '') === '12' ? 'selected' : '' ?>>12pt — Large</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-medium">Line Spacing</label>
                        <select name="line_spacing" class="form-select">
                            <option value="compact" <?= ($settings['line_spacing'] ?? '') === 'compact' ? 'selected' : '' ?>>Compact</option>
                            <option value="normal" <?= ($settings['line_spacing'] ?? '') === 'normal' ? 'selected' : '' ?>>Normal</option>
                            <option value="relaxed" <?= ($settings['line_spacing'] ?? '') === 'relaxed' ? 'selected' : '' ?>>Relaxed</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Display Options -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h5 class="mb-0 fw-semibold"><i class="bi bi-eye me-2"></i>Display Options</h5>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label fw-medium">Date Format</label>
                        <select name="date_format" class="form-select">
                            <option value="F Y" <?= ($settings['date_format'] ?? '') === 'F Y' ? 'selected' : '' ?>>March 2026</option>
                            <option value="M Y" <?= ($settings['date_format'] ?? '') === 'M Y' ? 'selected' : '' ?>>Mar 2026</option>
                            <option value="m/Y" <?= ($settings['date_format'] ?? '') === 'm/Y' ? 'selected' : '' ?>>03/2026</option>
                            <option value="Y" <?= ($settings['date_format'] ?? '') === 'Y' ? 'selected' : '' ?>>2026</option>
                        </select>
                        <div class="form-text">Used for the "Last updated" footer date.</div>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="form-check form-switch mb-2">
                        <input class="form-check-input" type="checkbox" name="show_page_numbers" id="showPageNumbers"
                               <?= !empty($settings['show_page_numbers']) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="showPageNumbers">Show page numbers</label>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="show_last_updated" id="showLastUpdated"
                               <?= !empty($settings['show_last_updated']) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="showLastUpdated">Show "Last updated" date in footer</label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="d-flex justify-content-between align-items-center">
            <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left me-1"></i>Back to Dashboard
            </a>
            <button type="submit" class="btn btn-primary px-4">
                <i class="bi bi-check-lg me-1"></i>Save Settings
            </button>
        </div>
    </form>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
?>
