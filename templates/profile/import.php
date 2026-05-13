<?php
$pageTitle = 'Import Academic Profile';
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="fw-bold mb-1"><i class="bi bi-magic me-2"></i>Import CV & Academic Profile</h4>
            <p class="text-muted mb-0">Upload an existing CV PDF, or import publications and profile data from ORCID or Google Scholar</p>
        </div>
        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
            <div class="row g-3 align-items-center">
                <div class="col-lg-7">
                    <div class="d-flex align-items-center mb-2">
                        <div class="rounded-circle bg-warning bg-opacity-10 p-3 me-3">
                            <i class="bi bi-stars text-warning fs-4"></i>
                        </div>
                        <div>
                            <h5 class="mb-0 fw-bold">Import Existing CV PDF</h5>
                            <small class="text-muted">Lowest API cost mode: extract PDF text locally, then optionally use AI only to structure it.</small>
                        </div>
                    </div>
                    <p class="text-muted small mb-0">Upload a text-based CV PDF. Nothing is added to your CV until you review and approve the extracted draft.</p>
                </div>
                <div class="col-lg-5">
                    <form id="ai-cv-upload-form" enctype="multipart/form-data">
                        <label for="ai-cv-pdf" class="form-label small fw-semibold">CV PDF</label>
                        <input type="file" class="form-control" id="ai-cv-pdf" name="cv_pdf" accept="application/pdf,.pdf">
                        <div class="form-text">Max <?= (int) AI_CV_IMPORT_MAX_UPLOAD_MB ?> MB. Scanned/image-only PDFs may need OCR before upload.</div>
                        <button type="submit" class="btn btn-warning w-100 mt-3" id="btn-import-ai-cv">
                            <i class="bi bi-magic me-1"></i>Extract CV Draft
                        </button>
                    </form>
                    <div id="ai-cv-status" class="mt-2"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <!-- ORCID Import -->
        <div class="col-md-6">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="rounded-circle bg-success bg-opacity-10 p-3 me-3">
                            <i class="bi bi-journal-check text-success fs-4"></i>
                        </div>
                        <div>
                            <h5 class="mb-0 fw-bold">ORCID</h5>
                            <small class="text-muted">Import from your ORCID profile</small>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="orcid-input" class="form-label">ORCID ID or Profile URL</label>
                        <input type="text" class="form-control" id="orcid-input" 
                               placeholder="0000-0000-0000-0000 or https://orcid.org/0000-..."
                               value="<?= e($user['orcid_id'] ?? '') ?>">
                        <div class="form-text">Example: 0000-0002-1825-0097</div>
                    </div>
                    <button class="btn btn-success w-100" id="btn-import-orcid">
                        <i class="bi bi-download me-1"></i>Import from ORCID
                    </button>
                    <div id="orcid-status" class="mt-2"></div>
                </div>
            </div>
        </div>

        <!-- Google Scholar Import -->
        <div class="col-md-6">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="rounded-circle bg-primary bg-opacity-10 p-3 me-3">
                            <i class="bi bi-mortarboard text-primary fs-4"></i>
                        </div>
                        <div>
                            <h5 class="mb-0 fw-bold">Google Scholar</h5>
                            <small class="text-muted">Import from your Scholar profile</small>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="scholar-input" class="form-label">Google Scholar Profile URL or User ID</label>
                        <input type="text" class="form-control" id="scholar-input" 
                               placeholder="https://scholar.google.com/citations?user=XXXX or user ID"
                               value="<?= e($user['google_scholar_id'] ?? '') ?>">
                        <div class="form-text">Paste your full Google Scholar profile URL</div>
                    </div>
                    <button class="btn btn-primary w-100" id="btn-import-scholar">
                        <i class="bi bi-download me-1"></i>Import from Google Scholar
                    </button>
                    <div id="scholar-status" class="mt-2"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Imported Profile Preview -->
    <div class="card border-0 shadow-sm mt-4 d-none" id="profile-preview-card">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-person-badge me-2"></i>Imported Profile Data</h5>
        </div>
        <div class="card-body">
            <div class="row g-3" id="profile-preview-fields"></div>
            <div class="mt-3">
                <button class="btn btn-success" id="btn-apply-profile">
                    <i class="bi bi-check-lg me-1"></i>Apply to My Profile
                </button>
                <div id="profile-apply-status" class="mt-2" aria-live="polite"></div>
            </div>
        </div>
    </div>

    <!-- Imported Education Summary -->
    <div class="card border-0 shadow-sm mt-4 d-none" id="education-summary-card">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-mortarboard me-2"></i>Education Added to CV</h5>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr><th>Degree</th><th>Institution</th><th>Location</th><th>Period</th></tr>
                    </thead>
                    <tbody id="education-summary-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Imported Employment Summary -->
    <div class="card border-0 shadow-sm mt-4 d-none" id="employment-summary-card">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-briefcase me-2"></i>Work Experience Added to CV</h5>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr><th>Position</th><th>Organization</th><th>Location</th><th>Period</th></tr>
                    </thead>
                    <tbody id="employment-summary-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- AI CV Draft Review -->
    <div class="card border-0 shadow-sm mt-4 d-none" id="ai-cv-draft-card">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <div>
                <h5 class="mb-0 fw-bold"><i class="bi bi-magic me-2 text-warning"></i>Review Extracted CV Draft</h5>
                <small class="text-muted">Uncheck anything you do not want to add. You can edit details later in the CV editor.</small>
            </div>
            <button class="btn btn-success" id="btn-apply-ai-cv-draft">
                <i class="bi bi-check2-circle me-1"></i>Add Draft to My CV
            </button>
        </div>
        <div class="card-body">
            <div id="ai-cv-draft-meta" class="mb-3"></div>
            <div id="ai-cv-draft-preview"></div>
            <div id="ai-cv-apply-status" class="mt-3" aria-live="polite"></div>
        </div>
    </div>

    <!-- Publications Review -->
    <div class="card border-0 shadow-sm mt-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold"><i class="bi bi-journal-text me-2"></i>Publications for Review</h5>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success" id="btn-approve-selected" disabled>
                    <i class="bi bi-check-all me-1"></i>Approve Selected
                </button>
                <button class="btn btn-sm btn-outline-danger" id="btn-reject-selected" disabled>
                    <i class="bi bi-trash me-1"></i>Remove Selected
                </button>
            </div>
        </div>
        <div class="card-body p-0">
            <div id="publications-list">
                <?php if (empty($pending)): ?>
                    <div class="text-center py-5 text-muted" id="empty-pubs">
                        <i class="bi bi-journal-x display-4"></i>
                        <p class="mt-2">No pending publications. Import from ORCID or Google Scholar above.</p>
                    </div>
                <?php else: ?>
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th width="30"><input type="checkbox" class="form-check-input" id="select-all-pubs"></th>
                                    <th>Title</th>
                                    <th>Authors</th>
                                    <th>Year</th>
                                    <th>Venue</th>
                                    <th>Citations</th>
                                    <th>Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($pending as $pub): ?>
                                <tr>
                                    <td><input type="checkbox" class="form-check-input pub-checkbox" value="<?= $pub['id'] ?>" data-source="<?= e($pub['source']) ?>"></td>
                                    <td class="fw-medium"><?= e($pub['title']) ?></td>
                                    <td class="small text-muted"><?= e($pub['authors']) ?></td>
                                    <td><?= e($pub['year'] ?? '') ?></td>
                                    <td class="small"><?= e($pub['venue'] ?? '') ?></td>
                                    <td><span class="badge bg-secondary"><?= (int)$pub['citation_count'] ?></span></td>
                                    <td><span class="badge bg-<?= $pub['source'] === 'orcid' ? 'success' : 'primary' ?>"><?= e($pub['source']) ?></span></td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Approved Publications -->
    <?php if (!empty($approved)): ?>
    <div class="card border-0 shadow-sm mt-4">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-check-circle text-success me-2"></i>Approved Publications (<?= count($approved) ?>)</h5>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Year</th>
                            <th>Venue</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($approved as $pub): ?>
                        <tr>
                            <td class="fw-medium"><?= e($pub['title']) ?></td>
                            <td class="small text-muted"><?= e($pub['authors']) ?></td>
                            <td><?= e($pub['year'] ?? '') ?></td>
                            <td class="small"><?= e($pub['venue'] ?? '') ?></td>
                            <td><span class="badge bg-<?= $pub['source'] === 'orcid' ? 'success' : 'primary' ?>"><?= e($pub['source']) ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const API = '<?= APP_URL ?>';
    const applyProfileBtn = document.getElementById('btn-apply-profile');
    const applyProfileStatus = document.getElementById('profile-apply-status');
    const applyProfileDefaultHtml = applyProfileBtn ? applyProfileBtn.innerHTML : '';
    let isApplyingProfile = false;
    let applyDuplicateClicks = 0;
    let aiCvDraft = null;

    const aiSectionLabels = {
        personal_info: 'Personal Information',
        academic_profile: 'Academic Profile',
        education: 'Education',
        experience: 'Experience',
        publications: 'Publications',
        projects: 'Projects',
        awards: 'Awards / Honors',
        teaching: 'Teaching',
        certifications: 'Certifications',
        skills: 'Skills',
        languages: 'Languages',
        professional_memberships: 'Professional Memberships',
        references: 'References'
    };

    function trackImportEvent(eventKey, metadata, options) {
        window.cvTrackEvent && window.cvTrackEvent(eventKey, Object.assign({
            page: '/profile/import',
            ui_surface: 'profile_import'
        }, metadata || {}), options || {});
    }

    function selectedPublicationSources() {
        const sources = {};
        document.querySelectorAll('.pub-checkbox:checked').forEach(cb => {
            if (cb.dataset.source) sources[cb.dataset.source] = true;
        });
        return Object.keys(sources);
    }

    // ===== Refresh publications table via AJAX =====
    function refreshPublications() {
        fetch(API + '/profile/import/pending')
        .then(r => r.json())
        .then(res => {
            const list = document.getElementById('publications-list');
            const pubs = res.publications || [];
            if (pubs.length === 0) {
                list.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-journal-x display-4"></i><p class="mt-2">No pending publications. Import from ORCID or Google Scholar above.</p></div>';
                return;
            }
            let html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead class="table-light"><tr>' +
                '<th width="30"><input type="checkbox" class="form-check-input" id="select-all-pubs"></th>' +
                '<th>Title</th><th>Authors</th><th>Year</th><th>Venue</th><th>Citations</th><th>Source</th></tr></thead><tbody>';
            pubs.forEach(p => {
                const srcClass = p.source === 'orcid' ? 'success' : 'primary';
                html += '<tr>' +
                    '<td><input type="checkbox" class="form-check-input pub-checkbox" value="' + p.id + '" data-source="' + escHtml(p.source || '') + '"></td>' +
                    '<td class="fw-medium">' + escHtml(p.title) + '</td>' +
                    '<td class="small text-muted">' + escHtml(p.authors || '') + '</td>' +
                    '<td>' + escHtml(p.year || '') + '</td>' +
                    '<td class="small">' + escHtml(p.venue || '') + '</td>' +
                    '<td><span class="badge bg-secondary">' + (parseInt(p.citation_count) || 0) + '</span></td>' +
                    '<td><span class="badge bg-' + srcClass + '">' + escHtml(p.source) + '</span></td></tr>';
            });
            html += '</tbody></table></div>';
            list.innerHTML = html;
            bindSelectAll();
            updateButtons();
        });
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function setApplyProfileStatus(type, message) {
        applyProfileStatus.innerHTML = '<div class="alert alert-' + type + ' py-2 small mb-0" role="status">' + escHtml(message) + '</div>';
    }

    function parseJsonResponse(response) {
        return response.text().then(text => {
            let data = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    data = { error: 'Unexpected server response. Please try again.' };
                }
            }

            if (!response.ok) {
                throw new Error(data.error || 'Request failed. Please try again.');
            }

            return data;
        });
    }

    function summarizeEntry(entry) {
        const values = [];
        Object.keys(entry || {}).forEach(key => {
            const value = String(entry[key] || '').trim();
            if (value && values.length < 4) values.push(value);
        });
        return values.join(' • ');
    }

    function setAiCvStatus(type, message) {
        document.getElementById('ai-cv-status').innerHTML = '<div class="alert alert-' + type + ' py-2 small mb-0">' + escHtml(message) + '</div>';
    }

    function showAiCvDraft(draft, meta) {
        aiCvDraft = draft || {};
        const card = document.getElementById('ai-cv-draft-card');
        const preview = document.getElementById('ai-cv-draft-preview');
        const metaBox = document.getElementById('ai-cv-draft-meta');
        card.classList.remove('d-none');

        const provider = meta.provider === 'openai_refined' ? 'AI-refined' : 'Local extraction only';
        const extractionMethod = meta.extraction_method === 'ocr' ? 'OCR' : (meta.extraction_method === 'pdftotext' ? 'Embedded PDF text' : 'Direct text');
        const aiStatus = meta.ai_status === 'enabled' ? 'AI enabled' : (meta.ai_status === 'failed' ? 'AI failed, fallback used' : 'AI disabled');
        const aiError = String(meta.ai_error || '').trim();
        const warnings = (meta.warnings || []).map(w => '<div class="small text-warning"><i class="bi bi-exclamation-triangle me-1"></i>' + escHtml(w) + '</div>').join('');
        const aiErrorHtml = aiError ? '<div class="small text-danger"><i class="bi bi-x-octagon me-1"></i>' + escHtml(aiError) + '</div>' : '';
        metaBox.innerHTML = '<div class="alert alert-light border small mb-0"><strong>Mode:</strong> ' + escHtml(provider) +
            ' <span class="text-muted ms-2">(' + (parseInt(meta.text_chars_sent) || 0) + ' text chars processed)</span><br>' +
            '<span class="text-muted"><strong>Extraction:</strong> ' + escHtml(extractionMethod) + ' | <strong>AI:</strong> ' + escHtml(aiStatus) + '</span>' + aiErrorHtml + warnings + '</div>';

        let html = '';
        const personal = aiCvDraft.personal_info || {};
        const personalKeys = Object.keys(personal).filter(k => String(personal[k] || '').trim() !== '');
        if (personalKeys.length > 0) {
            html += '<div class="mb-3"><h6 class="fw-bold">Personal Information</h6><div class="row g-2">';
            personalKeys.forEach(key => {
                html += '<div class="col-md-6"><div class="form-check border rounded p-2 ps-4">' +
                    '<input class="form-check-input ai-cv-personal-check" type="checkbox" checked data-field="' + escHtml(key) + '">' +
                    '<label class="form-check-label small"><strong>' + escHtml(key.replaceAll('_', ' ')) + ':</strong> ' + escHtml(personal[key]) + '</label>' +
                    '</div></div>';
            });
            html += '</div></div>';
        }

        Object.keys(aiSectionLabels).forEach(sectionKey => {
            if (sectionKey === 'personal_info') return;
            const entries = Array.isArray(aiCvDraft[sectionKey]) ? aiCvDraft[sectionKey] : [];
            if (entries.length === 0) return;
            html += '<div class="mb-3"><h6 class="fw-bold">' + escHtml(aiSectionLabels[sectionKey]) + ' <span class="badge bg-secondary">' + entries.length + '</span></h6>';
            html += '<div class="list-group">';
            entries.forEach((entry, index) => {
                html += '<label class="list-group-item small"><input class="form-check-input me-2 ai-cv-entry-check" type="checkbox" checked data-section="' + escHtml(sectionKey) + '" data-index="' + index + '">' +
                    escHtml(summarizeEntry(entry)) + '</label>';
            });
            html += '</div></div>';
        });

        preview.innerHTML = html || '<div class="text-muted small">No structured data was found. Try another PDF or import with ORCID/Google Scholar.</div>';
        document.getElementById('ai-cv-apply-status').innerHTML = '';
        trackImportEvent('ai_cv_draft_previewed', {
            provider: meta.provider || 'local_extraction',
            text_chars_sent: parseInt(meta.text_chars_sent) || 0
        });
    }

    function selectedAiCvDraft() {
        if (!aiCvDraft) return null;
        const selected = { personal_info: {} };
        document.querySelectorAll('.ai-cv-personal-check:checked').forEach(cb => {
            selected.personal_info[cb.dataset.field] = aiCvDraft.personal_info[cb.dataset.field];
        });
        Object.keys(aiSectionLabels).forEach(sectionKey => {
            if (sectionKey === 'personal_info') return;
            selected[sectionKey] = [];
        });
        document.querySelectorAll('.ai-cv-entry-check:checked').forEach(cb => {
            const section = cb.dataset.section;
            const index = parseInt(cb.dataset.index, 10);
            if (aiCvDraft[section] && aiCvDraft[section][index]) selected[section].push(aiCvDraft[section][index]);
        });
        return selected;
    }

    document.getElementById('ai-cv-upload-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('ai-cv-pdf');
        if (!input.files || input.files.length === 0) {
            csAlert('Please choose a CV PDF first.', {type: 'warning', title: 'Missing PDF'});
            return;
        }

        const btn = document.getElementById('btn-import-ai-cv');
        const formData = new FormData();
        formData.append('cv_pdf', input.files[0]);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Extracting...';
        document.getElementById('ai-cv-status').innerHTML = '';

        fetch(API + '/profile/import/cv-pdf', { method: 'POST', body: formData })
        .then(parseJsonResponse)
        .then(res => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-magic me-1"></i>Extract CV Draft';
            setAiCvStatus('success', res.message || 'CV draft extracted.');
            showAiCvDraft(res.draft || {}, res);
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-magic me-1"></i>Extract CV Draft';
            setAiCvStatus('danger', error.message || 'CV extraction failed.');
            trackImportEvent('ai_cv_import_failed', { error_message: error.message || 'CV extraction failed.' });
        });
    });

    document.getElementById('btn-apply-ai-cv-draft').addEventListener('click', function() {
        const selected = selectedAiCvDraft();
        if (!selected) return;
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Adding...';
        document.getElementById('ai-cv-apply-status').innerHTML = '<div class="alert alert-info py-2 small mb-0">Adding selected draft entries to your CV...</div>';

        fetch(API + '/profile/import/cv-draft/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(selected)
        })
        .then(parseJsonResponse)
        .then(res => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Add Draft to My CV';
            const editUrl = res.edit_url || (API + '/dashboard');
            document.getElementById('ai-cv-apply-status').innerHTML = '<div class="alert alert-success py-2 small mb-0">' + escHtml(res.message || 'Draft added.') + ' <a href="' + escHtml(editUrl) + '" class="alert-link">Open CV editor</a></div>';
            trackImportEvent('ai_cv_draft_applied', { profile_id: res.profile_id || 0 });
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Add Draft to My CV';
            document.getElementById('ai-cv-apply-status').innerHTML = '<div class="alert alert-danger py-2 small mb-0">' + escHtml(error.message || 'Could not apply draft.') + '</div>';
        });
    });

    // ===== Show Education Summary =====
    function showEducationSummary(education) {
        if (!education || education.length === 0) return;
        const card = document.getElementById('education-summary-card');
        const body = document.getElementById('education-summary-body');
        card.classList.remove('d-none');
        body.innerHTML = '';
        education.forEach(e => {
            body.innerHTML += '<tr><td class="fw-medium">' + escHtml(e.degree || '') + '</td>' +
                '<td>' + escHtml(e.institution || '') + '</td>' +
                '<td>' + escHtml(e.location || '') + '</td>' +
                '<td>' + escHtml(e.year_start || '') + '–' + escHtml(e.year_end || '') + '</td></tr>';
        });
    }

    // ===== Show Employment Summary =====
    function showEmploymentSummary(employment) {
        if (!employment || employment.length === 0) return;
        const card = document.getElementById('employment-summary-card');
        const body = document.getElementById('employment-summary-body');
        card.classList.remove('d-none');
        body.innerHTML = '';
        employment.forEach(e => {
            body.innerHTML += '<tr><td class="fw-medium">' + escHtml(e.position || '') + '</td>' +
                '<td>' + escHtml(e.organization || '') + '</td>' +
                '<td>' + escHtml(e.location || '') + '</td>' +
                '<td>' + escHtml(e.year_start || '') + '–' + escHtml(e.year_end || '') + '</td></tr>';
        });
    }

    // ===== ORCID Import =====
    document.getElementById('btn-import-orcid').addEventListener('click', function() {
        const orcidId = document.getElementById('orcid-input').value.trim();
        if (!orcidId) { csAlert('Please enter an ORCID ID.', {type: 'warning', title: 'Missing Input'}); return; }

        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';
        document.getElementById('orcid-status').innerHTML = '';

        fetch(API + '/profile/import/orcid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orcid_id: orcidId })
        })
        .then(r => r.json())
        .then(res => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-download me-1"></i>Import from ORCID';

            if (res.error) {
                document.getElementById('orcid-status').innerHTML = 
                    '<div class="alert alert-danger py-2 small">' + escHtml(res.error) + '</div>';
                return;
            }

            document.getElementById('orcid-status').innerHTML = 
                '<div class="alert alert-success py-2 small">' + escHtml(res.message) + '</div>';

            showProfilePreview(res.profile);
            showEducationSummary(res.education);
            showEmploymentSummary(res.employment);
            refreshPublications();
        })
        .catch(() => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-download me-1"></i>Import from ORCID';
            document.getElementById('orcid-status').innerHTML = 
                '<div class="alert alert-danger py-2 small">Connection failed. Please try again.</div>';
        });
    });

    // ===== Google Scholar Import =====
    document.getElementById('btn-import-scholar').addEventListener('click', function() {
        const scholarId = document.getElementById('scholar-input').value.trim();
        if (!scholarId) { csAlert('Please enter a Google Scholar URL or ID.', {type: 'warning', title: 'Missing Input'}); return; }

        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';
        document.getElementById('scholar-status').innerHTML = '';

        fetch(API + '/profile/import/scholar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scholar_id: scholarId })
        })
        .then(r => r.json())
        .then(res => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-download me-1"></i>Import from Google Scholar';

            if (res.error) {
                document.getElementById('scholar-status').innerHTML = 
                    '<div class="alert alert-danger py-2 small">' + escHtml(res.error) + '</div>';
                return;
            }

            document.getElementById('scholar-status').innerHTML = 
                '<div class="alert alert-success py-2 small">' + escHtml(res.message) + '</div>';

            showProfilePreview(res.profile);
            refreshPublications();
        })
        .catch(() => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-download me-1"></i>Import from Google Scholar';
            document.getElementById('scholar-status').innerHTML = 
                '<div class="alert alert-danger py-2 small">Connection failed. Please try again.</div>';
        });
    });

    // ===== Show Profile Preview =====
    function showProfilePreview(profile) {
        const card = document.getElementById('profile-preview-card');
        const fields = document.getElementById('profile-preview-fields');
        card.classList.remove('d-none');
        fields.innerHTML = '';

        const fieldMap = {
            'full_name': 'Full Name',
            'title': 'Title',
            'affiliation': 'Affiliation',
            'email': 'Email',
            'website': 'Website',
            'orcid_id': 'ORCID ID',
            'google_scholar_id': 'Scholar ID'
        };

        window._importedProfile = profile;
        isApplyingProfile = false;
        applyProfileBtn.disabled = false;
        applyProfileBtn.innerHTML = applyProfileDefaultHtml;
        applyProfileStatus.innerHTML = '';

        for (const [key, label] of Object.entries(fieldMap)) {
            if (profile[key]) {
                fields.innerHTML += `
                    <div class="col-md-6">
                        <label class="form-label small text-muted mb-0">${escHtml(label)}</label>
                        <input type="text" class="form-control form-control-sm" value="${escHtml(profile[key])}" 
                               data-field="${key}" readonly>
                    </div>`;
            }
        }

        if (profile.citation_stats) {
            const s = profile.citation_stats;
            fields.innerHTML += `
                <div class="col-12">
                    <div class="d-flex gap-3 mt-2">
                        <span class="badge bg-info">Citations: ${s.total_citations || 0}</span>
                        <span class="badge bg-info">h-index: ${s.h_index || 0}</span>
                        <span class="badge bg-info">i10-index: ${s.i10_index || 0}</span>
                    </div>
                </div>`;
        }
    }

    // ===== Apply Profile =====
    applyProfileBtn.addEventListener('click', function() {
        const selectedCount = getSelectedIds().length;
        if (isApplyingProfile) {
            applyDuplicateClicks += 1;
            trackImportEvent('import_apply_duplicate_clicked', {
                click_count: applyDuplicateClicks,
                total_publications_selected: selectedCount
            });
            return;
        }
        if (!window._importedProfile) {
            trackImportEvent('import_apply_failed', {
                error_code: 'missing_imported_profile',
                error_message: 'Import profile data first, then apply it.',
                total_publications_selected: selectedCount
            });
            setApplyProfileStatus('warning', 'Import profile data first, then apply it.');
            return;
        }

        trackImportEvent('import_apply_clicked', {
            total_publications_selected: selectedCount,
            sources: selectedPublicationSources()
        });

        isApplyingProfile = true;
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Applying...';
        setApplyProfileStatus('info', 'Saving imported profile data...');

        fetch(API + '/profile/import/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window._importedProfile)
        })
        .then(parseJsonResponse)
        .then(res => {
            if (!res.success) {
                throw new Error(res.error || 'Profile update failed.');
            }

            this.innerHTML = '<i class="bi bi-check-lg me-1"></i>Applied';
            setApplyProfileStatus('success', res.message || 'Profile updated successfully.');
            trackImportEvent('import_apply_succeeded', {
                total_publications_saved: selectedCount,
                sources: selectedPublicationSources()
            });
        })
        .catch((error) => {
            isApplyingProfile = false;
            this.disabled = false;
            this.innerHTML = applyProfileDefaultHtml;
            setApplyProfileStatus('danger', error.message || 'Profile update failed. Please try again.');
            trackImportEvent('import_apply_failed', {
                error_code: 'apply_failed',
                error_message: error.message || 'Profile update failed. Please try again.',
                total_publications_selected: selectedCount
            });
        });
    });

    // ===== Select All Checkbox =====
    function bindSelectAll() {
        const selectAll = document.getElementById('select-all-pubs');
        if (selectAll) {
            selectAll.addEventListener('change', function() {
                document.querySelectorAll('.pub-checkbox').forEach(cb => cb.checked = this.checked);
                updateButtons();
                trackImportEvent('publications_select_all_clicked', {
                    total_publications: document.querySelectorAll('.pub-checkbox').length,
                    total_now_selected: getSelectedIds().length
                });
            });
        }
    }
    bindSelectAll();

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('pub-checkbox')) {
            updateButtons();
            trackImportEvent('publication_toggled', {
                action: e.target.checked ? 'selected' : 'deselected',
                publication_id: parseInt(e.target.value, 10),
                total_selected: getSelectedIds().length
            });
        }
    });

    function getSelectedIds() {
        return Array.from(document.querySelectorAll('.pub-checkbox:checked')).map(cb => parseInt(cb.value));
    }

    function updateButtons() {
        const ids = getSelectedIds();
        document.getElementById('btn-approve-selected').disabled = ids.length === 0;
        document.getElementById('btn-reject-selected').disabled = ids.length === 0;
    }

    // ===== Approve =====
    document.getElementById('btn-approve-selected').addEventListener('click', function() {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        var btn = this;
        csConfirm('Approve ' + ids.length + ' publication(s) and add to your CV?', function() {
            btn.disabled = true;
            fetch(API + '/profile/import/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publication_ids: ids })
            })
            .then(r => r.json())
            .then(res => {
                btn.disabled = false;
                if (res.success) {
                    refreshPublications();
                    document.getElementById('orcid-status').innerHTML = 
                        '<div class="alert alert-success py-2 small">' + escHtml(res.message) + '</div>';
                } else {
                    csAlert(res.error || 'Failed', {type: 'danger'});
                }
            });
        }, {type: 'info', title: 'Approve Publications', confirmText: 'Yes, approve'});
    });

    // ===== Reject =====
    document.getElementById('btn-reject-selected').addEventListener('click', function() {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        var btn = this;
        csConfirm('Remove ' + ids.length + ' publication(s)?', function() {
            btn.disabled = true;
            fetch(API + '/profile/import/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publication_ids: ids })
            })
            .then(r => r.json())
            .then(res => {
                btn.disabled = false;
                if (res.success) refreshPublications();
                else csAlert(res.error || 'Failed', {type: 'danger'});
            });
        }, {type: 'danger', title: 'Remove Publications', confirmText: 'Yes, remove'});
    });
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
