<?php
$pageTitle = 'Manage Users';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-people me-2"></i>Manage Users</h2>
            <p class="text-muted mb-0"><?= count($users) ?> user<?= count($users) !== 1 ? 's' : '' ?> found</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <!-- Filters -->
    <div class="card shadow-sm mb-4">
        <div class="card-body py-3">
            <form method="GET" action="<?= APP_URL ?>/admin/users" class="row g-2 align-items-end">
                <div class="col-md-5">
                    <label class="form-label small fw-semibold mb-1">Search</label>
                    <input type="text" name="search" class="form-control" placeholder="Search by name, email, or username..." 
                           value="<?= e($search) ?>">
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-semibold mb-1">Credits</label>
                    <div class="form-control form-control-plaintext small text-muted">Use search to find an account</div>
                </div>
                <div class="col-md-2">
                    <button type="submit" class="btn btn-primary w-100"><i class="bi bi-search me-1"></i>Filter</button>
                </div>
                <div class="col-md-2">
                    <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-secondary w-100">Clear</a>
                </div>
            </form>
        </div>
    </div>

    <!-- Users Table -->
    <div class="card shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>User</th>
                        <th>Credits</th>
                        <th>CVs</th>
                        <th>Auth</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Last Login</th>
                        <th style="width: 200px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                    <tr class="<?= !$u['is_active'] ? 'table-secondary' : '' ?>">
                        <td class="text-muted small"><?= $u['id'] ?></td>
                        <td>
                            <div class="fw-semibold"><?= e($u['full_name'] ?: $u['username']) ?></div>
                            <div class="text-muted small"><?= e($u['email']) ?></div>
                            <?php if ($u['is_admin']): ?>
                                <span class="badge bg-danger small">Admin</span>
                            <?php endif; ?>
                            <?php if (!empty($u['last_device'])): ?>
                                <?php
                                    $deviceIcon  = ['mobile' => 'phone', 'tablet' => 'tablet', 'desktop' => 'laptop'][$u['last_device']] ?? 'display';
                                    $deviceClass = ['mobile' => 'bg-warning text-dark', 'tablet' => 'bg-info text-dark', 'desktop' => 'bg-light text-dark'][$u['last_device']] ?? 'bg-secondary text-white';
                                ?>
                                <span class="badge <?= $deviceClass ?> small" title="<?= e($u['last_device_ua'] ?? '') ?>">
                                    <i class="bi bi-<?= $deviceIcon ?> me-1"></i><?= ucfirst($u['last_device']) ?>
                                </span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <span class="badge bg-success-subtle text-success"><?= (int) ($u['credit_balance'] ?? 0) ?> credits</span>
                        </td>
                        <td>
                            <?php if ((int) $u['cv_count'] > 0): ?>
                                <button type="button"
                                        class="btn btn-sm btn-outline-primary py-0 px-2 js-user-cvs"
                                        data-user-id="<?= (int) $u['id'] ?>"
                                        data-user-name="<?= e($u['full_name'] ?: $u['username']) ?>"
                                        data-user-email="<?= e($u['email']) ?>"
                                        title="View this user's CVs and compile status">
                                    <?= (int) $u['cv_count'] ?>
                                </button>
                            <?php else: ?>
                                <span class="badge bg-light text-dark">0</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($u['google_id']): ?>
                                <i class="bi bi-google text-danger" title="Google"></i>
                            <?php endif; ?>
                            <?php if ($u['hashed_password']): ?>
                                <i class="bi bi-key text-muted" title="Password"></i>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($u['is_active']): ?>
                                <span class="badge bg-success-subtle text-success">Active</span>
                            <?php else: ?>
                                <span class="badge bg-danger-subtle text-danger">Inactive</span>
                            <?php endif; ?>
                        </td>
                        <td class="small text-muted"><?= date('M j, Y', strtotime($u['created_at'])) ?></td>
                        <td class="small text-muted"><?= $u['last_login_at'] ? date('M j, Y', strtotime($u['last_login_at'])) : 'Never' ?></td>
                        <td>
                            <div class="d-flex gap-1">
                                <!-- Toggle Active -->
                                <?php if ($u['id'] !== Auth::id()): ?>
                                <form method="POST" action="<?= APP_URL ?>/admin/users/toggle-status"
                                      data-confirm="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?> this user?"
                                      data-confirm-title="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?> User"
                                      data-confirm-type="<?= $u['is_active'] ? 'warning' : 'info' ?>"
                                      data-confirm-btn="Yes, <?= $u['is_active'] ? 'deactivate' : 'activate' ?>">
                                    <?= Auth::csrfField() ?>
                                    <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                    <button type="submit" class="btn btn-sm <?= $u['is_active'] ? 'btn-outline-warning' : 'btn-outline-success' ?>"
                                            title="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?>">
                                        <i class="bi bi-<?= $u['is_active'] ? 'pause-circle' : 'play-circle' ?>"></i>
                                    </button>
                                </form>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($users)): ?>
                    <tr>
                        <td colspan="9" class="text-center text-muted py-4">No users found.</td>
                    </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- User CV Details Modal -->
<div class="modal fade" id="userCvsModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="bi bi-file-earmark-text me-2"></i>
                    User CV Progress
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div id="userCvsHeader" class="mb-3 text-muted small"></div>
                <div id="userCvsLoading" class="text-muted">Loading CV data...</div>
                <div id="userCvsError" class="alert alert-danger d-none" role="alert"></div>
                <div class="table-responsive d-none" id="userCvsTableWrap">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>CV</th>
                                <th>Template</th>
                                <th>Sections</th>
                                <th>Entries</th>
                                <th>Last Activity</th>
                                <th>Compiled</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="userCvsTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
    const loadingEl = document.getElementById('userCvsLoading');
    const errorEl = document.getElementById('userCvsError');
    const tableWrapEl = document.getElementById('userCvsTableWrap');
    const tbodyEl = document.getElementById('userCvsTableBody');
    const headerEl = document.getElementById('userCvsHeader');
    const csrfToken = '<?= e($_SESSION['csrf_token'] ?? '') ?>';

    function statusBadge(status) {
        if (status === 'compiled_current') {
            return '<span class="badge bg-success">Compiled - Up to Date</span>';
        }
        if (status === 'compiled_outdated') {
            return '<span class="badge bg-warning text-dark">Compiled - Needs Recompile</span>';
        }
        return '<span class="badge bg-secondary">Not Compiled</span>';
    }

    function formatDate(value) {
        if (!value) return 'Never';
        const d = new Date(value.replace(' ', 'T'));
        if (isNaN(d.getTime())) return value;
        return d.toLocaleString();
    }

    async function loadUserCvs(userId, userName, userEmail) {
        headerEl.textContent = userName + ' (' + userEmail + ')';
        loadingEl.classList.remove('d-none');
        errorEl.classList.add('d-none');
        tableWrapEl.classList.add('d-none');
        tbodyEl.innerHTML = '';

        try {
            const res = await fetch('<?= APP_URL ?>/admin/users/cvs?user_id=' + encodeURIComponent(userId), {
                credentials: 'same-origin'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to load CVs');
            }

            if (!Array.isArray(data.cvs) || data.cvs.length === 0) {
                tbodyEl.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No CVs found for this user.</td></tr>';
            } else {
                tbodyEl.innerHTML = data.cvs.map(function (cv) {
                    const compiledAt = cv.last_compiled_at ? formatDate(cv.last_compiled_at) : 'No';
                    const pdfButton = cv.is_compiled
                        ? '<a class="btn btn-sm btn-outline-success me-1 js-admin-cv-pdf" target="_blank" href="<?= APP_URL ?>/admin/users/cv/pdf/' + cv.id + '"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</a>'
                        : '';
                    return '' +
                        '<tr data-cv-id="' + cv.id + '">' +
                            '<td><strong>' + escapeHtml(cv.name) + '</strong></td>' +
                            '<td>' + escapeHtml(cv.template_name) + '</td>' +
                            '<td>' + cv.section_count + '</td>' +
                            '<td>' + cv.entry_count + '</td>' +
                            '<td>' + formatDate(cv.last_activity_at || cv.updated_at) + '</td>' +
                            '<td class="js-compiled-at">' + compiledAt + '</td>' +
                            '<td class="js-status">' + statusBadge(cv.status) + '</td>' +
                            '<td>' +
                                '<a class="btn btn-sm btn-outline-secondary me-1" target="_blank" href="<?= APP_URL ?>/admin/users/cv/preview/' + cv.id + '">' +
                                    '<i class="bi bi-eye me-1"></i>Preview' +
                                '</a>' +
                                pdfButton +
                                '<button class="btn btn-sm btn-outline-primary js-compile-cv" data-cv-id="' + cv.id + '">' +
                                    '<i class="bi bi-gear me-1"></i>Compile' +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                }).join('');
            }

            loadingEl.classList.add('d-none');
            tableWrapEl.classList.remove('d-none');
        } catch (err) {
            loadingEl.classList.add('d-none');
            errorEl.textContent = err.message;
            errorEl.classList.remove('d-none');
        }
    }

    async function compileCv(button, cvId) {
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Compiling';

        try {
            const res = await fetch('<?= APP_URL ?>/admin/users/cv/compile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({ cv_id: cvId, csrf_token: csrfToken })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Compilation failed');
            }

            const row = button.closest('tr');
            if (row) {
                const compiledCell = row.querySelector('.js-compiled-at');
                const statusCell = row.querySelector('.js-status');
                if (compiledCell) compiledCell.textContent = formatDate(data.last_compiled_at);
                if (statusCell) statusCell.innerHTML = statusBadge('compiled_current');

                // Keep only one PDF action button per row.
                const existingPdfLinks = row.querySelectorAll('.js-admin-cv-pdf');
                if (existingPdfLinks.length > 1) {
                    existingPdfLinks.forEach(function (link, idx) {
                        if (idx > 0) link.remove();
                    });
                }

                let pdfLink = row.querySelector('.js-admin-cv-pdf');
                if (!pdfLink) {
                    pdfLink = document.createElement('a');
                    pdfLink.className = 'btn btn-sm btn-outline-success me-1 js-admin-cv-pdf';
                    pdfLink.target = '_blank';
                    pdfLink.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>PDF';

                    const previewLink = row.querySelector('a[href*="/admin/users/cv/preview/"]');
                    if (previewLink) {
                        previewLink.insertAdjacentElement('afterend', pdfLink);
                    }
                }

                if (pdfLink) {
                    pdfLink.href = '<?= APP_URL ?>/admin/users/cv/pdf/' + cvId;
                }
            }
        } catch (err) {
            alert(err.message);
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    document.querySelectorAll('.js-user-cvs').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const modal = bootstrap.Modal.getOrCreateInstance(
                document.getElementById('userCvsModal')
            );
            const userId = btn.getAttribute('data-user-id');
            const userName = btn.getAttribute('data-user-name') || 'User';
            const userEmail = btn.getAttribute('data-user-email') || '';
            modal.show();
            loadUserCvs(userId, userName, userEmail);
        });
    });

    tbodyEl.addEventListener('click', function (ev) {
        const btn = ev.target.closest('.js-compile-cv');
        if (!btn) return;
        const cvId = parseInt(btn.getAttribute('data-cv-id') || '0', 10);
        if (!cvId) return;
        compileCv(btn, cvId);
    });
});
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
