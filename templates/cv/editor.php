<?php
$pageTitle = 'Edit CV - ' . e($profile['name']);
$extraCss = '<link href="' . APP_URL . '/assets/css/editor.css" rel="stylesheet">';
$editorJsVersion = @filemtime(__DIR__ . '/../../public/assets/js/editor.js') ?: '1';
$extraJs = '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script><script src="' . APP_URL . '/assets/js/editor.js?v=' . $editorJsVersion . '"></script>';

$cvSettingsArr = [];
if (!empty($profile['cv_settings'])) {
    $cvSettingsArr = is_array($profile['cv_settings'])
        ? $profile['cv_settings']
        : json_decode($profile['cv_settings'], true);
    if (!is_array($cvSettingsArr)) {
        $cvSettingsArr = [];
    }
}
$templateStyleCfg = is_array($template['style_config'] ?? null) ? $template['style_config'] : [];
$currentColor = '#000000';

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
            <button class="btn btn-outline-secondary btn-sm" id="btn-format-help" title="Formatting help"
                    data-bs-toggle="modal" data-bs-target="#formatHelpModal">
                <i class="bi bi-type-bold me-1"></i>Formatting
            </button>
            <button class="btn btn-outline-secondary btn-sm" id="btn-manage-sections" title="Arrange sections"
                    data-bs-toggle="modal" data-bs-target="#sectionManagerModal">
                <i class="bi bi-arrows-move me-1"></i>Sections
            </button>
            <button class="btn btn-outline-primary btn-sm" id="btn-preview-latex" title="View LaTeX">
                <i class="bi bi-code-slash me-1"></i>LaTeX
            </button>
            <button class="btn btn-outline-success btn-sm" id="btn-compile" data-cv-id="<?= $profile['id'] ?>">
                <i class="bi bi-filetype-pdf me-1"></i>Compile
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
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-<?= e($section['section_key']) ?>" type="button"
                                data-section-id="<?= (int)$section['id'] ?>" data-section-key="<?= e($section['section_key']) ?>">
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
                                    <?php elseif ($field['type'] === 'select' && !empty($field['options']) && is_array($field['options'])): ?>
                                        <?php $selectedValue = (string)($personalInfo[$field['name']] ?? ($field['default'] ?? '')); ?>
                                        <select class="form-select personal-field"
                                                id="pi_<?= e($field['name']) ?>"
                                                name="<?= e($field['name']) ?>"
                                                <?= !empty($field['required']) ? 'required' : '' ?>>
                                            <?php foreach ($field['options'] as $opt): ?>
                                                <?php
                                                    $optValue = (string)($opt['value'] ?? '');
                                                    $optLabel = (string)($opt['label'] ?? $optValue);
                                                ?>
                                                <option value="<?= e($optValue) ?>" <?= $selectedValue === $optValue ? 'selected' : '' ?>><?= e($optLabel) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    <?php else: ?>
                                        <input type="<?= e($field['type']) ?>" class="form-control personal-field"
                                               id="pi_<?= e($field['name']) ?>"
                                               name="<?= e($field['name']) ?>"
                                               value="<?= e($personalInfo[$field['name']] ?? ($field['default'] ?? '')) ?>"
                                               placeholder="<?= e($field['placeholder'] ?? '') ?>"
                                               <?= !empty($field['required']) ? 'required' : '' ?>>
                                    <?php endif; ?>
                                    <?php if (!empty($field['help_text'])): ?>
                                        <div class="form-text small"><?= e($field['help_text']) ?></div>
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
                        $sectionVisible = !empty($section['is_visible']);
                    ?>
                    <div class="tab-pane fade p-3" id="tab-<?= e($section['section_key']) ?>" role="tabpanel">
                        <div class="d-flex justify-content-end mb-2 gap-2">
                            <?php if ($section['section_key'] === 'declaration'): ?>
                                <button class="btn btn-sm btn-toggle-section-visibility <?= $sectionVisible ? 'btn-success' : 'btn-outline-secondary' ?>"
                                        data-section-id="<?= (int)$section['id'] ?>"
                                        data-cv-id="<?= (int)$profile['id'] ?>"
                                        data-section-key="<?= e($section['section_key']) ?>"
                                        data-is-visible="<?= $sectionVisible ? '1' : '0' ?>">
                                    <i class="bi <?= $sectionVisible ? 'bi-toggle-on' : 'bi-toggle-off' ?> me-1"></i>
                                    Declaration <?= $sectionVisible ? 'On' : 'Off' ?>
                                </button>
                            <?php endif; ?>
                            <?php if ($section['section_key'] === 'publications'): ?>
                                <button class="btn btn-outline-success btn-sm" id="btn-doi-fill"
                                        data-cv-id="<?= $profile['id'] ?>"
                                        data-section-key="publications">
                                    <i class="bi bi-journal-bookmark me-1"></i>Fill via DOI
                                </button>
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
                                                        <?php
                                                            $fieldPlaceholder = $field['placeholder'] ?? '';
                                                            if ($fieldPlaceholder === '' && (($field['name'] ?? '') === 'year_end')) {
                                                                $fieldPlaceholder = 'e.g. Present';
                                                            }
                                                        ?>
                                                        <div class="<?= $field['type'] === 'textarea' ? 'col-12' : 'col-md-6' ?>">
                                                            <label class="form-label small text-muted mb-0"><?= e($field['label']) ?></label>
                                                            <?php if ($field['type'] === 'textarea'): ?>
                                                                <textarea class="form-control form-control-sm entry-field"
                                                                          name="<?= e($field['name']) ?>" rows="2"
                                                                          data-entry-id="<?= $entry['id'] ?>"
                                                                          data-cv-id="<?= $profile['id'] ?>"
                                                                          placeholder="<?= e($fieldPlaceholder) ?>"
                                                                          <?= !empty($field['required']) ? 'required' : '' ?>
                                                                ><?= e($entry['data'][$field['name']] ?? '') ?></textarea>
                                                            <?php elseif ($field['type'] === 'select' && !empty($field['options']) && is_array($field['options'])): ?>
                                                                <?php $selectedValue = (string)($entry['data'][$field['name']] ?? ($field['default'] ?? '')); ?>
                                                                <select class="form-select form-select-sm entry-field"
                                                                        name="<?= e($field['name']) ?>"
                                                                        data-entry-id="<?= $entry['id'] ?>"
                                                                    data-cv-id="<?= $profile['id'] ?>"
                                                                    <?= !empty($field['required']) ? 'required' : '' ?>>
                                                                    <?php foreach ($field['options'] as $opt): ?>
                                                                        <?php
                                                                            $optValue = (string)($opt['value'] ?? '');
                                                                            $optLabel = (string)($opt['label'] ?? $optValue);
                                                                        ?>
                                                                        <option value="<?= e($optValue) ?>" <?= $selectedValue === $optValue ? 'selected' : '' ?>><?= e($optLabel) ?></option>
                                                                    <?php endforeach; ?>
                                                                </select>
                                                            <?php else: ?>
                                                                <input type="<?= e($field['type']) ?>"
                                                                       class="form-control form-control-sm entry-field"
                                                                       name="<?= e($field['name']) ?>"
                                                                       value="<?= e($entry['data'][$field['name']] ?? ($field['default'] ?? '')) ?>"
                                                                       placeholder="<?= e($fieldPlaceholder) ?>"
                                                                       data-entry-id="<?= $entry['id'] ?>"
                                                                     data-cv-id="<?= $profile['id'] ?>"
                                                                     <?= !empty($field['required']) ? 'required' : '' ?>>
                                                            <?php endif; ?>
                                                            <?php if (!empty($field['help_text'])): ?>
                                                                <div class="form-text small"><?= e($field['help_text']) ?></div>
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
                                                    <?php
                                                        $fieldPlaceholder = $field['placeholder'] ?? '';
                                                        if ($fieldPlaceholder === '' && (($field['name'] ?? '') === 'year_end')) {
                                                            $fieldPlaceholder = 'e.g. Present';
                                                        }
                                                    ?>
                                                    <div class="<?= $field['type'] === 'textarea' ? 'col-12' : 'col-md-6' ?>">
                                                        <label class="form-label small text-muted mb-0"><?= e($field['label']) ?></label>
                                                        <?php if ($field['type'] === 'textarea'): ?>
                                                            <textarea class="form-control form-control-sm entry-field"
                                                                      name="<?= e($field['name']) ?>" rows="2"
                                                                      placeholder="<?= e($fieldPlaceholder) ?>"
                                                                      <?= !empty($field['required']) ? 'required' : '' ?>></textarea>
                                                        <?php elseif ($field['type'] === 'select' && !empty($field['options']) && is_array($field['options'])): ?>
                                                            <?php $selectedValue = (string)($field['default'] ?? ''); ?>
                                                            <select class="form-select form-select-sm entry-field"
                                                                    name="<?= e($field['name']) ?>"
                                                                    <?= !empty($field['required']) ? 'required' : '' ?>>
                                                                <?php foreach ($field['options'] as $opt): ?>
                                                                    <?php
                                                                        $optValue = (string)($opt['value'] ?? '');
                                                                        $optLabel = (string)($opt['label'] ?? $optValue);
                                                                    ?>
                                                                    <option value="<?= e($optValue) ?>" <?= $selectedValue === $optValue ? 'selected' : '' ?>><?= e($optLabel) ?></option>
                                                                <?php endforeach; ?>
                                                            </select>
                                                        <?php else: ?>
                                                            <input type="<?= e($field['type']) ?>"
                                                                   class="form-control form-control-sm entry-field"
                                                                   name="<?= e($field['name']) ?>"
                                                                   value="<?= e($field['default'] ?? '') ?>"
                                                                    placeholder="<?= e($fieldPlaceholder) ?>"
                                                                    <?= !empty($field['required']) ? 'required' : '' ?>>
                                                        <?php endif; ?>
                                                        <?php if (!empty($field['help_text'])): ?>
                                                            <div class="form-text small"><?= e($field['help_text']) ?></div>
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
                        <div id="pdf-preview-canvas" class="w-100 d-none" style="height: 70vh; overflow:auto; background:#fff;"
                             data-pdf-url="<?= APP_URL ?>/cv/preview-data/<?= $profile['id'] ?>"></div>
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

<!-- Formatting Help Modal -->
<div class="modal fade" id="formatHelpModal" tabindex="-1" aria-labelledby="formatHelpModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="formatHelpModalLabel">Text Formatting Help</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="mb-2">You can add basic formatting in text fields.</p>
                <table class="table table-sm small mb-3">
                    <thead><tr><th>Syntax</th><th>Output</th></tr></thead>
                    <tbody>
                        <tr><td><code>**bold text**</code></td><td><strong>bold text</strong></td></tr>
                        <tr><td><code>*italic text*</code></td><td><em>italic text</em></td></tr>
                    </tbody>
                </table>
                <div class="small text-muted mb-2">Example: <code>Published in *Nature*; led **five projects**.</code></div>
                <div class="alert alert-light border small mb-0">
                    Works in all text fields: descriptions, summary, skills, publications, etc.
                    Position/degree fields are already bold — use <em>*italic*</em> there for contrast.
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Section Manager Modal -->
<div class="modal fade" id="sectionManagerModal" tabindex="-1" aria-labelledby="sectionManagerModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h6 class="modal-title" id="sectionManagerModalLabel"><i class="bi bi-arrows-move me-1"></i>Arrange Sections</h6>
                <button type="button" class="btn-close btn-sm" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-2">
                <p class="text-muted small mb-2">Use arrows to reorder. Save to apply (page reloads).</p>
                <div id="section-order-list" class="border rounded"></div>
            </div>
            <div class="modal-footer py-2 justify-content-between">
                <button class="btn btn-outline-secondary btn-sm" id="btn-reset-section-order">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
                </button>
                <div class="d-flex gap-2">
                    <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="btn-save-section-order">Save</button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Sticky Compile Nudge Bar -->
<div id="compile-nudge-bar" style="display:none; position:fixed; bottom:0; left:0; right:0; z-index:1050;
     background:linear-gradient(90deg,#0d6efd 0%,#0a58ca 100%); color:#fff; padding:10px 20px;
     box-shadow:0 -2px 12px rgba(0,0,0,0.18);">
    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div class="d-flex align-items-center gap-2">
            <i class="bi bi-stars fs-5"></i>
            <span class="fw-semibold">Your first entry is saved — ready to compile your PDF?</span>
        </div>
        <div class="d-flex gap-2 align-items-center">
            <button class="btn btn-light btn-sm fw-semibold" id="nudge-compile-btn"
                    data-cv-id="<?= $profile['id'] ?>">
                <i class="bi bi-filetype-pdf me-1 text-danger"></i>Compile PDF Now
            </button>
            <button class="btn btn-close btn-close-white btn-sm" id="nudge-dismiss-btn" title="Dismiss"></button>
        </div>
    </div>
</div>

<!-- First-Time Welcome Modal -->
<div class="modal fade" id="welcomeModal" tabindex="-1" aria-labelledby="welcomeModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered" style="max-width:520px">
        <div class="modal-content border-0 shadow-lg overflow-hidden">
            <div style="background:linear-gradient(135deg,#0d6efd 0%,#0a58ca 100%); color:#fff; padding:2rem 2rem 1.5rem;">
                <div class="text-center mb-2">
                    <i class="bi bi-mortarboard-fill" style="font-size:2.8rem;"></i>
                </div>
                <h4 class="text-center fw-bold mb-1" id="welcomeModalLabel">Welcome to CVScholar!</h4>
                <p class="text-center mb-0" style="opacity:.9;font-size:.95rem;">Your academic CV is ready to build. Here's how easy it is:</p>
            </div>
            <div class="modal-body px-4 py-3">
                <ol class="list-unstyled mb-0">
                    <li class="d-flex align-items-start gap-3 mb-3">
                        <div class="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold flex-shrink-0" style="width:36px;height:36px;font-size:1rem;">1</div>
                        <div>
                            <div class="fw-semibold">Fill in your Personal Info</div>
                            <div class="text-muted small">Add your name, email, affiliation and other details in the <strong>Personal Info</strong> tab — it auto-saves as you type.</div>
                        </div>
                    </li>
                    <li class="d-flex align-items-start gap-3 mb-3">
                        <div class="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold flex-shrink-0" style="width:36px;height:36px;font-size:1rem;">2</div>
                        <div>
                            <div class="fw-semibold">Add your sections</div>
                            <div class="text-muted small">Click any tab (Education, Experience, Publications…) and use <strong>Add Entry</strong> to fill in your content.</div>
                        </div>
                    </li>
                    <li class="d-flex align-items-start gap-3 mb-3">
                        <div class="d-flex align-items-center justify-content-center rounded-circle bg-success text-white fw-bold flex-shrink-0" style="width:36px;height:36px;font-size:1rem;">3</div>
                        <div>
                            <div class="fw-semibold">Hit <span class="badge bg-success">Compile PDF</span></div>
                            <div class="text-muted small">Click the green button at the top right — your real LaTeX CV renders instantly in the preview panel.</div>
                        </div>
                    </li>
                </ol>
                <div class="alert alert-info border-0 py-2 px-3 small mb-0" style="background:#e8f4fd;">
                    <i class="bi bi-lightbulb-fill text-warning me-1"></i>
                    <strong>Tip:</strong> Required fields are marked with <span class="text-danger fw-bold">*</span>. Compile will tell you exactly what's missing.
                </div>
            </div>
            <div class="modal-footer border-0 px-4 pb-4 pt-0 justify-content-between">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="welcome-skip-btn">Skip for now</button>
                <button type="button" class="btn btn-primary px-4" id="welcome-start-btn">
                    <i class="bi bi-pencil-fill me-1"></i>Start building my CV
                </button>
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
        csrfToken: '<?= Auth::generateToken() ?>',
        primaryColor: '<?= htmlspecialchars($currentColor ?? '#003366') ?>',
        firstTime: <?= empty($profile['pdf_path']) ? 'true' : 'false' ?>,
        isNewCv: <?= (empty($profile['pdf_path']) && empty($profile['last_compiled_at'])) ? 'true' : 'false' ?>,

        sectionData: <?php
            $sectionDataForJS = [];
            foreach ($sections as $s) {
                if ($s['section_key'] === 'personal_info') continue;
                $defOrder = 99;
                foreach ($templateSections as $ts) {
                    if ($ts['section_key'] === $s['section_key']) {
                        $defOrder = (int)($ts['section_order'] ?? 99);
                        break;
                    }
                }
                $sectionDataForJS[] = [
                    'id'           => (int)$s['id'],
                    'key'          => $s['section_key'],
                    'name'         => $s['display_name'],
                    'defaultOrder' => $defOrder
                ];
            }
            echo json_encode($sectionDataForJS);
        ?>
    };
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
