<?php
$pageTitle = 'Import Academic Profile';
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="fw-bold mb-1"><i class="bi bi-cloud-download me-2"></i>Import Academic Profile</h4>
            <p class="text-muted mb-0">Import your publications and profile data from ORCID or Google Scholar</p>
        </div>
        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
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
                <span class="text-muted ms-2 small" id="profile-apply-status"></span>
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
                                    <td><input type="checkbox" class="form-check-input pub-checkbox" value="<?= $pub['id'] ?>"></td>
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
                    '<td><input type="checkbox" class="form-check-input pub-checkbox" value="' + p.id + '"></td>' +
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
        if (!orcidId) { alert('Please enter an ORCID ID.'); return; }

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
        if (!scholarId) { alert('Please enter a Google Scholar URL or ID.'); return; }

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
    document.getElementById('btn-apply-profile').addEventListener('click', function() {
        if (!window._importedProfile) return;

        this.disabled = true;
        fetch(API + '/profile/import/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window._importedProfile)
        })
        .then(r => r.json())
        .then(res => {
            this.disabled = false;
            document.getElementById('profile-apply-status').textContent = 
                res.success ? 'Profile updated!' : (res.error || 'Failed');
        })
        .catch(() => {
            this.disabled = false;
            document.getElementById('profile-apply-status').textContent = 'Update failed.';
        });
    });

    // ===== Select All Checkbox =====
    function bindSelectAll() {
        const selectAll = document.getElementById('select-all-pubs');
        if (selectAll) {
            selectAll.addEventListener('change', function() {
                document.querySelectorAll('.pub-checkbox').forEach(cb => cb.checked = this.checked);
                updateButtons();
            });
        }
    }
    bindSelectAll();

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('pub-checkbox')) updateButtons();
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
        if (!confirm('Approve ' + ids.length + ' publication(s) and add to your CV?')) return;

        this.disabled = true;
        fetch(API + '/profile/import/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publication_ids: ids })
        })
        .then(r => r.json())
        .then(res => {
            this.disabled = false;
            if (res.success) {
                refreshPublications();
                document.getElementById('orcid-status').innerHTML = 
                    '<div class="alert alert-success py-2 small">' + escHtml(res.message) + '</div>';
            } else {
                alert(res.error || 'Failed');
            }
        });
    });

    // ===== Reject =====
    document.getElementById('btn-reject-selected').addEventListener('click', function() {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        if (!confirm('Remove ' + ids.length + ' publication(s)?')) return;

        this.disabled = true;
        fetch(API + '/profile/import/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publication_ids: ids })
        })
        .then(r => r.json())
        .then(res => {
            this.disabled = false;
            if (res.success) refreshPublications();
            else alert(res.error || 'Failed');
        });
    });
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
