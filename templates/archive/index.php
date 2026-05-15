<?php
$pageTitle = 'My Archive';
$personalFields = [
    'full_name' => 'Full name',
    'title' => 'Title',
    'affiliation' => 'Affiliation',
    'email' => 'Email',
    'phone' => 'Phone',
    'location' => 'Location',
    'website' => 'Website',
    'linkedin' => 'LinkedIn',
    'orcid' => 'ORCID',
    'google_scholar' => 'Google Scholar',
];
ob_start();
?>
<div class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
            <h4 class="fw-bold mb-1"><i class="bi bi-archive me-2"></i>My Archive</h4>
            <p class="text-muted mb-0">Your account-level CV data. New CVs can reuse these records even after old CVs are deleted.</p>
        </div>
        <a href="<?= APP_URL ?>/profile/import" class="btn btn-outline-secondary">
            <i class="bi bi-magic me-1"></i>Import More
        </a>
    </div>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white">
            <h5 class="fw-bold mb-1"><i class="bi bi-person-lines-fill me-2"></i>Profile Details</h5>
            <div class="small text-muted">These details pre-fill new CVs and import results.</div>
        </div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/archive/personal">
                <?= Auth::csrfField() ?>
                <div class="row g-3">
                    <?php foreach ($personalFields as $key => $label): ?>
                    <div class="col-md-6">
                        <label class="form-label small fw-semibold" for="personal-<?= e($key) ?>"><?= e($label) ?></label>
                        <input type="text" class="form-control" id="personal-<?= e($key) ?>" name="personal_info[<?= e($key) ?>]" value="<?= e($personalInfo[$key] ?? ($fullUser[$key] ?? '')) ?>">
                    </div>
                    <?php endforeach; ?>
                </div>
                <button type="submit" class="btn btn-primary mt-3"><i class="bi bi-save me-1"></i>Save Profile Details</button>
            </form>
        </div>
    </div>

    <div class="card border-0 shadow-sm mb-4" id="publications">
        <div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
                <h5 class="fw-bold mb-1"><i class="bi bi-journal-check me-2"></i>Publication Archive</h5>
                <div class="small text-muted">Approved publications saved to your account.</div>
            </div>
            <span class="badge bg-success-subtle text-success"><?= count($approvedPublications) ?> approved</span>
        </div>
        <div class="card-body">
            <?php if (empty($approvedPublications)): ?>
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-journal-x fs-1"></i>
                    <p class="mt-2 mb-0">No approved publications yet.</p>
                </div>
            <?php else: ?>
                <div class="accordion" id="publicationArchiveAccordion">
                    <?php foreach ($approvedPublications as $pub): ?>
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#pub-<?= (int) $pub['id'] ?>">
                                <span class="fw-semibold me-2"><?= e($pub['title']) ?></span>
                                <span class="small text-muted"><?= e($pub['year'] ?? '') ?></span>
                            </button>
                        </h2>
                        <div id="pub-<?= (int) $pub['id'] ?>" class="accordion-collapse collapse" data-bs-parent="#publicationArchiveAccordion">
                            <div class="accordion-body">
                                <form method="POST" action="<?= APP_URL ?>/archive/publication/update" class="row g-3">
                                    <?= Auth::csrfField() ?>
                                    <input type="hidden" name="publication_id" value="<?= (int) $pub['id'] ?>">
                                    <div class="col-md-8">
                                        <label class="form-label small fw-semibold">Title</label>
                                        <input type="text" class="form-control" name="title" value="<?= e($pub['title'] ?? '') ?>" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label small fw-semibold">Year</label>
                                        <input type="number" class="form-control" name="year" value="<?= e($pub['year'] ?? '') ?>">
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label small fw-semibold">Authors</label>
                                        <input type="text" class="form-control" name="authors" value="<?= e($pub['authors'] ?? '') ?>">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold">Venue</label>
                                        <input type="text" class="form-control" name="venue" value="<?= e($pub['venue'] ?? '') ?>">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-semibold">DOI</label>
                                        <input type="text" class="form-control" name="doi" value="<?= e($pub['doi'] ?? '') ?>">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-semibold">URL</label>
                                        <input type="text" class="form-control" name="url" value="<?= e($pub['url'] ?? '') ?>">
                                    </div>
                                    <div class="col-12 d-flex gap-2">
                                        <button type="submit" class="btn btn-primary btn-sm"><i class="bi bi-save me-1"></i>Save</button>
                                        <button type="submit" formaction="<?= APP_URL ?>/archive/publication/delete" class="btn btn-outline-danger btn-sm" data-confirm="Delete this publication from your archive?" data-confirm-title="Delete Publication" data-confirm-type="danger" data-confirm-btn="Delete">
                                            <i class="bi bi-trash me-1"></i>Delete
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-header bg-white">
            <h5 class="fw-bold mb-1"><i class="bi bi-collection me-2"></i>Section Data</h5>
            <div class="small text-muted">Entries stored globally for reuse in future CVs.</div>
        </div>
        <div class="card-body">
            <?php if (empty($entriesBySection)): ?>
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-inboxes fs-1"></i>
                    <p class="mt-2 mb-0">No reusable section entries yet.</p>
                </div>
            <?php else: ?>
                <div class="accordion" id="archiveSectionsAccordion">
                    <?php foreach ($entriesBySection as $sectionKey => $entries): ?>
                    <?php $sectionId = preg_replace('/[^a-z0-9_-]/i', '-', $sectionKey); ?>
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button <?= $activeSection === $sectionKey ? '' : 'collapsed' ?>" type="button" data-bs-toggle="collapse" data-bs-target="#section-<?= e($sectionId) ?>">
                                <span class="fw-semibold me-2"><?= e($sectionLabels[$sectionKey] ?? ucwords(str_replace('_', ' ', $sectionKey))) ?></span>
                                <span class="badge bg-secondary"><?= count($entries) ?></span>
                            </button>
                        </h2>
                        <div id="section-<?= e($sectionId) ?>" class="accordion-collapse collapse <?= $activeSection === $sectionKey ? 'show' : '' ?>" data-bs-parent="#archiveSectionsAccordion">
                            <div class="accordion-body">
                                <?php foreach ($entries as $entry): ?>
                                <?php $data = is_array($entry['data'] ?? null) ? $entry['data'] : []; ?>
                                <form method="POST" action="<?= APP_URL ?>/archive/entry/update" class="border rounded p-3 mb-3">
                                    <?= Auth::csrfField() ?>
                                    <input type="hidden" name="entry_id" value="<?= (int) $entry['id'] ?>">
                                    <div class="row g-3">
                                        <?php foreach ($data as $key => $value): ?>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-semibold"><?= e(ucwords(str_replace('_', ' ', (string) $key))) ?></label>
                                            <textarea class="form-control" rows="2" name="data[<?= e((string) $key) ?>]"><?= e((string) $value) ?></textarea>
                                        </div>
                                        <?php endforeach; ?>
                                    </div>
                                    <div class="d-flex gap-2 mt-3">
                                        <button type="submit" class="btn btn-primary btn-sm"><i class="bi bi-save me-1"></i>Save</button>
                                        <button type="submit" formaction="<?= APP_URL ?>/archive/entry/delete" class="btn btn-outline-danger btn-sm" data-confirm="Delete this archive entry?" data-confirm-title="Delete Entry" data-confirm-type="danger" data-confirm-btn="Delete">
                                            <i class="bi bi-trash me-1"></i>Delete
                                        </button>
                                    </div>
                                </form>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';