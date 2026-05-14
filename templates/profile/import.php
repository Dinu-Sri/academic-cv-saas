<?php
$pageTitle = 'Import CV & Publications';
$pendingCount = count($pending ?? []);
$approvedCount = (int) ($approvedCount ?? 0);
$latestCvEditUrl = $latestCvEditUrl ?? APP_URL . '/dashboard';
ob_start();
?>
<style>
    .import-step {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.875rem;
        background: #fff;
        height: 100%;
    }
    .import-step-number {
        width: 1.75rem;
        height: 1.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #111827;
        color: #fff;
        font-weight: 700;
        font-size: 0.85rem;
        flex: 0 0 auto;
    }
    .source-option {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        background: #fff;
    }
    .review-stat {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.75rem;
        background: #f9fafb;
    }
    .review-list .list-group-item {
        border-color: #e5e7eb;
    }
    .workflow-log {
        max-height: 96px;
        overflow-y: auto;
    }
</style>

<div class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
            <h4 class="fw-bold mb-1"><i class="bi bi-magic me-2"></i>Import CV & Publications</h4>
            <p class="text-muted mb-0">Bring existing academic details into your profile, review them, then add only what you approve.</p>
        </div>
        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="import-step d-flex gap-3">
                <span class="import-step-number">1</span>
                <div>
                    <div class="fw-semibold">Import</div>
                    <div class="small text-muted">Upload a CV PDF or connect an academic profile.</div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="import-step d-flex gap-3">
                <span class="import-step-number">2</span>
                <div>
                    <div class="fw-semibold">Review</div>
                    <div class="small text-muted">Check the details found before they are used.</div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="import-step d-flex gap-3">
                <span class="import-step-number">3</span>
                <div>
                    <div class="fw-semibold">Add to CV</div>
                    <div class="small text-muted">Nothing changes until you approve it.</div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4 align-items-start">
        <div class="col-lg-7">
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="d-flex align-items-start gap-3 mb-3">
                        <div class="rounded-circle bg-warning bg-opacity-10 p-3">
                            <i class="bi bi-file-earmark-pdf text-warning fs-4"></i>
                        </div>
                        <div>
                            <div class="badge text-bg-warning mb-2">Recommended</div>
                            <h5 class="fw-bold mb-1">Import your old CV PDF</h5>
                            <p class="text-muted small mb-0">Best when you already have a CV. We read the PDF and prepare profile details, CV sections, publications, and advanced academic items for your review.</p>
                        </div>
                    </div>

                    <form id="ai-cv-upload-form" enctype="multipart/form-data">
                        <label for="ai-cv-pdf" class="form-label fw-semibold">Choose CV PDF</label>
                        <input type="file" class="form-control" id="ai-cv-pdf" name="cv_pdf" accept="application/pdf,.pdf">
                        <div class="form-text">Maximum <?= (int) AI_CV_IMPORT_MAX_UPLOAD_MB ?> MB. You will review the result before anything is added.</div>
                        <button type="submit" class="btn btn-warning mt-3" id="btn-import-ai-cv">
                            <i class="bi bi-stars me-1"></i>Read My CV
                        </button>
                    </form>
                </div>
            </div>

            <div class="card border-0 shadow-sm mb-4">
                <div class="card-header bg-white">
                    <h5 class="fw-bold mb-1"><i class="bi bi-cloud-download me-2"></i>Add publications from online profiles</h5>
                    <div class="small text-muted">Use these when your publication list is on ORCID or Google Scholar.</div>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="source-option h-100">
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <i class="bi bi-journal-check text-success fs-4"></i>
                                    <div class="fw-semibold">ORCID</div>
                                </div>
                                <p class="small text-muted mb-3">Can bring profile details, education, employment, and publications.</p>
                                <label for="orcid-input" class="form-label small fw-semibold">ORCID ID or URL</label>
                                <input type="text" class="form-control form-control-sm" id="orcid-input"
                                       placeholder="0000-0000-0000-0000"
                                       value="<?= e($user['orcid_id'] ?? '') ?>">
                                <button class="btn btn-success btn-sm w-100 mt-3" id="btn-import-orcid">
                                    <i class="bi bi-download me-1"></i>Import ORCID
                                </button>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="source-option h-100">
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <i class="bi bi-mortarboard text-primary fs-4"></i>
                                    <div class="fw-semibold">Google Scholar</div>
                                </div>
                                <p class="small text-muted mb-3">Best for publication titles and citation details.</p>
                                <label for="scholar-input" class="form-label small fw-semibold">Scholar URL or ID</label>
                                <input type="text" class="form-control form-control-sm" id="scholar-input"
                                       placeholder="https://scholar.google.com/citations?user=..."
                                       value="<?= e($user['google_scholar_id'] ?? '') ?>">
                                <button class="btn btn-primary btn-sm w-100 mt-3" id="btn-import-scholar">
                                    <i class="bi bi-download me-1"></i>Import Scholar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-5">
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-header bg-white">
                    <h5 class="fw-bold mb-1"><i class="bi bi-activity me-2"></i>Status</h5>
                    <div class="small text-muted">Current import progress and next step.</div>
                </div>
                <div class="card-body" id="import-status" aria-live="polite">
                    <div class="text-muted small">Choose one import option to begin.</div>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="fw-bold mb-1"><i class="bi bi-check-circle me-2 text-success"></i>Approved in Your Publication Archive</h5>
                    <div class="small text-muted">Verified publications saved to your account. Manage them in your CV editor.</div>
                </div>
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between gap-3">
                        <div>
                            <div class="display-6 fw-bold mb-0" id="approved-publications-count"><?= $approvedCount ?></div>
                            <div class="small text-muted">verified publications</div>
                        </div>
                        <a href="<?= e($latestCvEditUrl) ?>" class="btn btn-outline-secondary" id="btn-manage-approved-publications">
                            <i class="bi bi-pencil-square me-1"></i>View in Editor
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm mt-4 d-none" id="review-card">
        <div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
                <h5 class="fw-bold mb-1"><i class="bi bi-list-check me-2"></i>Review Found Information</h5>
                <div class="small text-muted">Keep the checked items. Uncheck anything you do not want to add.</div>
            </div>
            <div class="text-end">
                <button class="btn btn-success" id="btn-apply-ai-cv-draft">
                    <i class="bi bi-check2-circle me-1"></i>Add Selected to My CV
                </button>
                <div class="mt-2">
                    <button class="btn btn-link btn-sm p-0" type="button" data-bs-toggle="collapse" data-bs-target="#advanced-merge-options" aria-expanded="false">
                        Advanced options
                    </button>
                </div>
                <div class="collapse mt-2" id="advanced-merge-options">
                    <select id="ai-cv-merge-strategy" class="form-select form-select-sm">
                        <option value="fill_missing_add_new" selected>Keep my CV and add missing/new items</option>
                        <option value="replace_selected_sections">Replace selected sections</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div id="review-message" class="mb-3"></div>
            <div class="row g-3 mb-3" id="review-stats"></div>
            <div id="draft-review-list" class="review-list"></div>
            <div id="ai-cv-apply-status" class="mt-3" aria-live="polite"></div>
        </div>
    </div>

    <div class="card border-0 shadow-sm mt-4" id="pending-publications-card">
        <div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
                <h5 class="fw-bold mb-1"><i class="bi bi-journal-text me-2"></i>Publications Waiting for Approval</h5>
                <div class="small text-muted">Approve only the publications you want added to your CV.</div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success" id="btn-approve-selected" disabled>
                    <i class="bi bi-check-all me-1"></i>Approve Selected
                </button>
                <button class="btn btn-sm btn-outline-danger" id="btn-reject-selected" disabled>
                    <i class="bi bi-trash me-1"></i>Remove Selected
                </button>
            </div>
        </div>
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="small"><span class="fw-semibold" id="pending-publications-count"><?= $pendingCount ?></span> waiting for your review</div>
                <label class="small text-muted mb-0 <?= $pendingCount > 0 ? '' : 'd-none' ?>">
                    <input type="checkbox" class="form-check-input me-1" id="select-all-pubs"> Select all
                </label>
            </div>
            <div id="publications-list">
                <?php if (empty($pending)): ?>
                    <div class="text-center py-4 text-muted" id="empty-pubs">
                        <i class="bi bi-journal-x fs-1"></i>
                        <p class="mt-2 mb-0">No publications are waiting for approval.</p>
                    </div>
                <?php else: ?>
                    <div class="list-group">
                        <?php foreach ($pending as $pub): ?>
                        <label class="list-group-item d-flex gap-3 align-items-start">
                            <input type="checkbox" class="form-check-input mt-1 pub-checkbox" value="<?= (int) $pub['id'] ?>" data-source="<?= e($pub['source']) ?>">
                            <span class="flex-grow-1">
                                <span class="fw-semibold d-block"><?= e($pub['title']) ?></span>
                                <span class="small text-muted d-block"><?= e($pub['authors'] ?? '') ?></span>
                                <span class="small text-muted"><?= e($pub['year'] ?? '') ?><?= !empty($pub['venue']) ? ' | ' . e($pub['venue']) : '' ?></span>
                            </span>
                            <span class="badge bg-<?= $pub['source'] === 'orcid' ? 'success' : 'primary' ?>"><?= e($pub['source']) ?></span>
                        </label>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const API = '<?= APP_URL ?>';
    const manageUrl = '<?= e($latestCvEditUrl) ?>';
    let aiCvDraft = null;
    let importProgressTimer = null;
    let importProgressStep = 0;
    let importStartedAt = 0;
    let activeImportJobId = '';
    let lastImportStage = '';
    let importPollStartedAt = 0;

    const aiSectionLabels = {
        personal_info: 'Profile Details',
        academic_profile: 'Academic Profile',
        education: 'Education',
        experience: 'Experience',
        academic_appointments: 'Academic Appointments',
        research_experience: 'Research Experience',
        research_interests: 'Research Interests',
        publications: 'Publications',
        grants: 'Grants / Funding',
        patents: 'Patents',
        invited_talks: 'Invited Talks',
        conferences: 'Conference Presentations',
        projects: 'Projects',
        awards: 'Awards / Honors',
        teaching: 'Teaching',
        supervision: 'Student Supervision',
        academic_service: 'Academic Service',
        editorial: 'Editorial / Reviewing',
        certifications: 'Certifications',
        skills: 'Skills',
        languages: 'Languages',
        professional_memberships: 'Professional Memberships',
        references: 'References',
        declaration: 'Declaration'
    };

    function trackImportEvent(eventKey, metadata, options) {
        window.cvTrackEvent && window.cvTrackEvent(eventKey, Object.assign({
            page: '/profile/import',
            ui_surface: 'guided_profile_import'
        }, metadata || {}), options || {});
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }

    function updateCreditsBadge(balance) {
        if (balance === undefined || balance === null) return;
        const slot = document.getElementById('credits-display-slot');
        const amount = document.getElementById('credits-amount');
        if (slot) slot.style.display = '';
        if (amount) amount.textContent = String(balance);
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

    function setWorkflowStatus(type, title, message) {
        const iconMap = { success: 'check-circle', danger: 'x-circle', warning: 'exclamation-triangle', info: 'info-circle' };
        document.getElementById('import-status').innerHTML =
            '<div class="alert alert-' + type + ' py-2 mb-0">' +
                '<div class="fw-semibold"><i class="bi bi-' + (iconMap[type] || 'info-circle') + ' me-1"></i>' + escHtml(title) + '</div>' +
                '<div class="small">' + escHtml(message) + '</div>' +
            '</div>';
    }

    function appendImportLogLine(message, kind) {
        const box = document.getElementById('workflow-log');
        if (!box) return;
        const css = kind === 'warn' ? 'text-warning' : (kind === 'error' ? 'text-danger' : 'text-muted');
        box.innerHTML += '<div class="' + css + '">' + escHtml(message) + '</div>';
        box.scrollTop = box.scrollHeight;
    }

    function startImportProgressLog() {
        importStartedAt = Date.now();
        importProgressStep = 0;
        document.getElementById('import-status').innerHTML =
            '<div class="alert alert-info py-2 mb-0">' +
                '<div class="d-flex align-items-center justify-content-between mb-2">' +
                    '<span class="fw-semibold"><span class="spinner-border spinner-border-sm me-2"></span>Reading your CV</span>' +
                    '<span id="workflow-elapsed" class="small text-muted">0s</span>' +
                '</div>' +
                '<div id="workflow-log" class="workflow-log small"></div>' +
            '</div>';

        appendImportLogLine('CV uploaded. Starting import.', 'info');
        const steps = [
            'Checking the PDF file.',
            'Reading CV pages.',
            'Finding academic sections.',
            'Organizing details for review.',
            'Preparing your checklist.'
        ];

        if (importProgressTimer) clearInterval(importProgressTimer);
        importProgressTimer = setInterval(function() {
            const elapsed = Math.max(0, Math.floor((Date.now() - importStartedAt) / 1000));
            const elapsedEl = document.getElementById('workflow-elapsed');
            if (elapsedEl) elapsedEl.textContent = elapsed + 's';

            if (importProgressStep < steps.length) {
                appendImportLogLine(steps[importProgressStep], 'info');
                importProgressStep += 1;
            } else if (elapsed % 15 === 0) {
                appendImportLogLine('Still working. Long CVs can take a few minutes.', 'warn');
            }
        }, 2500);
    }

    function stopImportProgressLog() {
        if (importProgressTimer) {
            clearInterval(importProgressTimer);
            importProgressTimer = null;
        }
    }

    function summarizeEntry(entry) {
        const values = [];
        Object.keys(entry || {}).forEach(key => {
            const value = String(entry[key] || '').trim();
            if (value && values.length < 4) values.push(value);
        });
        return values.join(' | ');
    }

    function draftCounts(draft) {
        const personal = draft.personal_info || {};
        const personalCount = Object.keys(personal).filter(k => String(personal[k] || '').trim() !== '').length;
        let sectionCount = 0;
        let itemCount = 0;
        Object.keys(aiSectionLabels).forEach(sectionKey => {
            if (sectionKey === 'personal_info') return;
            const entries = Array.isArray(draft[sectionKey]) ? draft[sectionKey] : [];
            if (entries.length > 0) {
                sectionCount += 1;
                itemCount += entries.length;
            }
        });
        return { personalCount, sectionCount, itemCount };
    }

    function showAiCvDraft(draft, meta) {
        aiCvDraft = draft || {};
        const card = document.getElementById('review-card');
        const stats = document.getElementById('review-stats');
        const list = document.getElementById('draft-review-list');
        const message = document.getElementById('review-message');
        const counts = draftCounts(aiCvDraft);

        card.classList.remove('d-none');
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });

        message.innerHTML = '<div class="alert alert-light border py-2 small mb-0">Review these found items. Checked items will be added when you click <strong>Add Selected to My CV</strong>.</div>';
        stats.innerHTML =
            '<div class="col-md-4"><div class="review-stat"><div class="fw-bold fs-4">' + counts.personalCount + '</div><div class="small text-muted">profile details</div></div></div>' +
            '<div class="col-md-4"><div class="review-stat"><div class="fw-bold fs-4">' + counts.sectionCount + '</div><div class="small text-muted">CV sections</div></div></div>' +
            '<div class="col-md-4"><div class="review-stat"><div class="fw-bold fs-4">' + counts.itemCount + '</div><div class="small text-muted">CV items</div></div></div>';

        let html = '';
        const personal = aiCvDraft.personal_info || {};
        const personalKeys = Object.keys(personal).filter(k => String(personal[k] || '').trim() !== '');
        if (personalKeys.length > 0) {
            html += '<div class="mb-3"><div class="fw-semibold mb-2">Profile Details</div><div class="list-group">';
            personalKeys.forEach(key => {
                html += '<label class="list-group-item small d-flex gap-2 align-items-start">' +
                    '<input class="form-check-input mt-1 ai-cv-personal-check" type="checkbox" checked data-field="' + escHtml(key) + '">' +
                    '<span><span class="text-muted">' + escHtml(key.replaceAll('_', ' ')) + ':</span> ' + escHtml(personal[key]) + '</span>' +
                    '</label>';
            });
            html += '</div></div>';
        }

        Object.keys(aiSectionLabels).forEach(sectionKey => {
            if (sectionKey === 'personal_info') return;
            const entries = Array.isArray(aiCvDraft[sectionKey]) ? aiCvDraft[sectionKey] : [];
            if (entries.length === 0) return;
            html += '<div class="mb-3"><div class="fw-semibold mb-2">' + escHtml(aiSectionLabels[sectionKey]) + ' <span class="badge bg-secondary">' + entries.length + '</span></div>';
            html += '<div class="list-group">';
            entries.forEach((entry, index) => {
                html += '<label class="list-group-item small d-flex gap-2 align-items-start">' +
                    '<input class="form-check-input mt-1 ai-cv-entry-check" type="checkbox" checked data-section="' + escHtml(sectionKey) + '" data-index="' + index + '">' +
                    '<span>' + escHtml(summarizeEntry(entry) || 'Imported item') + '</span>' +
                    '</label>';
            });
            html += '</div></div>';
        });

        list.innerHTML = html || '<div class="text-muted small">No structured data was found. Try another source or another PDF.</div>';
        document.getElementById('ai-cv-apply-status').innerHTML = '';
        trackImportEvent('import_review_opened', { provider: meta.provider || 'unknown', cv_items: counts.itemCount });
    }

    function selectedAiCvDraft() {
        if (!aiCvDraft) return null;
        const selected = { personal_info: {} };
        document.querySelectorAll('.ai-cv-personal-check:checked').forEach(cb => {
            selected.personal_info[cb.dataset.field] = aiCvDraft.personal_info[cb.dataset.field];
        });
        Object.keys(aiSectionLabels).forEach(sectionKey => {
            if (sectionKey !== 'personal_info') selected[sectionKey] = [];
        });
        document.querySelectorAll('.ai-cv-entry-check:checked').forEach(cb => {
            const section = cb.dataset.section;
            const index = parseInt(cb.dataset.index, 10);
            if (aiCvDraft[section] && aiCvDraft[section][index]) selected[section].push(aiCvDraft[section][index]);
        });
        return selected;
    }

    function pollImportJob(jobId, btn) {
        const maxPollSeconds = 900;
        const elapsedPoll = Math.max(0, Math.floor((Date.now() - importPollStartedAt) / 1000));
        if (elapsedPoll > maxPollSeconds) {
            stopImportProgressLog();
            activeImportJobId = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars me-1"></i>Read My CV';
            setWorkflowStatus('danger', 'Import took too long', 'Please retry. If this repeats, contact support with job id ' + jobId.slice(0, 8) + '.');
            return;
        }

        fetch(API + '/profile/import/cv-pdf/status?job_id=' + encodeURIComponent(jobId))
        .then(parseJsonResponse)
        .then(res => {
            const stage = String(res.stage || 'processing');
            if (stage !== lastImportStage) {
                lastImportStage = stage;
                const map = {
                    queued: 'Waiting for the import worker.',
                    queued_for_cron_worker: 'Waiting for the background worker.',
                    retrying_worker_launch: 'Starting the worker again.',
                    processing: 'Reading your CV.',
                    extracting: 'Organizing CV sections.',
                    completed: 'Ready to review.',
                    failed: 'Import failed.'
                };
                appendImportLogLine(map[stage] || 'Working on your import.', stage === 'failed' ? 'error' : 'info');
            }

            if (!res.done) {
                setTimeout(function() { pollImportJob(jobId, btn); }, 2000);
                return;
            }

            stopImportProgressLog();
            activeImportJobId = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars me-1"></i>Read My CV';

            if (res.error) {
                setWorkflowStatus('danger', 'CV import failed', res.error || 'Please try another PDF.');
                trackImportEvent('import_failed', { source: 'pdf', error_message: res.error || 'CV import failed' });
                return;
            }

            setWorkflowStatus('success', 'Ready to review', 'We found information in your CV. Review the checklist below.');
            showAiCvDraft(res.draft || {}, res);
        })
        .catch(error => {
            stopImportProgressLog();
            activeImportJobId = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars me-1"></i>Read My CV';
            setWorkflowStatus('danger', 'CV import failed', error.message || 'Please try again.');
            trackImportEvent('import_failed', { source: 'pdf', error_message: error.message || 'CV import failed' });
        });
    }

    document.getElementById('ai-cv-upload-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('ai-cv-pdf');
        if (!input.files || input.files.length === 0) {
            csAlert('Please choose a CV PDF first.', {type: 'warning', title: 'Missing PDF'});
            return;
        }
        const btn = document.getElementById('btn-import-ai-cv');
        if (activeImportJobId) {
            csAlert('An import is already running. Please wait for it to finish.', {type: 'info', title: 'Import in Progress'});
            return;
        }

        const formData = new FormData();
        formData.append('cv_pdf', input.files[0]);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Reading...';
        lastImportStage = '';
        startImportProgressLog();
        trackImportEvent('import_started', { source: 'pdf' });

        fetch(API + '/profile/import/cv-pdf/start', { method: 'POST', body: formData })
        .then(parseJsonResponse)
        .then(res => {
            if (!res.success || !res.job_id) throw new Error(res.error || 'Could not start import.');
            activeImportJobId = res.job_id;
            importPollStartedAt = Date.now();
            pollImportJob(activeImportJobId, btn);
        })
        .catch(error => {
            stopImportProgressLog();
            activeImportJobId = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars me-1"></i>Read My CV';
            setWorkflowStatus('danger', 'CV import failed', error.message || 'Please try again.');
        });
    });

    function importProfileSource(source, inputId, buttonId, endpoint, payloadKey, defaultHtml) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        const value = input.value.trim();
        if (!value) {
            csAlert('Please enter the profile ID or URL first.', {type: 'warning', title: 'Missing Input'});
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';
        setWorkflowStatus('info', 'Importing ' + source, 'Fetching your academic profile.');
        trackImportEvent('import_started', { source: source.toLowerCase() });

        fetch(API + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [payloadKey]: value })
        })
        .then(parseJsonResponse)
        .then(res => {
            btn.disabled = false;
            btn.innerHTML = defaultHtml;
            setWorkflowStatus('success', 'Ready to review', res.message || 'Import finished. Review the checklist below.');
            if (res.draft) showAiCvDraft(res.draft, res);
            refreshPublications();
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = defaultHtml;
            setWorkflowStatus('danger', source + ' import failed', error.message || 'Please check the ID or URL and try again.');
        });
    }

    document.getElementById('btn-import-orcid').addEventListener('click', function() {
        importProfileSource('ORCID', 'orcid-input', 'btn-import-orcid', '/profile/import/orcid', 'orcid_id', '<i class="bi bi-download me-1"></i>Import ORCID');
    });

    document.getElementById('btn-import-scholar').addEventListener('click', function() {
        importProfileSource('Google Scholar', 'scholar-input', 'btn-import-scholar', '/profile/import/scholar', 'scholar_id', '<i class="bi bi-download me-1"></i>Import Scholar');
    });

    document.getElementById('btn-apply-ai-cv-draft').addEventListener('click', function() {
        const selected = selectedAiCvDraft();
        if (!selected) return;

        selected.merge_strategy = document.getElementById('ai-cv-merge-strategy').value || 'fill_missing_add_new';
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Adding...';
        document.getElementById('ai-cv-apply-status').innerHTML = '<div class="alert alert-info py-2 small mb-0">Adding checked items to your CV...</div>';

        fetch(API + '/profile/import/cv-draft/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(selected)
        })
        .then(parseJsonResponse)
        .then(res => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Add Selected to My CV';
            updateCreditsBadge(res.credits_balance);
            const editUrl = res.edit_url || manageUrl;
            const addedCount = Object.values(res.added || {}).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
            const lockedSections = Object.keys(res.locked_sections || {});
            const lockedText = lockedSections.length ? ' ' + lockedSections.length + ' advanced section(s) were saved for later use.' : '';
            document.getElementById('ai-cv-apply-status').innerHTML =
                '<div class="alert alert-success py-2 small mb-0">Added ' + addedCount + ' item(s) to your CV.' + escHtml(lockedText) + ' <a href="' + escHtml(editUrl) + '" class="alert-link">Open CV editor</a></div>';
            setWorkflowStatus('success', 'Added to your CV', 'You can now review and edit the added information in the CV editor.');
            trackImportEvent('import_apply_completed', { profile_id: res.profile_id || 0, entries_added: addedCount });
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Add Selected to My CV';
            document.getElementById('ai-cv-apply-status').innerHTML = '<div class="alert alert-danger py-2 small mb-0">' + escHtml(error.message || 'Could not apply draft.') + '</div>';
        });
    });

    function selectedPublicationSources() {
        const sources = {};
        document.querySelectorAll('.pub-checkbox:checked').forEach(cb => {
            if (cb.dataset.source) sources[cb.dataset.source] = true;
        });
        return Object.keys(sources);
    }

    function getSelectedIds() {
        return Array.from(document.querySelectorAll('.pub-checkbox:checked')).map(cb => parseInt(cb.value, 10));
    }

    function updateButtons() {
        const ids = getSelectedIds();
        document.getElementById('btn-approve-selected').disabled = ids.length === 0;
        document.getElementById('btn-reject-selected').disabled = ids.length === 0;
    }

    function bindSelectAll() {
        const selectAll = document.getElementById('select-all-pubs');
        if (!selectAll) return;
        selectAll.addEventListener('change', function() {
            document.querySelectorAll('.pub-checkbox').forEach(cb => cb.checked = this.checked);
            updateButtons();
        });
    }

    function renderPendingPublications(pubs) {
        const countEl = document.getElementById('pending-publications-count');
        const list = document.getElementById('publications-list');
        const selectAll = document.getElementById('select-all-pubs');
        const selectAllLabel = selectAll ? selectAll.closest('label') : null;
        countEl.textContent = pubs.length;
        if (selectAllLabel) selectAllLabel.classList.toggle('d-none', pubs.length === 0);
        if (pubs.length === 0) {
            list.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-journal-x fs-1"></i><p class="mt-2 mb-0">No publications are waiting for approval.</p></div>';
            updateButtons();
            return;
        }

        let html = '<div class="list-group">';
        pubs.forEach(p => {
            const srcClass = p.source === 'orcid' ? 'success' : 'primary';
            const venue = p.venue ? ' | ' + p.venue : '';
            html += '<label class="list-group-item d-flex gap-3 align-items-start">' +
                '<input type="checkbox" class="form-check-input mt-1 pub-checkbox" value="' + parseInt(p.id, 10) + '" data-source="' + escHtml(p.source || '') + '">' +
                '<span class="flex-grow-1"><span class="fw-semibold d-block">' + escHtml(p.title || '') + '</span>' +
                '<span class="small text-muted d-block">' + escHtml(p.authors || '') + '</span>' +
                '<span class="small text-muted">' + escHtml(p.year || '') + escHtml(venue) + '</span></span>' +
                '<span class="badge bg-' + srcClass + '">' + escHtml(p.source || '') + '</span>' +
                '</label>';
        });
        html += '</div>';
        list.innerHTML = html;
        if (selectAll) selectAll.checked = false;
        updateButtons();
    }

    function refreshPublications() {
        fetch(API + '/profile/import/pending')
        .then(parseJsonResponse)
        .then(res => {
            renderPendingPublications(res.publications || []);
            if (typeof res.approved_count !== 'undefined') {
                document.getElementById('approved-publications-count').textContent = parseInt(res.approved_count, 10) || 0;
            }
        });
    }

    bindSelectAll();

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('pub-checkbox')) {
            updateButtons();
        }
    });

    document.getElementById('btn-approve-selected').addEventListener('click', function() {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        const btn = this;
        csConfirm('Approve ' + ids.length + ' publication(s) and add them to your CV?', function() {
            btn.disabled = true;
            fetch(API + '/profile/import/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publication_ids: ids })
            })
            .then(parseJsonResponse)
            .then(res => {
                btn.disabled = false;
                setWorkflowStatus('success', 'Publications added', res.message || 'Selected publications were added to your CV.');
                refreshPublications();
                trackImportEvent('publications_approved', { total_publications_selected: ids.length, sources: selectedPublicationSources() });
            })
            .catch(error => {
                btn.disabled = false;
                csAlert(error.message || 'Could not approve publications.', {type: 'danger'});
            });
        }, {type: 'info', title: 'Approve Publications', confirmText: 'Yes, approve'});
    });

    document.getElementById('btn-reject-selected').addEventListener('click', function() {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        const btn = this;
        csConfirm('Remove ' + ids.length + ' publication(s) from the waiting list?', function() {
            btn.disabled = true;
            fetch(API + '/profile/import/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publication_ids: ids })
            })
            .then(parseJsonResponse)
            .then(res => {
                btn.disabled = false;
                setWorkflowStatus('success', 'Publications removed', res.message || 'Selected publications were removed.');
                refreshPublications();
            })
            .catch(error => {
                btn.disabled = false;
                csAlert(error.message || 'Could not remove publications.', {type: 'danger'});
            });
        }, {type: 'danger', title: 'Remove Publications', confirmText: 'Yes, remove'});
    });

    document.getElementById('btn-manage-approved-publications').addEventListener('click', function() {
        trackImportEvent('manage_existing_publications_clicked', {});
    });
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
