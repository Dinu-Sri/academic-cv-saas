<?php require_once APP_PATH . '/helpers.php';
// Load WhatsApp settings once for the layout
$_waEnabled = false;
$_waSettings = [];
if (class_exists('SiteSetting')) {
    try {
        $_sm = new SiteSetting();
        $_waEnabled = $_sm->get('whatsapp_enabled') === '1';
        if ($_waEnabled) {
            $_waSettings = $_sm->getMultiple(['whatsapp_phone','whatsapp_agent_name','whatsapp_questions']);
        }
    } catch (Throwable $_e) {}
}
$_waShowButton = $_waEnabled;
$_waPhone = preg_replace('/\D/', '', $_waSettings['whatsapp_phone'] ?? '');
$_waAgent = $_waSettings['whatsapp_agent_name'] ?? 'Support';
$_waQuestions = json_decode($_waSettings['whatsapp_questions'] ?? '[]', true) ?: [];

$_creditBalance = null;
if (Auth::check() && class_exists('Credit')) {
    try {
        $_creditBalance = (new Credit())->balance((int) Auth::id());
    } catch (Throwable $_e) {}
}

$_behaviorTrackingEnabled = false;
$_behaviorRetentionDays = 180;
$_behaviorSamplingRate = 100;
$_behaviorMaskInputs = true;

if (Auth::check() && class_exists('SiteSetting')) {
    try {
        if (!isset($_sm) || !($_sm instanceof SiteSetting)) {
            $_sm = new SiteSetting();
        }
        $_behaviorSettings = $_sm->getMultiple([
            'behavior_tracking_enabled',
            'behavior_retention_days',
            'behavior_sampling_rate',
            'behavior_mask_inputs',
        ]);

        $_behaviorTrackingEnabled = ($_behaviorSettings['behavior_tracking_enabled'] ?? '0') === '1';
        $_behaviorRetentionDays = max(1, min((int)($_behaviorSettings['behavior_retention_days'] ?? 180), 3650));
        $_behaviorSamplingRate = max(1, min((int)($_behaviorSettings['behavior_sampling_rate'] ?? 100), 100));
        $_behaviorMaskInputs = ($_behaviorSettings['behavior_mask_inputs'] ?? '1') === '1';
    } catch (Throwable $_e) {}
}
?>
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
    <?php if (defined('GOOGLE_ANALYTICS_ID') && GOOGLE_ANALYTICS_ID): ?>
    <!-- Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=<?= GOOGLE_ANALYTICS_ID ?>"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','<?= GOOGLE_ANALYTICS_ID ?>');</script>
    <?php endif; ?>

    <!-- Microsoft Clarity -->
    <script type="text/javascript">
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "wmxf7kusaj");
    </script>

    <?php if (defined('POSTHOG_ENABLED') && POSTHOG_ENABLED && defined('POSTHOG_API_KEY') && POSTHOG_API_KEY): ?>
    <!-- PostHog Analytics -->
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.PostHog=new Proxy(new Proxy({},{get:function(t,e){return"string"==typeof e&&-1===e.indexOf("__")?"function"!=typeof t[e]?g(t,e):t[e]:t[e]}}),{get:function(t,e){return"string"==typeof e&&-1===e.indexOf("__")?"function"!=typeof t[e]?g(p,e):t[e]:t[e]}}))._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('<?= POSTHOG_API_KEY ?>', {
            api_host: '<?= POSTHOG_API_URL ?>',
            person_profiles: 'identified_only',
            persistence: 'localStorage+cookie',
            autocapture: false,
            capture_pageview: true,
            capture_pageleave: true
        });
        <?php if (Auth::check()): ?>
        posthog.identify('<?= (int)Auth::id() ?>', {
            email: '<?= e(Auth::user()['email'] ?? '') ?>',
            credits: <?= (int) ($_creditBalance ?? 0) ?>,
            name: '<?= e(Auth::user()['full_name'] ?? '') ?>'
        });
        <?php endif; ?>

        // Expose posthog.capture() for use in logEvent() in editor.js / app.js
        window._phCapture = function(eventName, props) {
            if (window.posthog && typeof window.posthog.capture === 'function') {
                window.posthog.capture(eventName, props || {});
            }
        };

        // JS error capture directly via PostHog (catches errors on any page, before behavior-tracker loads)
        window.addEventListener('error', function(ev) {
            window._phCapture('js_error', {
                message: String(ev.message || '').slice(0, 255),
                source:  String(ev.filename || '').slice(0, 255),
                line:    ev.lineno || 0,
                col:     ev.colno || 0,
                path:    window.location.pathname
            });
        });
        window.addEventListener('unhandledrejection', function(ev) {
            window._phCapture('js_unhandled_rejection', {
                message: String((ev.reason && ev.reason.message) || ev.reason || '').slice(0, 255),
                path:    window.location.pathname
            });
        });
    </script>
    <?php endif; ?>
    <script>
        window.cvTrackEvent = function(eventKey, metadata, options) {
            metadata = metadata || {};
            options = options || {};

            var props = Object.assign({
                source: metadata.source || 'frontend',
                page: metadata.page || window.location.pathname
            }, metadata);

            if (window._phCapture) {
                window._phCapture(eventKey, props);
            }

            <?php if (Auth::check()): ?>
            var payload = JSON.stringify({ event_key: eventKey, metadata: props });
            if (options.beacon && navigator.sendBeacon) {
                var blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon('<?= APP_URL ?>/api/events/log', blob);
                return;
            }

            fetch('<?= APP_URL ?>/api/events/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: !!options.keepalive
            }).catch(function() {});
            <?php endif; ?>
        };
    </script>
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
                            <i class="bi bi-magic me-1"></i>Import CV / Publications
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/archive">
                            <i class="bi bi-archive me-1"></i>Archive
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
                    <?php if (isset($profile['id']) && str_starts_with((string)($pageTitle ?? ''), 'Edit CV')): ?>
                    <li class="nav-item me-2">
                        <button type="button" class="btn btn-success btn-sm my-1" id="header-btn-compile" data-cv-id="<?= (int) $profile['id'] ?>">
                            <i class="bi bi-filetype-pdf me-1"></i>Compile PDF
                        </button>
                    </li>
                    <?php endif; ?>
                    <li class="nav-item me-2">
                        <a class="btn btn-outline-light btn-sm my-1 d-inline-flex align-items-center" href="<?= APP_URL ?>/plans" title="Available credits">
                            <i class="bi bi-lightning-charge me-1"></i>
                            <span id="credits-amount-header"><?= $_creditBalance !== null ? (int) $_creditBalance : '—' ?></span>
                        </a>
                    </li>
                    <?php if ($_waShowButton && !empty($_waPhone)): ?>
                    <li class="nav-item me-1">
                        <button class="btn btn-success btn-sm my-1" onclick="toggleWaPopup()" title="Get free WhatsApp support">
                            <i class="bi bi-whatsapp me-1"></i>Free Support
                        </button>
                    </li>
                    <?php endif; ?>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
                            <?php if (!empty(Auth::user()['avatar_url'])): ?>
                                <img src="<?= e(Auth::user()['avatar_url']) ?>" alt="" class="rounded-circle me-1" width="24" height="24" referrerpolicy="no-referrer">
                            <?php else: ?>
                                <i class="bi bi-person-circle me-1"></i>
                            <?php endif; ?>
                            <?= e(Auth::user()['full_name'] ?: Auth::user()['username']) ?>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item d-flex align-items-center justify-content-between" href="<?= APP_URL ?>/plans">
                                <span><i class="bi bi-lightning-charge me-2"></i>Credits</span>
                                <span class="badge bg-primary rounded-pill px-2 py-1 fs-6" id="credits-badge" title="Available credits"><span id="credits-amount"><?= $_creditBalance !== null ? (int) $_creditBalance : '—' ?></span></span>
                            </a></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/plans">
                                <i class="bi bi-bag-plus me-2"></i>Buy Credits
                            </a></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/settings">
                                <i class="bi bi-gear me-2"></i>Settings
                            </a></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/support">
                                <i class="bi bi-life-preserver me-2"></i>Support
                                <span class="badge bg-danger rounded-pill position-absolute end-0 me-2 d-none" id="support-badge" style="font-size:0.6rem;padding:3px 5px;"></span>
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

    <!-- Global Confirmation & Alert Modal (z-index above all other modals) -->
    <style>#csModal{z-index:1090!important}.cs-modal-backdrop{z-index:1085!important}</style>
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
        var csModalEl = document.getElementById('csModal');
        function getModal() {
            if (!modal) modal = new bootstrap.Modal(csModalEl);
            return modal;
        }

        // Ensure csModal backdrop is always above other modals
        csModalEl.addEventListener('shown.bs.modal', function() {
            var backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > 1) {
                backdrops[backdrops.length - 1].classList.add('cs-modal-backdrop');
            }
        });

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
            var cancelBtn = document.getElementById('csModalCancel');
            cancelBtn.style.display = '';
            cancelBtn.textContent = options.cancelText || 'Cancel';
            cancelBtn.onclick = typeof options.onCancel === 'function' ? function() { options.onCancel(); } : null;

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
            var cancelBtn = document.getElementById('csModalCancel');
            cancelBtn.style.display = 'none';
            cancelBtn.onclick = null;

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
            var submitter = e.submitter || document.activeElement;
            var confirmSource = form.dataset.confirm ? form : (submitter && submitter.dataset && submitter.dataset.confirm ? submitter : null);
            if (!confirmSource) return;
            if (form.dataset.confirmed === 'true') { form.dataset.confirmed = ''; return; }
            e.preventDefault();
            csConfirm(confirmSource.dataset.confirm, function() {
                if (submitter && submitter.getAttribute && submitter.getAttribute('formaction')) {
                    form.action = submitter.formAction;
                }
                form.dataset.confirmed = 'true';
                form.submit();
            }, {
                type: confirmSource.dataset.confirmType || 'danger',
                title: confirmSource.dataset.confirmTitle || 'Are you sure?',
                confirmText: confirmSource.dataset.confirmBtn || 'Yes, proceed'
            });
        });
    })();
    </script>

    <!-- Custom JS -->
    <script src="<?= APP_URL ?>/assets/js/app.js"></script>

    <?php if (Auth::check() && $_behaviorTrackingEnabled): ?>
    <script>
    window.CVBehaviorConfig = {
        enabled: true,
        endpoint: '<?= APP_URL ?>/api/behavior/track',
        csrfToken: '<?= e(Auth::generateToken()) ?>',
        maskInputs: <?= $_behaviorMaskInputs ? 'true' : 'false' ?>,
        samplingRate: <?= (int) $_behaviorSamplingRate ?>,
        retentionDays: <?= (int) $_behaviorRetentionDays ?>
    };
    </script>
    <script src="<?= APP_URL ?>/assets/js/behavior-tracker.js"></script>
    <?php endif; ?>

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

    <?php if (Auth::check()): ?>
    <!-- New Ticket Modal -->
    <div class="modal fade" id="newTicketModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header border-0 pb-0">
                    <h5 class="modal-title fw-bold"><i class="bi bi-plus-circle me-2"></i>New Support Request</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" id="ticket-modal-close"></button>
                </div>
                <div class="modal-body">
                    <div id="ticket-submit-status" aria-live="polite"></div>
                    <div id="ticket-form-fields">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Type <span class="text-danger">*</span></label>
                            <select class="form-select" id="ticket-type">
                                <option value="">Select type...</option>
                                <option value="support">Support Ticket</option>
                                <option value="bug">Bug Report</option>
                                <option value="feature">Feature Request</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Subject <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="ticket-subject" maxlength="255" placeholder="Brief description of your issue">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Message <span class="text-danger">*</span></label>
                            <textarea class="form-control" id="ticket-message" rows="5" placeholder="Describe your issue, request, or suggestion in detail..."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Screenshot <span class="text-muted fw-normal">(optional)</span></label>
                            <input type="file" class="form-control form-control-sm" id="ticket-attachment" accept="image/jpeg,image/png,image/gif,image/webp">
                            <div class="form-text">JPG, PNG, GIF, or WebP — max 5 MB</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0 pt-0">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="ticket-cancel-btn">Cancel</button>
                    <button type="button" class="btn btn-primary" id="ticket-submit-btn" onclick="submitTicket()">
                        <i class="bi bi-send me-1"></i>Submit
                    </button>
                    <a href="#" class="btn btn-primary d-none" id="ticket-view-btn">
                        <i class="bi bi-chat-square-text me-1"></i>View Ticket
                    </a>
                </div>
            </div>
        </div>
    </div>
    <script>
    // Support ticket submission
    var ticketSubmitting = false;
    var ticketSubmitted = false;
    var refreshTicketsAfterClose = false;
    var ticketFormStarted = false;
    var ticketCompletedFields = {};
    var ticketModalEl = document.getElementById('newTicketModal');
    var ticketSubmitDefaultHtml = document.getElementById('ticket-submit-btn').innerHTML;

    function ticketTrack(eventKey, metadata, options) {
        window.cvTrackEvent && window.cvTrackEvent(eventKey, Object.assign({
            page: '/support',
            ui_surface: 'support_ticket_modal'
        }, metadata || {}), options || {});
    }

    function currentTicketType() {
        return document.getElementById('ticket-type').value || '';
    }

    function startTicketForm() {
        if (ticketFormStarted) return;
        ticketFormStarted = true;
        ticketTrack('support_form_started', { form_type: 'support_ticket' });
    }

    function markTicketFieldComplete(fieldName) {
        if (ticketCompletedFields[fieldName]) return;
        ticketCompletedFields[fieldName] = true;
        ticketTrack('support_form_field_completed', {
            form_type: 'support_ticket',
            field_name: fieldName
        });
    }

    function setTicketStatus(type, message) {
        document.getElementById('ticket-submit-status').innerHTML = '<div class="alert alert-' + type + ' py-2 small" role="status">' + escapeTicketHtml(message) + '</div>';
    }

    function escapeTicketHtml(value) {
        var div = document.createElement('div');
        div.textContent = value || '';
        return div.innerHTML;
    }

    function parseTicketResponse(response) {
        return response.text().then(function(text) {
            var data = {};
            if (text) {
                try { data = JSON.parse(text); }
                catch (e) { data = { error: 'Unexpected server response. Please try again.' }; }
            }
            if (!response.ok) {
                throw new Error(data.error || 'Ticket submission failed. Please try again.');
            }
            return data;
        });
    }

    function resetTicketModal() {
        if (ticketSubmitting) return;
        ticketSubmitted = false;
        ticketFormStarted = false;
        ticketCompletedFields = {};
        document.getElementById('ticket-form-fields').classList.remove('d-none');
        document.getElementById('ticket-submit-status').innerHTML = '';
        document.getElementById('ticket-type').value = '';
        document.getElementById('ticket-subject').value = '';
        document.getElementById('ticket-message').value = '';
        document.getElementById('ticket-attachment').value = '';
        document.getElementById('ticket-submit-btn').classList.remove('d-none');
        document.getElementById('ticket-submit-btn').disabled = false;
        document.getElementById('ticket-submit-btn').innerHTML = ticketSubmitDefaultHtml;
        document.getElementById('ticket-cancel-btn').disabled = false;
        document.getElementById('ticket-cancel-btn').textContent = 'Cancel';
        document.getElementById('ticket-modal-close').disabled = false;
        document.getElementById('ticket-view-btn').classList.add('d-none');
        document.getElementById('ticket-view-btn').href = '#';
    }

    ticketModalEl.addEventListener('show.bs.modal', function() {
        if (!ticketSubmitted) resetTicketModal();
        ticketTrack('support_modal_opened', { form_type: 'support_ticket' });
    });

    ticketModalEl.addEventListener('hidden.bs.modal', function() {
        ticketSubmitting = false;
        if (ticketFormStarted && !ticketSubmitted && !refreshTicketsAfterClose) {
            ticketTrack('support_form_abandoned', {
                form_type: 'support_ticket',
                ticket_type: currentTicketType()
            });
        }
        if (refreshTicketsAfterClose) {
            refreshTicketsAfterClose = false;
            window.location.href = '<?= APP_URL ?>/support';
            return;
        }
        resetTicketModal();
    });

    window.submitTicket = function() {
        if (ticketSubmitting || ticketSubmitted) return;

        var type = document.getElementById('ticket-type').value;
        var subject = document.getElementById('ticket-subject').value.trim();
        var message = document.getElementById('ticket-message').value.trim();
        var btn = document.getElementById('ticket-submit-btn');
        var fileInput = document.getElementById('ticket-attachment');

        ticketTrack('support_ticket_submit_clicked', {
            ticket_type: type,
            subject_length: subject.length,
            message_length: message.length
        });

        if (!type) { ticketTrack('support_ticket_failed', { error_code: 'missing_type', error_message: 'Please select a ticket type.' }); csAlert('Please select a ticket type.', {type:'warning',title:'Missing Type'}); return; }
        if (subject.length < 5) { ticketTrack('support_ticket_failed', { ticket_type: type, error_code: 'subject_too_short', error_message: 'Subject must be at least 5 characters.' }); csAlert('Subject must be at least 5 characters.', {type:'warning',title:'Too Short'}); return; }
        if (message.length < 10) { ticketTrack('support_ticket_failed', { ticket_type: type, error_code: 'message_too_short', error_message: 'Message must be at least 10 characters.' }); csAlert('Message must be at least 10 characters.', {type:'warning',title:'Too Short'}); return; }

        // Validate file size client-side
        if (fileInput.files.length > 0 && fileInput.files[0].size > 5 * 1024 * 1024) {
            ticketTrack('support_ticket_failed', { ticket_type: type, error_code: 'file_too_large', error_message: 'Image must be under 5 MB.' });
            csAlert('Image must be under 5 MB.', {type:'warning',title:'File Too Large'}); return;
        }

        ticketSubmitting = true;
        document.getElementById('ticket-submit-status').innerHTML = '';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Sending...';
        document.getElementById('ticket-cancel-btn').disabled = true;
        document.getElementById('ticket-modal-close').disabled = true;

        var formData = new FormData();
        formData.append('<?= CSRF_TOKEN_NAME ?>', '<?= e(Auth::generateToken()) ?>');
        formData.append('type', type);
        formData.append('subject', subject);
        formData.append('message', message);
        if (fileInput.files.length > 0) {
            formData.append('attachment', fileInput.files[0]);
        }

        fetch('<?= APP_URL ?>/support/store', {
            method: 'POST',
            body: formData
        })
        .then(parseTicketResponse)
        .then(function(data) {
            if (data.error) {
                throw new Error(data.error);
            } else {
                ticketSubmitting = false;
                ticketSubmitted = true;
                refreshTicketsAfterClose = true;
                btn.classList.add('d-none');
                document.getElementById('ticket-form-fields').classList.add('d-none');
                document.getElementById('ticket-cancel-btn').disabled = false;
                document.getElementById('ticket-cancel-btn').textContent = 'Close';
                document.getElementById('ticket-modal-close').disabled = false;
                var ticketNumber = data.ticket_number ? ' Ticket ' + data.ticket_number + ' has been created.' : '';
                setTicketStatus('success', (data.message || 'Your support request has been received.') + ticketNumber);
                var viewBtn = document.getElementById('ticket-view-btn');
                viewBtn.href = data.view_url || ('<?= APP_URL ?>/support/view?id=' + data.ticket_id);
                viewBtn.classList.remove('d-none');
                ticketTrack('support_ticket_succeeded', {
                    ticket_id: data.ticket_id,
                    ticket_type: type
                });
                ticketTrack('support_confirmation_viewed', {
                    ticket_id: data.ticket_id
                });
            }
        })
        .catch(function(error) {
            ticketSubmitting = false;
            btn.disabled = false;
            btn.innerHTML = ticketSubmitDefaultHtml;
            document.getElementById('ticket-cancel-btn').disabled = false;
            document.getElementById('ticket-modal-close').disabled = false;
            setTicketStatus('danger', error.message || 'Failed to submit ticket. Please try again.');
            ticketTrack('support_ticket_failed', {
                ticket_type: type,
                error_code: 'submit_failed',
                error_message: error.message || 'Failed to submit ticket. Please try again.'
            });
        });
    };

    document.getElementById('ticket-type').addEventListener('focus', startTicketForm);
    document.getElementById('ticket-type').addEventListener('change', function() {
        startTicketForm();
        if (this.value) markTicketFieldComplete('ticket_type');
    });
    document.getElementById('ticket-subject').addEventListener('focus', startTicketForm);
    document.getElementById('ticket-message').addEventListener('focus', startTicketForm);
    document.getElementById('ticket-subject').addEventListener('blur', function() {
        if (this.value.trim().length >= 5) markTicketFieldComplete('subject');
    });
    document.getElementById('ticket-message').addEventListener('blur', function() {
        if (this.value.trim().length >= 10) markTicketFieldComplete('message');
    });
    document.getElementById('ticket-attachment').addEventListener('change', function() {
        startTicketForm();
        if (this.files.length > 0) {
            var file = this.files[0];
            var size = file.size > 1024 * 1024 ? '1mb_plus' : 'under_1mb';
            ticketTrack('support_attachment_added', {
                file_type: (file.type || '').split('/')[0] || 'unknown',
                file_size_bucket: size
            });
        }
    });

    // Poll for unread support notifications
    (function() {
        function checkUnread() {
            fetch('<?= APP_URL ?>/api/support/unread')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var badge = document.getElementById('support-badge');
                    if (badge) {
                        if (data.count > 0) {
                            badge.textContent = data.count;
                            badge.classList.remove('d-none');
                        } else {
                            badge.classList.add('d-none');
                        }
                    }
                })
                .catch(function() {});
        }
        checkUnread();
        setInterval(checkUnread, 60000); // Check every 60 seconds
    })();
    </script>
    <?php endif; ?>
    <?php if (!empty($extraScripts)) echo $extraScripts; ?>

    <?php if ($_waShowButton && !empty($_waPhone)): ?>
    <!-- WhatsApp Floating Support Button -->
    <style>
    #waFloatBtn{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#25d366;color:#fff;border:none;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer;font-size:1.5rem;display:flex;align-items:center;justify-content:center;transition:transform .15s}
    #waFloatBtn:hover{transform:scale(1.08)}
    #waPopup{position:fixed;bottom:92px;right:24px;z-index:9998;width:280px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:none}
    #waPopup.open{display:block}
    .wa-popup-header{background:#128c7e;color:#fff;padding:12px 16px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:10px}
    .wa-popup-header .wa-avatar{width:40px;height:40px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .wa-q-list a{display:block;padding:9px 16px;border-bottom:1px solid #f1f3f5;text-decoration:none;color:#1a1a2e;font-size:.875rem;transition:background .1s}
    .wa-q-list a:last-child{border-bottom:none;border-radius:0 0 12px 12px}
    .wa-q-list a:hover{background:#f0fdf4;color:#128c7e}
    </style>

    <button id="waFloatBtn" onclick="toggleWaPopup()" aria-label="WhatsApp Support">
        <i class="bi bi-whatsapp"></i>
    </button>

    <div id="waPopup" role="dialog" aria-label="WhatsApp Support Chat">
        <div class="wa-popup-header">
            <div class="wa-avatar"><i class="bi bi-person-fill fs-5"></i></div>
            <div>
                <div class="fw-semibold"><?= e($_waAgent) ?></div>
                <div style="font-size:.75rem;opacity:.85"><span style="color:#a7f3d0">●</span> Free Support</div>
            </div>
            <button onclick="toggleWaPopup()" class="ms-auto btn btn-sm p-0" style="color:#fff;background:none;border:none;font-size:1.1rem" aria-label="Close">×</button>
        </div>
        <div class="wa-q-list">
            <?php if (empty($_waQuestions)): ?>
            <a href="https://wa.me/<?= e($_waPhone) ?>" target="_blank" rel="noopener noreferrer">
                <i class="bi bi-chat-dots me-2 text-success"></i>Start a conversation
            </a>
            <?php else: ?>
            <?php foreach ($_waQuestions as $_q): ?>
            <?php $_qEncoded = rawurlencode($_q); ?>
            <a href="https://wa.me/<?= e($_waPhone) ?>?text=<?= e($_qEncoded) ?>" target="_blank" rel="noopener noreferrer">
                <i class="bi bi-chat-text me-2 text-success"></i><?= e($_q) ?>
            </a>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>

    <script>
    function toggleWaPopup() {
        var popup = document.getElementById('waPopup');
        if (popup) popup.classList.toggle('open');
    }
    document.addEventListener('click', function(e) {
        var popup = document.getElementById('waPopup');
        var btn = document.getElementById('waFloatBtn');
        if (popup && popup.classList.contains('open')) {
            var navBtn = document.querySelector('.btn-success[onclick="toggleWaPopup()"]');
            if (!popup.contains(e.target) && e.target !== btn && !btn.contains(e.target) && !(navBtn && navBtn.contains(e.target))) {
                popup.classList.remove('open');
            }
        }
    });
    </script>
    <?php endif; ?>
</body>
</html>
