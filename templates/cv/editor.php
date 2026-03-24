<?php
$pageTitle = 'Edit CV - ' . e($profile['name']);
$extraCss = '<link href="' . APP_URL . '/assets/css/editor.css" rel="stylesheet">';
$extraJs = '<script src="' . APP_URL . '/assets/js/editor.js"></script>';
ob_start();
?>
<div class="container-fluid py-3">
    <!-- Editor Header -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-3">
            <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary btn-sm">
                <i class="bi bi-arrow-left"></i>
            </a>
            <div>
                <h5 class="mb-0 fw-bold" id="cv-name"><?= e($profile['name']) ?></h5>
                <small class="text-muted">Template: <?= e($profile['template_name']) ?></small>
            </div>
        </div>
        <div class="d-flex gap-2 align-items-center">
            <span class="text-muted small" id="autosave-status">
                <i class="bi bi-cloud-check me-1"></i>Saved
            </span>
            <button class="btn btn-outline-primary btn-sm" id="btn-preview-latex" title="View LaTeX">
                <i class="bi bi-code-slash me-1"></i>LaTeX
            </button>
            <button class="btn btn-success btn-sm" id="btn-compile" data-cv-id="<?= $profile['id'] ?>">
                <i class="bi bi-filetype-pdf me-1"></i>Compile PDF
            </button>
            <?php if (!empty($profile['pdf_path'])): ?>
            <a href="<?= APP_URL ?>/cv/download/<?= $profile['id'] ?>" class="btn btn-primary btn-sm" id="btn-download-pdf">
                <i class="bi bi-download me-1"></i>Download
            </a>
            <button class="btn btn-outline-secondary btn-sm" onclick="openShareModal(<?= $profile['id'] ?>)" title="Share CV">
                <i class="bi bi-share"></i>
            </button>
            <?php endif; ?>
        </div>
    </div>

    <div class="row g-3">
        <!-- Left: Form Editor -->
        <div class="col-lg-7">
            <div class="editor-panel">
                <!-- Section Tabs -->
                <ul class="nav nav-tabs" id="sectionTabs" role="tablist">
                    <li class="nav-item">
                        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-personal" type="button">
                            <i class="bi bi-person me-1"></i>Personal Info
                        </button>
                    </li>
                    <?php foreach ($sections as $section):
                        if ($section['section_key'] === 'personal_info') continue; ?>
                    <li class="nav-item">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-<?= e($section['section_key']) ?>" type="button">
                            <?= e($section['display_name']) ?>
                            <?php if (!empty($section['entries'])): ?>
                                <i class="bi bi-check-circle-fill text-success ms-1" style="font-size: 0.7rem;"></i>
                            <?php endif; ?>
                        </button>
                    </li>
                    <?php endforeach; ?>
                </ul>

                <div class="tab-content" id="sectionTabContent">
                    <!-- Personal Info Tab -->
                    <div class="tab-pane fade show active p-3" id="tab-personal" role="tabpanel">
                        <?php
                        $personalFields = [];
                        foreach ($templateSections as $ts) {
                            if ($ts['section_key'] === 'personal_info') {
                                $personalFields = $ts['fields_schema'];
                                break;
                            }
                        }
                        $personalInfo = $profile['personal_info'] ?? [];
                        ?>
                        <form id="personal-info-form" data-cv-id="<?= $profile['id'] ?>">
                            <div class="row g-3">
                                <?php foreach ($personalFields as $field): ?>
                                <div class="<?= in_array($field['type'], ['textarea']) ? 'col-12' : 'col-md-6' ?>">
                                    <label for="pi_<?= e($field['name']) ?>" class="form-label">
                                        <?= e($field['label']) ?>
                                        <?php if (!empty($field['required'])): ?>
                                            <span class="text-danger">*</span>
                                        <?php endif; ?>
                                    </label>
                                    <?php if ($field['type'] === 'textarea'): ?>
                                        <textarea class="form-control personal-field" 
                                                  id="pi_<?= e($field['name']) ?>"
                                                  name="<?= e($field['name']) ?>"
                                                  rows="2"
                                                  placeholder="<?= e($field['placeholder'] ?? '') ?>"
                                        ><?= e($personalInfo[$field['name']] ?? '') ?></textarea>
                                    <?php else: ?>
                                        <input type="<?= e($field['type']) ?>" class="form-control personal-field"
                                               id="pi_<?= e($field['name']) ?>"
                                               name="<?= e($field['name']) ?>"
                                               value="<?= e($personalInfo[$field['name']] ?? '') ?>"
                                               placeholder="<?= e($field['placeholder'] ?? '') ?>"
                                               <?= !empty($field['required']) ? 'required' : '' ?>>
                                    <?php endif; ?>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </form>
                    </div>

                    <!-- Dynamic Section Tabs -->
                    <?php foreach ($sections as $section):
                        if ($section['section_key'] === 'personal_info') continue;
                        $entryIndex = 0;
                        $totalEntries = count($section['entries'] ?? []);
                    ?>
                    <div class="tab-pane fade p-3" id="tab-<?= e($section['section_key']) ?>" role="tabpanel">
                        <div class="d-flex justify-content-end mb-2 gap-2">
                            <?php if ($section['section_key'] === 'publications'): ?>
                                <?php
                                $featureModel = new Feature();
                                $doiEnabled = $featureModel->planHasFeature($userPlan, 'doi_autofill');
                                ?>
                                <?php if ($doiEnabled): ?>
                                    <button class="btn btn-outline-success btn-sm" id="btn-doi-fill"
                                            data-cv-id="<?= $profile['id'] ?>"
                                            data-section-key="publications">
                                        <i class="bi bi-journal-bookmark me-1"></i>Fill via DOI
                                    </button>
                                <?php else: ?>
                                    <a href="<?= APP_URL ?>/plans" class="btn btn-outline-secondary btn-sm" title="Upgrade to Pro to auto-fill from DOI">
                                        <i class="bi bi-lock me-1"></i>Fill via DOI
                                        <span class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem;">Pro</span>
                                    </a>
                                <?php endif; ?>
                            <?php endif; ?>
                            <button class="btn btn-outline-primary btn-sm btn-add-entry"
                                    data-section-id="<?= $section['id'] ?>"
                                    data-cv-id="<?= $profile['id'] ?>"
                                    data-section-key="<?= e($section['section_key']) ?>">
                                <i class="bi bi-plus-lg me-1"></i>Add Entry
                            </button>
                        </div>

                        <!-- Existing entries (collapsible) -->
                        <div class="entries-container" id="entries-<?= e($section['section_key']) ?>">
                            <?php if (empty($section['entries'])): ?>
                                <div class="text-center py-4 text-muted empty-state">
                                    <i class="bi bi-plus-circle display-6"></i>
                                    <p class="mt-2">No entries yet. Click "Add Entry" to begin.</p>
                                    <?php if ($section['section_key'] === 'skills'): ?>
                                        <p class="small fst-italic mb-0">Tip: Each entry is one category with its skills, e.g.<br><strong>Programming Languages</strong>: Python, C++, MATLAB, R</p>
                                    <?php endif; ?>
                                </div>
                            <?php else: ?>
                                <?php foreach ($section['entries'] as $entry):
                                    $entryIndex++;
                                    // Build summary from first non-empty field
                                    $entrySummary = '';
                                    foreach ($section['fields_schema'] as $f) {
                                        $val = $entry['data'][$f['name']] ?? '';
                                        if ($val !== '') { $entrySummary = $val; break; }
                                    }
                                    if (!$entrySummary) $entrySummary = 'Entry #' . $entryIndex;
                                ?>
                                <div class="card mb-2 entry-card" data-entry-id="<?= $entry['id'] ?>">
                                    <div class="card-header entry-header d-flex align-items-center" role="button">
                                        <div class="entry-reorder-btns me-2 d-flex flex-column gap-0">
                                            <button class="btn btn-sm btn-entry-move-up p-0" title="Move up" <?= $entryIndex === 1 ? 'disabled' : '' ?>>
                                                <i class="bi bi-chevron-up"></i>
                                            </button>
                                            <button class="btn btn-sm btn-entry-move-down p-0" title="Move down" <?= $entryIndex === $totalEntries ? 'disabled' : '' ?>>
                                                <i class="bi bi-chevron-down"></i>
                                            </button>
                                        </div>
                                        <span class="entry-summary flex-grow-1 text-truncate"><?= e(mb_strimwidth($entrySummary, 0, 80, '...')) ?></span>
                                        <i class="bi bi-chevron-down entry-toggle-icon ms-2"></i>
                                    </div>
                                    <div id="entry-body-<?= $entry['id'] ?>" class="collapse entry-body">
                                        <div class="card-body py-2">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div class="flex-grow-1">
                                                    <div class="row g-2">
                                                        <?php foreach ($section['fields_schema'] as $field): ?>
                                                        <div class="<?= $field['type'] === 'textarea' ? 'col-12' : 'col-md-6' ?>">
                                                            <label class="form-label small text-muted mb-0"><?= e($field['label']) ?></label>
                                                            <?php if ($field['type'] === 'textarea'): ?>
                                                                <textarea class="form-control form-control-sm entry-field"
                                                                          name="<?= e($field['name']) ?>" rows="2"
                                                                          data-entry-id="<?= $entry['id'] ?>"
                                                                          data-cv-id="<?= $profile['id'] ?>"
                                                                ><?= e($entry['data'][$field['name']] ?? '') ?></textarea>
                                                            <?php else: ?>
                                                                <input type="<?= e($field['type']) ?>"
                                                                       class="form-control form-control-sm entry-field"
                                                                       name="<?= e($field['name']) ?>"
                                                                       value="<?= e($entry['data'][$field['name']] ?? '') ?>"
                                                                       data-entry-id="<?= $entry['id'] ?>"
                                                                       data-cv-id="<?= $profile['id'] ?>">
                                                            <?php endif; ?>
                                                        </div>
                                                        <?php endforeach; ?>
                                                    </div>
                                                </div>
                                                <button class="btn btn-sm btn-outline-danger ms-2 btn-delete-entry"
                                                        data-entry-id="<?= $entry['id'] ?>"
                                                        data-cv-id="<?= $profile['id'] ?>" title="Remove">
                                                    <i class="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>

                        <!-- Hidden template for new entries -->
                        <template id="entry-template-<?= e($section['section_key']) ?>">
                            <div class="card mb-2 entry-card" data-entry-id="">
                                <div class="card-header entry-header d-flex align-items-center" role="button">
                                    <div class="entry-reorder-btns me-2 d-flex flex-column gap-0">
                                        <button class="btn btn-sm btn-entry-move-up p-0" title="Move up">
                                            <i class="bi bi-chevron-up"></i>
                                        </button>
                                        <button class="btn btn-sm btn-entry-move-down p-0" title="Move down">
                                            <i class="bi bi-chevron-down"></i>
                                        </button>
                                    </div>
                                    <span class="entry-summary flex-grow-1 text-truncate">New Entry</span>
                                    <i class="bi bi-chevron-down entry-toggle-icon ms-2"></i>
                                </div>
                                <div class="collapse show entry-body">
                                    <div class="card-body py-2">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div class="flex-grow-1">
                                                <div class="row g-2">
                                                    <?php foreach ($section['fields_schema'] as $field): ?>
                                                    <div class="<?= $field['type'] === 'textarea' ? 'col-12' : 'col-md-6' ?>">
                                                        <label class="form-label small text-muted mb-0"><?= e($field['label']) ?></label>
                                                        <?php if ($field['type'] === 'textarea'): ?>
                                                            <textarea class="form-control form-control-sm entry-field"
                                                                      name="<?= e($field['name']) ?>" rows="2"
                                                                      placeholder="<?= e($field['placeholder'] ?? '') ?>"></textarea>
                                                        <?php else: ?>
                                                            <input type="<?= e($field['type']) ?>"
                                                                   class="form-control form-control-sm entry-field"
                                                                   name="<?= e($field['name']) ?>"
                                                                   placeholder="<?= e($field['placeholder'] ?? '') ?>">
                                                        <?php endif; ?>
                                                    </div>
                                                    <?php endforeach; ?>
                                                </div>
                                            </div>
                                            <button class="btn btn-sm btn-outline-danger ms-2 btn-delete-entry" title="Remove">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Right: Preview Panel -->
        <div class="col-lg-5">
            <div class="preview-panel sticky-top" style="top: 70px; z-index: 100;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="fw-bold mb-0"><i class="bi bi-eye me-1"></i>Preview</h6>
                    <button class="btn btn-sm btn-outline-secondary" id="btn-refresh-preview">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="preview-frame bg-white border rounded">
                    <?php if (!empty($profile['pdf_path']) && file_exists($profile['pdf_path'])): ?>
                        <div class="text-center py-4 text-muted" id="pdf-loading">
                            <div class="spinner-border spinner-border-sm me-1"></div> Loading preview...
                        </div>
                        <iframe id="pdf-preview-frame" class="w-100 d-none" style="height: 70vh; border: none;"
                                data-pdf-url="<?= APP_URL ?>/cv/preview-data/<?= $profile['id'] ?>"></iframe></iframe>
                    <?php else: ?>
                        <div class="text-center py-5 text-muted" id="pdf-placeholder">
                            <i class="bi bi-filetype-pdf display-3"></i>
                            <p class="mt-3">Click <strong>Compile PDF</strong> to generate preview</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- LaTeX Preview Modal -->
<div class="modal fade" id="latexModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Generated LaTeX</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <pre><code id="latex-output" class="language-latex"></code></pre>
            </div>
        </div>
    </div>
</div>

<script>
    // Pass data to JS
    window.CV_DATA = {
        id: <?= $profile['id'] ?>,
        apiUrl: '<?= APP_URL ?>',
        csrfToken: '<?= Auth::generateToken() ?>'
    };
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
