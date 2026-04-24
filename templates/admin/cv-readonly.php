<?php
$pageTitle = 'CV Snapshot - ' . e($profile['name'] ?? 'CV');
ob_start();

$ownerName = $owner['full_name'] ?? $owner['username'] ?? $owner['email'] ?? 'Unknown User';
$personalInfo = is_array($profile['personal_info'] ?? null) ? $profile['personal_info'] : [];
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-eye me-2"></i>CV Snapshot (Read Only)</h2>
            <p class="text-muted mb-0">
                Owner: <?= e($ownerName) ?>
                <?php if (!empty($owner['email'])): ?>
                    - <?= e($owner['email']) ?>
                <?php endif; ?>
            </p>
        </div>
        <div class="d-flex gap-2">
            <?php if (!empty($profile['pdf_path'])): ?>
                <a href="<?= APP_URL ?>/cv/preview/<?= (int) $profile['id'] ?>" target="_blank" class="btn btn-outline-primary">
                    <i class="bi bi-file-earmark-pdf me-1"></i>Open Compiled PDF
                </a>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left me-1"></i>Back to Users
            </a>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-3"><strong>CV Name:</strong> <?= e($profile['name'] ?? '') ?></div>
                <div class="col-md-3"><strong>Template:</strong> <?= e($profile['template_name'] ?? '') ?></div>
                <div class="col-md-3"><strong>Last Updated:</strong> <?= !empty($profile['updated_at']) ? e(date('M j, Y H:i', strtotime((string) $profile['updated_at']))) : 'N/A' ?></div>
                <div class="col-md-3"><strong>Last Compiled:</strong> <?= !empty($profile['last_compiled_at']) ? e(date('M j, Y H:i', strtotime((string) $profile['last_compiled_at']))) : 'Not compiled' ?></div>
            </div>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-person-vcard me-2"></i>Personal Information</h5>
        </div>
        <div class="card-body">
            <?php if (empty($personalInfo)): ?>
                <p class="text-muted mb-0">No personal information has been filled yet.</p>
            <?php else: ?>
                <div class="row g-3">
                    <?php foreach ($personalInfo as $k => $v): ?>
                        <div class="col-md-6">
                            <div class="small text-muted text-uppercase mb-1"><?= e(str_replace('_', ' ', (string) $k)) ?></div>
                            <?php $personalValue = is_scalar($v) ? (string) $v : (json_encode($v, JSON_UNESCAPED_SLASHES) ?: ''); ?>
                            <div><?= nl2br(e($personalValue)) ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <?php foreach ($sections as $section): ?>
        <?php if (($section['section_key'] ?? '') === 'personal_info') continue; ?>
        <div class="card shadow-sm mb-3">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
                <h6 class="mb-0 fw-bold"><?= e($section['display_name'] ?? ucfirst(str_replace('_', ' ', (string) ($section['section_key'] ?? 'Section')))) ?></h6>
                <span class="badge bg-light text-dark"><?= count($section['entries'] ?? []) ?> entr<?= count($section['entries'] ?? []) === 1 ? 'y' : 'ies' ?></span>
            </div>
            <div class="card-body">
                <?php if (empty($section['entries'])): ?>
                    <p class="text-muted mb-0">No entries in this section yet.</p>
                <?php else: ?>
                    <?php foreach ($section['entries'] as $idx => $entry): ?>
                        <div class="border rounded p-3 mb-3">
                            <div class="fw-semibold mb-2">Entry #<?= (int) $idx + 1 ?></div>
                            <?php $entryData = is_array($entry['data'] ?? null) ? $entry['data'] : []; ?>
                            <?php if (empty($entryData)): ?>
                                <div class="text-muted">Empty entry.</div>
                            <?php else: ?>
                                <div class="row g-3">
                                    <?php foreach ($entryData as $fieldName => $fieldValue): ?>
                                        <div class="col-md-6">
                                            <div class="small text-muted text-uppercase mb-1"><?= e(str_replace('_', ' ', (string) $fieldName)) ?></div>
                                            <?php $entryValue = is_scalar($fieldValue) ? (string) $fieldValue : (json_encode($fieldValue, JSON_UNESCAPED_SLASHES) ?: ''); ?>
                                            <div><?= nl2br(e($entryValue)) ?></div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    <?php endforeach; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
