<?php
$pageTitle = 'Templates';
$totalTemplates = count($templates);
$lockedTemplates = count(array_filter($templates, fn($t) => !empty($t['is_premium']) && ($userPlan ?? 'free') === 'free'));
$freeTemplates = $totalTemplates - $lockedTemplates;
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1">Template Gallery</h2>
            <p class="text-muted mb-0">Choose a template to start building your CV.</p>
        </div>
    </div>

    <div class="row g-4">
        <?php foreach ($templates as $template): ?>
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm template-gallery-card"
                 data-template-id="<?= (int) $template['id'] ?>"
                 data-template-name="<?= e($template['name']) ?>"
                 data-template-required-plan="<?= $template['is_premium'] ? 'pro' : 'free' ?>"
                 data-user-plan="<?= e($userPlan) ?>"
                 data-locked="<?= ($template['is_premium'] && $userPlan === 'free') ? '1' : '0' ?>">
                <div class="card-body text-center py-4">
                    <div class="mb-3">
                        <i class="bi bi-file-text display-3 text-primary"></i>
                    </div>
                    <h5 class="fw-bold"><?= e($template['name']) ?></h5>
                    <p class="text-muted"><?= e($template['description']) ?></p>
                    <?php if ($template['is_premium']): ?>
                        <span class="badge bg-warning mb-2">Pro</span>
                    <?php else: ?>
                        <span class="badge bg-success mb-2">Free</span>
                    <?php endif; ?>
                </div>
                <div class="card-footer bg-transparent text-center py-3">
                    <div class="d-flex gap-2 mb-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm flex-fill template-preview-btn" onclick="openDemoPreview(<?= (int) $template['id'] ?>, this.dataset.templateName)" data-template-name="<?= e($template['name']) ?>">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Preview Design
                        </button>
                        <a href="<?= APP_URL ?>/templates/preview/<?= $template['id'] ?>" class="btn btn-outline-primary btn-sm flex-fill template-sections-link">
                            <i class="bi bi-layout-text-sidebar me-1"></i>View Sections
                        </a>
                    </div>
                    <?php if ($template['is_premium'] && $userPlan === 'free'): ?>
                        <a href="<?= APP_URL ?>/plans" class="btn btn-warning btn-sm w-100 template-upgrade-link">
                            <i class="bi bi-star-fill me-1"></i>Upgrade to Pro
                        </a>
                    <?php else: ?>
                        <a href="<?= APP_URL ?>/cv/create?template=<?= $template['id'] ?>" class="btn btn-primary btn-sm w-100 template-use-link">
                            <i class="bi bi-plus-lg me-1"></i>Use Template
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<!-- Demo PDF Preview Modal -->
<div class="modal fade" id="demoPreviewModal" tabindex="-1" aria-labelledby="demoPreviewModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered" style="max-width: 900px;">
        <div class="modal-content" style="height: 85vh;">
            <div class="modal-header py-2">
                <h6 class="modal-title" id="demoPreviewModalLabel">Template Preview</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 d-flex align-items-center justify-content-center" style="flex: 1; min-height: 0;">
                <div id="demoLoadingSpinner" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2 mb-0">Generating preview...</p>
                </div>
                <iframe id="demoPreviewFrame" style="width: 100%; height: 100%; border: none; display: none;"></iframe>
            </div>
        </div>
    </div>
</div>

<script>
let demoBlobUrl = null;
let demoPreviewStartedAt = 0;
let demoPreviewMeta = null;

window.cvTrackEvent && window.cvTrackEvent('template_gallery_viewed', {
    total_templates: <?= (int) $totalTemplates ?>,
    free_templates: <?= (int) $freeTemplates ?>,
    locked_templates: <?= (int) $lockedTemplates ?>,
    user_plan: '<?= e($userPlan) ?>',
    page: '/templates'
});

function templateCardMeta(el) {
    const card = el ? el.closest('.template-gallery-card') : null;
    return {
        template_id: parseInt(card && card.dataset.templateId || 0, 10),
        template_name: card && card.dataset.templateName || '',
        template_required_plan: card && card.dataset.templateRequiredPlan || 'free',
        user_plan: '<?= e($userPlan) ?>',
        page: '/templates'
    };
}

function trackPostPaymentPaywall(meta) {
    try {
        const paidAt = parseInt(sessionStorage.getItem('cvscholarPaymentCompletedAt') || '0', 10);
        if (!paidAt || Date.now() - paidAt > 15 * 60 * 1000) return;
        window.cvTrackEvent && window.cvTrackEvent('paywall_shown_post_payment', Object.assign({}, meta, {
            payment_completed_at: paidAt,
            time_since_payment_ms: Date.now() - paidAt
        }));
    } catch (e) {}
}

document.querySelectorAll('.template-gallery-card').forEach(function(card) {
    if (card.dataset.locked === '1') {
        window.cvTrackEvent && window.cvTrackEvent('template_locked_badge_shown', Object.assign(templateCardMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
        window.cvTrackEvent && window.cvTrackEvent('paywall_shown', Object.assign(templateCardMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
        trackPostPaymentPaywall(Object.assign(templateCardMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
    }

    card.addEventListener('click', function() {
        window.cvTrackEvent && window.cvTrackEvent('template_card_clicked', templateCardMeta(card));
    });
});

document.querySelectorAll('.template-sections-link').forEach(function(link) {
    link.addEventListener('click', function() {
        window.cvTrackEvent && window.cvTrackEvent('template_sections_clicked', templateCardMeta(this), { keepalive: true });
    });
});

document.querySelectorAll('.template-use-link').forEach(function(link) {
    link.addEventListener('click', function() {
        window.cvTrackEvent && window.cvTrackEvent('template_selected', templateCardMeta(this), { keepalive: true });
    });
});

document.querySelectorAll('.template-upgrade-link').forEach(function(link) {
    link.addEventListener('click', function() {
        const meta = templateCardMeta(this);
        window.cvTrackEvent && window.cvTrackEvent('upgrade_cta_clicked', Object.assign(meta, {
            feature_attempted: 'template_select',
            required_plan: meta.template_required_plan
        }), { keepalive: true });
    });
});

function openDemoPreview(templateId, templateName) {
    const modal = new bootstrap.Modal(document.getElementById('demoPreviewModal'));
    document.getElementById('demoPreviewModalLabel').textContent = templateName + ' — Sample CV Preview';
    const frame = document.getElementById('demoPreviewFrame');
    const spinner = document.getElementById('demoLoadingSpinner');

    frame.style.display = 'none';
    spinner.style.display = 'block';
    frame.src = 'about:blank';
    if (demoBlobUrl) { URL.revokeObjectURL(demoBlobUrl); demoBlobUrl = null; }

    modal.show();
    demoPreviewStartedAt = Date.now();
    demoPreviewMeta = templateCardMeta(document.querySelector('.template-gallery-card[data-template-id="' + templateId + '"]'));
    window.cvTrackEvent && window.cvTrackEvent('template_preview_opened', demoPreviewMeta);

    fetch('<?= APP_URL ?>/templates/demo/' + templateId)
        .then(r => {
            if (!r.ok) throw new Error('preview_request_failed');
            return r.json();
        })
        .then(data => {
            if (!data.pdf_base64) throw new Error('missing_pdf_data');
            var binary = atob(data.pdf_base64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var blob = new Blob([bytes], { type: 'application/pdf' });
            demoBlobUrl = URL.createObjectURL(blob);
            frame.src = demoBlobUrl + '#toolbar=0&navpanes=0';
            frame.onload = function() {
                spinner.style.display = 'none';
                frame.style.display = 'block';
                window.cvTrackEvent && window.cvTrackEvent('template_preview_loaded', Object.assign({}, demoPreviewMeta || {}, { loaded: true }));
            };
        })
        .catch((error) => {
            spinner.innerHTML = '<p class="text-danger">Failed to load preview.</p>';
            window.cvTrackEvent && window.cvTrackEvent('template_preview_failed', Object.assign({}, demoPreviewMeta || {}, {
                error_message: error.message || 'preview_failed'
            }));
        });
}

document.getElementById('demoPreviewModal').addEventListener('hidden.bs.modal', function() {
    const frame = document.getElementById('demoPreviewFrame');
    if (demoPreviewMeta && demoPreviewStartedAt) {
        window.cvTrackEvent && window.cvTrackEvent('template_preview_closed', Object.assign({}, demoPreviewMeta, {
            time_spent_ms: Date.now() - demoPreviewStartedAt
        }));
    }
    frame.src = 'about:blank';
    if (demoBlobUrl) { URL.revokeObjectURL(demoBlobUrl); demoBlobUrl = null; }
    demoPreviewStartedAt = 0;
    demoPreviewMeta = null;
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
