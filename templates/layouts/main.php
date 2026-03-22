<?php require_once APP_PATH . '/helpers.php'; ?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle ?? 'Academic CV Builder') ?> - <?= APP_NAME ?></title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/webp" href="<?= APP_URL ?>/assets/images/favicon.webp">
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link href="<?= APP_URL ?>/assets/css/style.css" rel="stylesheet">
    <?php if (!empty($extraCss)): ?>
        <?= $extraCss ?>
    <?php endif; ?>
</head>
<body>
    <?php if (Auth::check()): ?>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark navbar-cvscholar sticky-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="<?= APP_URL ?>/dashboard">
                <img src="<?= APP_URL ?>/assets/images/logo-header.webp" alt="<?= APP_NAME ?>" height="32">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="mainNav">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/dashboard">
                            <i class="bi bi-grid-1x2 me-1"></i>Dashboard
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/templates">
                            <i class="bi bi-layout-text-window me-1"></i>Templates
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/profile/import">
                            <i class="bi bi-cloud-download me-1"></i>Import
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/plans">
                            <i class="bi bi-gem me-1"></i>Plans
                        </a>
                    </li>
                    <?php if (Auth::user()['is_admin'] ?? false): ?>
                    <li class="nav-item">
                        <a class="nav-link text-warning" href="<?= APP_URL ?>/admin">
                            <i class="bi bi-shield-lock me-1"></i>Admin
                        </a>
                    </li>
                    <?php endif; ?>
                </ul>
                <ul class="navbar-nav">
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                            <i class="bi bi-person-circle me-1"></i>
                            <?= e(Auth::user()['full_name'] ?: Auth::user()['username']) ?>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><span class="dropdown-item-text text-muted small">
                                Plan: <?= ucfirst(e(Auth::user()['subscription_plan'])) ?>
                            </span></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/plans">
                                <i class="bi bi-gem me-2"></i>Upgrade Plan
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/logout">
                                <i class="bi bi-box-arrow-right me-2"></i>Logout
                            </a></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    <?php endif; ?>

    <!-- Flash Messages -->
    <?php if (Auth::check()): ?>
    <div class="container mt-3">
        <?= flash_messages() ?>
    </div>
    <?php endif; ?>

    <!-- Main Content -->
    <main>
        <?= $content ?? '' ?>
    </main>

    <!-- Footer (hidden on auth pages) -->
    <?php if (Auth::check()): ?>
    <footer class="py-4 mt-5">
        <div class="container text-center">
            <div class="footer-tagline mb-1"><?= APP_TAGLINE ?></div>
            <small>&copy; <?= date('Y') ?> <?= APP_NAME ?>. Built for academics, by academics.</small>
        </div>
    </footer>
    <?php endif; ?>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Global Confirmation & Alert Modal -->
    <div class="modal fade" id="csModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-body text-center py-4 px-4">
                    <div id="csModalIcon" class="mb-3"></div>
                    <h5 id="csModalTitle" class="fw-bold mb-2"></h5>
                    <p id="csModalMsg" class="text-muted mb-0"></p>
                </div>
                <div class="modal-footer border-0 justify-content-center pb-4 pt-0" id="csModalFooter">
                    <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal" id="csModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary px-4" id="csModalConfirm">Confirm</button>
                </div>
            </div>
        </div>
    </div>
    <script>
    // Global popup system — replaces browser confirm() and alert()
    (function() {
        var modal = null;
        function getModal() {
            if (!modal) modal = new bootstrap.Modal(document.getElementById('csModal'));
            return modal;
        }

        // csConfirm(message, onConfirm, options?)
        // options: { title, type: 'danger'|'warning'|'info', confirmText, cancelText }
        window.csConfirm = function(message, onConfirm, options) {
            options = options || {};
            var type = options.type || 'warning';
            var icons = {
                danger:  '<i class="bi bi-exclamation-triangle-fill text-danger" style="font-size:2.5rem"></i>',
                warning: '<i class="bi bi-question-circle-fill text-warning" style="font-size:2.5rem"></i>',
                info:    '<i class="bi bi-info-circle-fill text-primary" style="font-size:2.5rem"></i>',
                success: '<i class="bi bi-check-circle-fill text-success" style="font-size:2.5rem"></i>'
            };
            var btnClass = { danger: 'btn-danger', warning: 'btn-warning', info: 'btn-primary', success: 'btn-success' };

            document.getElementById('csModalIcon').innerHTML = icons[type] || icons.warning;
            document.getElementById('csModalTitle').textContent = options.title || 'Are you sure?';
            document.getElementById('csModalMsg').textContent = message;
            document.getElementById('csModalCancel').style.display = '';
            document.getElementById('csModalCancel').textContent = options.cancelText || 'Cancel';

            var confirmBtn = document.getElementById('csModalConfirm');
            confirmBtn.className = 'btn px-4 ' + (btnClass[type] || 'btn-primary');
            confirmBtn.textContent = options.confirmText || 'Confirm';
            confirmBtn.style.display = '';
            confirmBtn.onclick = function() { getModal().hide(); if (onConfirm) onConfirm(); };

            getModal().show();
        };

        // csAlert(message, options?)
        // options: { title, type: 'danger'|'warning'|'info'|'success' }
        window.csAlert = function(message, options) {
            options = options || {};
            var type = options.type || 'info';
            var icons = {
                danger:  '<i class="bi bi-x-circle-fill text-danger" style="font-size:2.5rem"></i>',
                warning: '<i class="bi bi-exclamation-triangle-fill text-warning" style="font-size:2.5rem"></i>',
                info:    '<i class="bi bi-info-circle-fill text-primary" style="font-size:2.5rem"></i>',
                success: '<i class="bi bi-check-circle-fill text-success" style="font-size:2.5rem"></i>'
            };

            document.getElementById('csModalIcon').innerHTML = icons[type] || icons.info;
            document.getElementById('csModalTitle').textContent = options.title || (type === 'danger' ? 'Error' : type === 'success' ? 'Success' : 'Notice');
            document.getElementById('csModalMsg').textContent = message;
            document.getElementById('csModalCancel').style.display = 'none';

            var confirmBtn = document.getElementById('csModalConfirm');
            confirmBtn.className = 'btn px-4 btn-primary';
            confirmBtn.textContent = 'OK';
            confirmBtn.style.display = '';
            confirmBtn.onclick = function() { getModal().hide(); };

            getModal().show();
        };

        // Auto-wire forms with data-confirm attribute
        document.addEventListener('submit', function(e) {
            var form = e.target;
            if (!form.dataset.confirm) return;
            if (form.dataset.confirmed === 'true') { form.dataset.confirmed = ''; return; }
            e.preventDefault();
            csConfirm(form.dataset.confirm, function() {
                form.dataset.confirmed = 'true';
                form.submit();
            }, {
                type: form.dataset.confirmType || 'danger',
                title: form.dataset.confirmTitle || 'Are you sure?',
                confirmText: form.dataset.confirmBtn || 'Yes, proceed'
            });
        });
    })();
    </script>

    <!-- Custom JS -->
    <script src="<?= APP_URL ?>/assets/js/app.js"></script>
    <?php if (!empty($extraJs)): ?>
        <?= $extraJs ?>
    <?php endif; ?>

    <!-- Share Modal -->
    <div class="modal fade" id="shareModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header border-0 pb-0">
                    <h5 class="modal-title fw-bold"><i class="bi bi-share me-2"></i>Share CV</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body pt-2">
                    <!-- Loading state -->
                    <div id="share-loading" class="text-center py-4">
                        <div class="spinner-border spinner-border-sm text-primary"></div>
                        <span class="ms-2 text-muted">Loading...</span>
                    </div>
                    <!-- Content (hidden until loaded) -->
                    <div id="share-content" style="display:none">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted">Share Link</label>
                            <div class="input-group">
                                <input type="text" id="share-url" class="form-control form-control-sm bg-light" readonly>
                                <button class="btn btn-outline-primary btn-sm" type="button" id="share-copy-btn" onclick="copyShareUrl()">
                                    <i class="bi bi-clipboard me-1"></i>Copy
                                </button>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <span class="small text-muted"><i class="bi bi-eye me-1"></i><span id="share-views">0</span> views</span>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="share-active-toggle" onchange="toggleShareLink()">
                                <label class="form-check-label small" for="share-active-toggle" id="share-active-label">Active</label>
                            </div>
                        </div>
                        <div id="share-inactive-notice" class="alert alert-warning small py-2 mb-0" style="display:none">
                            <i class="bi bi-pause-circle me-1"></i>This link is currently disabled. Toggle it on to make it accessible.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>
    // Share feature functions
    (function() {
        var shareModalEl = document.getElementById('shareModal');
        var shareModal = null;
        var currentShareCvId = null;

        function getShareModal() {
            if (!shareModal) shareModal = new bootstrap.Modal(shareModalEl);
            return shareModal;
        }

        window.openShareModal = function(cvId) {
            currentShareCvId = cvId;
            document.getElementById('share-loading').style.display = '';
            document.getElementById('share-content').style.display = 'none';
            getShareModal().show();

            // First try to get existing share info
            fetch('<?= APP_URL ?>/cv/share/info/' + cvId)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.error) {
                        hideShareThenAlert(data.error, { type: 'warning', title: 'Cannot Share' });
                    } else if (data.exists) {
                        showShareContent(data);
                    } else {
                        // Create new share link
                        createShareLink(cvId);
                    }
                })
                .catch(function() {
                    hideShareThenAlert('Failed to load share info.', { type: 'danger', title: 'Error' });
                });
        };

        function hideShareThenAlert(msg, opts) {
            shareModalEl.addEventListener('hidden.bs.modal', function handler() {
                shareModalEl.removeEventListener('hidden.bs.modal', handler);
                csAlert(msg, opts);
            });
            getShareModal().hide();
        }

        function createShareLink(cvId) {
            fetch('<?= APP_URL ?>/cv/share/' + cvId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: '<?= CSRF_TOKEN_NAME ?>=<?= e($_SESSION['csrf_token'] ?? '') ?>'
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.error) {
                    hideShareThenAlert(data.error, { type: 'warning', title: 'Cannot Share' });
                    return;
                }
                showShareContent(data);
            })
            .catch(function() {
                hideShareThenAlert('Failed to create share link.', { type: 'danger', title: 'Error' });
            });
        }

        function showShareContent(data) {
            document.getElementById('share-loading').style.display = 'none';
            document.getElementById('share-content').style.display = '';
            document.getElementById('share-url').value = data.share_url;
            document.getElementById('share-views').textContent = data.view_count || 0;
            document.getElementById('share-active-toggle').checked = data.is_active;
            document.getElementById('share-active-label').textContent = data.is_active ? 'Active' : 'Disabled';
            document.getElementById('share-inactive-notice').style.display = data.is_active ? 'none' : '';
        }

        window.copyShareUrl = function() {
            var url = document.getElementById('share-url').value;
            navigator.clipboard.writeText(url).then(function() {
                var btn = document.getElementById('share-copy-btn');
                btn.innerHTML = '<i class="bi bi-check me-1"></i>Copied!';
                btn.classList.replace('btn-outline-primary', 'btn-success');
                setTimeout(function() {
                    btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy';
                    btn.classList.replace('btn-success', 'btn-outline-primary');
                }, 2000);
            });
        };

        window.toggleShareLink = function() {
            if (!currentShareCvId) return;
            fetch('<?= APP_URL ?>/cv/share/toggle/' + currentShareCvId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: '<?= CSRF_TOKEN_NAME ?>=<?= e($_SESSION['csrf_token'] ?? '') ?>'
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var toggle = document.getElementById('share-active-toggle');
                toggle.checked = data.is_active;
                document.getElementById('share-active-label').textContent = data.is_active ? 'Active' : 'Disabled';
                document.getElementById('share-inactive-notice').style.display = data.is_active ? 'none' : '';
            });
        };
    })();
    </script>
</body>
</html>
