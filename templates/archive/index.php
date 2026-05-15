<?php
$pageTitle = 'My Archive';
$personalFields = [
    'full_name' => ['Full name', 'person'],
    'title' => ['Title', 'briefcase'],
    'affiliation' => ['Affiliation', 'building'],
    'email' => ['Email', 'envelope'],
    'phone' => ['Phone', 'telephone'],
    'location' => ['Location', 'geo-alt'],
    'website' => ['Website', 'globe'],
    'linkedin' => ['LinkedIn', 'linkedin'],
    'orcid' => ['ORCID', 'patch-check'],
    'google_scholar' => ['Google Scholar', 'mortarboard'],
];
$sectionTotal = array_sum(array_map('count', $entriesBySection));
$navItems = [
    ['id' => 'profile', 'label' => 'Profile Details', 'icon' => 'person-lines-fill', 'count' => count(array_filter($personalInfo))],
    ['id' => 'publications', 'label' => 'Publications', 'icon' => 'journal-check', 'count' => count($approvedPublications)],
    ['id' => 'sections', 'label' => 'Section Data', 'icon' => 'collection', 'count' => $sectionTotal],
];
ob_start();
?>
<style>
    .archive-shell { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); gap: 1rem; align-items: start; }
    .archive-sidebar { position: sticky; top: 5rem; }
    .archive-nav-card, .archive-panel, .archive-item { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .archive-nav-link { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; color: #111827; text-decoration: none; border-radius: 6px; }
    .archive-nav-link:hover, .archive-nav-link.active { background: #eef5ff; color: #0d6efd; }
    .archive-panel-header { border-bottom: 1px solid #e5e7eb; padding: 1rem; }
    .archive-panel-body { padding: 1rem; }
    .archive-item + .archive-item { margin-top: 0.75rem; }
    .archive-item-header { width: 100%; border: 0; background: #fff; padding: 0.875rem 1rem; text-align: left; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    .archive-item-header:hover { background: #f8fafc; }
    .archive-item-body { border-top: 1px solid #eef2f7; padding: 1rem; }
    .archive-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.875rem; }
    .archive-autosave-status { min-height: 1.25rem; }
    .archive-action-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #eef2f7; }
    .archive-empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 2rem; text-align: center; color: #6b7280; background: #f9fafb; }
    .archive-summary { min-width: 0; }
    @media (max-width: 991.98px) { .archive-shell { grid-template-columns: 1fr; } .archive-sidebar { position: static; } .archive-field-grid { grid-template-columns: 1fr; } }
</style>

<div class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
            <h4 class="fw-bold mb-1"><i class="bi bi-archive me-2"></i>My Archive</h4>
            <p class="text-muted mb-0">Your reusable CV dataset, independent from any single CV file.</p>
        </div>
        <div class="d-flex flex-wrap gap-2">
            <a href="<?= APP_URL ?>/profile/import" class="btn btn-outline-secondary"><i class="bi bi-magic me-1"></i>Import More</a>
            <form method="POST" action="<?= APP_URL ?>/archive/reset" data-confirm="Clean your full archive? This removes profile archive details, reusable section entries, and publication archive records. Existing CVs are unchanged." data-confirm-title="Clean Full Archive" data-confirm-type="danger" data-confirm-btn="Clean Archive">
                <?= Auth::csrfField() ?>
                <button type="submit" class="btn btn-outline-danger"><i class="bi bi-eraser me-1"></i>Clean All Data</button>
            </form>
        </div>
    </div>

    <div class="archive-shell">
        <aside class="archive-sidebar">
            <div class="archive-nav-card p-2 mb-3">
                <?php foreach ($navItems as $item): ?>
                <a href="#archive-<?= e($item['id']) ?>" class="archive-nav-link <?= ($activeSection === $item['id'] || ($item['id'] === 'publications' && $activeSection === 'publications')) ? 'active' : '' ?>">
                    <span><i class="bi bi-<?= e($item['icon']) ?> me-2"></i><?= e($item['label']) ?></span>
                    <span class="badge bg-light text-dark"><?= (int) $item['count'] ?></span>
                </a>
                <?php endforeach; ?>
            </div>
            <?php if (!empty($entriesBySection)): ?>
            <div class="archive-nav-card p-2">
                <div class="small text-muted fw-semibold px-2 py-1">Sections</div>
                <?php foreach ($entriesBySection as $sectionKey => $entries): ?>
                <a href="#archive-section-<?= e(preg_replace('/[^a-z0-9_-]/i', '-', $sectionKey)) ?>" class="archive-nav-link <?= $activeSection === $sectionKey ? 'active' : '' ?>">
                    <span><?= e($sectionLabels[$sectionKey] ?? ucwords(str_replace('_', ' ', $sectionKey))) ?></span>
                    <span class="badge bg-light text-dark"><?= count($entries) ?></span>
                </a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </aside>

        <main>
            <section class="archive-panel mb-4" id="archive-profile">
                <div class="archive-panel-header d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <h5 class="fw-bold mb-1"><i class="bi bi-person-lines-fill me-2"></i>Profile Details</h5>
                        <div class="small text-muted">Changes autosave and pre-fill future CVs.</div>
                    </div>
                    <span class="badge bg-primary-subtle text-primary">Autosave</span>
                </div>
                <div class="archive-panel-body">
                    <form method="POST" action="<?= APP_URL ?>/archive/personal" data-autosave-form>
                        <?= Auth::csrfField() ?>
                        <div class="archive-field-grid">
                            <?php foreach ($personalFields as $key => [$label, $icon]): ?>
                            <div>
                                <label class="form-label small fw-semibold" for="personal-<?= e($key) ?>"><i class="bi bi-<?= e($icon) ?> me-1 text-muted"></i><?= e($label) ?></label>
                                <input type="text" class="form-control" id="personal-<?= e($key) ?>" name="personal_info[<?= e($key) ?>]" value="<?= e($personalInfo[$key] ?? ($fullUser[$key] ?? '')) ?>">
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <div class="archive-action-bar"><span class="archive-autosave-status small text-muted me-auto" data-autosave-status>Saved</span></div>
                    </form>
                </div>
            </section>

            <section class="archive-panel mb-4" id="archive-publications">
                <div class="archive-panel-header d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <h5 class="fw-bold mb-1"><i class="bi bi-journal-check me-2"></i>Publication Archive</h5>
                        <div class="small text-muted">Edit approved publications once; future CVs inherit the clean version.</div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-end">
                        <span class="badge bg-success-subtle text-success"><?= count($approvedPublications) ?> approved</span>
                        <?php if (!empty($approvedPublications)): ?>
                        <form method="POST" action="<?= APP_URL ?>/archive/section/clear" data-confirm="Clean all publications from your archive? Existing CVs are unchanged." data-confirm-title="Clean Publications" data-confirm-type="danger" data-confirm-btn="Clean Publications">
                            <?= Auth::csrfField() ?>
                            <input type="hidden" name="section_key" value="publications">
                            <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-eraser me-1"></i>Clean section</button>
                        </form>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="archive-panel-body">
                    <?php if (empty($approvedPublications)): ?>
                        <div class="archive-empty"><i class="bi bi-journal-x fs-1"></i><p class="mt-2 mb-0">No approved publications yet.</p></div>
                    <?php else: ?>
                        <?php foreach ($approvedPublications as $pub): ?>
                        <article class="archive-item" id="publication-<?= (int) $pub['id'] ?>">
                            <button class="archive-item-header" type="button" data-bs-toggle="collapse" data-bs-target="#pub-body-<?= (int) $pub['id'] ?>" aria-expanded="false">
                                <span class="archive-summary"><span class="fw-semibold d-block text-truncate"><?= e($pub['title']) ?></span><span class="small text-muted text-truncate d-block"><?= e($pub['authors'] ?? '') ?></span></span>
                                <span class="d-flex align-items-center gap-2 flex-shrink-0"><?php if (!empty($pub['year'])): ?><span class="badge bg-light text-dark"><?= e($pub['year']) ?></span><?php endif; ?><i class="bi bi-chevron-down"></i></span>
                            </button>
                            <div class="collapse" id="pub-body-<?= (int) $pub['id'] ?>"><div class="archive-item-body">
                                <form method="POST" action="<?= APP_URL ?>/archive/publication/update" data-autosave-form>
                                    <?= Auth::csrfField() ?><input type="hidden" name="publication_id" value="<?= (int) $pub['id'] ?>">
                                    <div class="archive-field-grid">
                                        <div><label class="form-label small fw-semibold">Title</label><input type="text" class="form-control" name="title" value="<?= e($pub['title'] ?? '') ?>" required></div>
                                        <div><label class="form-label small fw-semibold">Authors</label><input type="text" class="form-control" name="authors" value="<?= e($pub['authors'] ?? '') ?>"></div>
                                        <div><label class="form-label small fw-semibold">Venue</label><input type="text" class="form-control" name="venue" value="<?= e($pub['venue'] ?? '') ?>"></div>
                                        <div><label class="form-label small fw-semibold">Year</label><input type="number" class="form-control" name="year" value="<?= e($pub['year'] ?? '') ?>"></div>
                                        <div><label class="form-label small fw-semibold">DOI</label><input type="text" class="form-control" name="doi" value="<?= e($pub['doi'] ?? '') ?>"></div>
                                        <div><label class="form-label small fw-semibold">URL</label><input type="text" class="form-control" name="url" value="<?= e($pub['url'] ?? '') ?>"></div>
                                    </div>
                                    <div class="archive-action-bar"><span class="archive-autosave-status small text-muted me-auto" data-autosave-status>Saved</span><button type="submit" formaction="<?= APP_URL ?>/archive/publication/delete" class="btn btn-outline-danger btn-sm" data-confirm="Delete this publication from your archive?" data-confirm-title="Delete Publication" data-confirm-type="danger" data-confirm-btn="Delete"><i class="bi bi-trash me-1"></i>Delete</button></div>
                                </form>
                            </div></div>
                        </article>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>

            <section class="archive-panel" id="archive-sections">
                <div class="archive-panel-header"><h5 class="fw-bold mb-1"><i class="bi bi-collection me-2"></i>Section Data</h5><div class="small text-muted">Reusable entries grouped by CV section.</div></div>
                <div class="archive-panel-body">
                    <?php if (empty($entriesBySection)): ?>
                        <div class="archive-empty"><i class="bi bi-inboxes fs-1"></i><p class="mt-2 mb-0">No reusable section entries yet.</p></div>
                    <?php else: ?>
                        <?php foreach ($entriesBySection as $sectionKey => $entries): ?>
                        <?php $sectionId = preg_replace('/[^a-z0-9_-]/i', '-', $sectionKey); ?>
                        <div class="mb-4" id="archive-section-<?= e($sectionId) ?>">
                            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                <h6 class="fw-bold mb-0"><?= e($sectionLabels[$sectionKey] ?? ucwords(str_replace('_', ' ', $sectionKey))) ?></h6>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge bg-secondary"><?= count($entries) ?></span>
                                    <form method="POST" action="<?= APP_URL ?>/archive/section/clear" data-confirm="Clean all <?= e($sectionLabels[$sectionKey] ?? ucwords(str_replace('_', ' ', $sectionKey))) ?> entries from your archive? Existing CVs are unchanged." data-confirm-title="Clean Section" data-confirm-type="danger" data-confirm-btn="Clean Section">
                                        <?= Auth::csrfField() ?>
                                        <input type="hidden" name="section_key" value="<?= e($sectionKey) ?>">
                                        <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-eraser me-1"></i>Clean section</button>
                                    </form>
                                </div>
                            </div>
                            <?php foreach ($entries as $entry): ?>
                            <?php $data = is_array($entry['data'] ?? null) ? $entry['data'] : []; $firstValue = reset($data); $summary = trim((string) ($data['title'] ?? $data['position'] ?? $data['degree'] ?? $data['institution'] ?? $data['organization'] ?? $firstValue ?: 'Archive entry')); ?>
                            <article class="archive-item">
                                <button class="archive-item-header" type="button" data-bs-toggle="collapse" data-bs-target="#entry-body-<?= (int) $entry['id'] ?>" aria-expanded="false"><span class="fw-semibold text-truncate"><?= e($summary) ?></span><i class="bi bi-chevron-down flex-shrink-0"></i></button>
                                <div class="collapse" id="entry-body-<?= (int) $entry['id'] ?>"><div class="archive-item-body">
                                    <form method="POST" action="<?= APP_URL ?>/archive/entry/update" data-autosave-form>
                                        <?= Auth::csrfField() ?><input type="hidden" name="entry_id" value="<?= (int) $entry['id'] ?>">
                                        <div class="archive-field-grid">
                                            <?php foreach ($data as $key => $value): ?>
                                            <div><label class="form-label small fw-semibold"><?= e(ucwords(str_replace('_', ' ', (string) $key))) ?></label><textarea class="form-control" rows="2" name="data[<?= e((string) $key) ?>]"><?= e((string) $value) ?></textarea></div>
                                            <?php endforeach; ?>
                                        </div>
                                        <div class="archive-action-bar"><span class="archive-autosave-status small text-muted me-auto" data-autosave-status>Saved</span><button type="submit" formaction="<?= APP_URL ?>/archive/entry/delete" class="btn btn-outline-danger btn-sm" data-confirm="Delete this archive entry?" data-confirm-title="Delete Entry" data-confirm-type="danger" data-confirm-btn="Delete"><i class="bi bi-trash me-1"></i>Delete</button></div>
                                    </form>
                                </div></div>
                            </article>
                            <?php endforeach; ?>
                        </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>
        </main>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    function setStatus(form, text, cssClass) {
        const status = form.querySelector('[data-autosave-status]');
        if (!status) return;
        status.className = 'archive-autosave-status small me-auto ' + (cssClass || 'text-muted');
        status.textContent = text;
    }
    function autosave(form) {
        if (form.dataset.saving === '1') return;
        form.dataset.saving = '1';
        setStatus(form, 'Saving...', 'text-primary');
        fetch(form.action, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }, body: new FormData(form), credentials: 'same-origin' })
        .then(function(response) { return response.json().catch(function() { return {}; }).then(function(data) { if (!response.ok || data.success === false) throw new Error(data.error || 'Save failed.'); return data; }); })
        .then(function() { setStatus(form, 'Saved', 'text-success'); })
        .catch(function(error) { setStatus(form, error.message || 'Save failed', 'text-danger'); })
        .finally(function() { form.dataset.saving = ''; });
    }
    document.querySelectorAll('[data-autosave-form]').forEach(function(form) {
        let timer = null;
        form.addEventListener('input', function(event) {
            if (event.target.matches('button')) return;
            setStatus(form, 'Unsaved changes', 'text-warning');
            clearTimeout(timer);
            timer = setTimeout(function() { autosave(form); }, 900);
        });
        form.addEventListener('submit', function(event) {
            if (event.submitter && event.submitter.dataset.confirm) return;
            event.preventDefault();
            clearTimeout(timer);
            autosave(form);
        });
    });
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';