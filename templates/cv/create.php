<?php
$pageTitle = 'Create CV';
ob_start();
?>
<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <h2 class="fw-bold mb-4">Create New CV</h2>

            <form method="POST" action="<?= APP_URL ?>/cv/store" id="cvCreateForm">
                <?= Auth::csrfField() ?>
                <input type="hidden" name="time_to_complete_ms" id="cvCreateTimeToComplete" value="">

                <div class="mb-4">
                    <label for="name" class="form-label fw-semibold">CV Name</label>
                    <input type="text" class="form-control" id="name" name="name" 
                           required placeholder="e.g., Academic CV 2026, Job Application CV"
                           value="My Academic CV">
                    <div class="form-text">Give your CV a name to identify it later.</div>
                </div>

                <div class="mb-4">
                    <label class="form-label fw-semibold">Choose Template</label>
                    <?php $userPlan = $user['subscription_plan'] ?? 'free'; ?>
                    <div class="row g-3">
                        <?php foreach ($templates as $index => $template): ?>
                        <?php $isLocked = $template['is_premium'] && $userPlan === 'free'; ?>
                        <div class="col-md-4">
                                                        <div class="card template-select-card h-100 <?= $index === 0 ? 'border-primary' : '' ?> <?= $isLocked ? 'opacity-75' : '' ?> position-relative"
                                                                 data-template-id="<?= (int) $template['id'] ?>"
                                                                 data-template-name="<?= e($template['name']) ?>"
                                                                 data-template-required-plan="<?= $template['is_premium'] ? 'pro' : 'free' ?>"
                                                                 data-user-plan="<?= e($userPlan) ?>"
                                                                 data-locked="<?= $isLocked ? '1' : '0' ?>">
                                <?php if ($isLocked): ?>
                                <div class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center rounded"
                                     style="background:rgba(255,255,255,0.85);z-index:2;pointer-events:none">
                                    <i class="bi bi-lock-fill text-warning fs-3"></i>
                                    <span class="badge bg-warning text-dark mt-1">Pro Plan Required</span>
                                </div>
                                <?php endif; ?>
                                <div class="card-body text-center">
                                    <input type="radio" name="template_id" value="<?= $template['id'] ?>"
                                           id="template_<?= $template['id'] ?>"
                                           class="btn-check template-radio"
                                           data-locked="<?= $isLocked ? '1' : '0' ?>"
                                           data-template-id="<?= (int) $template['id'] ?>"
                                           data-template-name="<?= e($template['name']) ?>"
                                           data-template-required-plan="<?= $template['is_premium'] ? 'pro' : 'free' ?>"
                                           <?= $index === 0 && !$isLocked ? 'checked' : '' ?>>
                                    <label for="template_<?= $template['id'] ?>" class="stretched-link d-block">
                                        <div class="template-preview-icon mb-3">
                                            <i class="bi bi-file-text display-4 <?= $isLocked ? 'text-secondary' : 'text-primary' ?>"></i>
                                        </div>
                                        <h6 class="fw-semibold"><?= e($template['name']) ?></h6>
                                        <p class="text-muted small mb-0"><?= e($template['description']) ?></p>
                                        <?php if ($template['is_premium']): ?>
                                            <?php if ($isLocked): ?>
                                            <a href="<?= APP_URL ?>/plans" class="btn btn-warning btn-sm mt-2 template-upgrade-link"
                                               style="position:relative;z-index:3;pointer-events:all">
                                                <i class="bi bi-arrow-up-circle me-1"></i>Upgrade
                                            </a>
                                            <?php else: ?>
                                            <span class="badge bg-warning mt-2">Premium</span>
                                            <?php endif; ?>
                                        <?php endif; ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-primary" id="createCvBtn">
                        <i class="bi bi-plus-lg me-1"></i>Create CV
                    </button>
                    <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
const cvCreateStartedAt = Date.now();
let cvCreateSubmitted = false;
let cvCreateLastStep = 'page_loaded';
const cvCreateTrackedSteps = {};

function cvCreateTemplateMeta(el) {
    const card = el ? el.closest('.template-select-card') : null;
    return {
        template_id: parseInt((el && el.dataset.templateId) || (card && card.dataset.templateId) || 0, 10),
        template_name: (el && el.dataset.templateName) || (card && card.dataset.templateName) || '',
        template_required_plan: (el && el.dataset.templateRequiredPlan) || (card && card.dataset.templateRequiredPlan) || 'free',
        user_plan: '<?= e($userPlan) ?>',
        page: '/cv/create'
    };
}

function trackCvCreateStep(stepName, stepIndex) {
    if (cvCreateTrackedSteps[stepName]) return;
    cvCreateTrackedSteps[stepName] = true;
    cvCreateLastStep = stepName;
    window.cvTrackEvent && window.cvTrackEvent('cv_creation_step_completed', {
        step_name: stepName,
        step_index: stepIndex,
        user_plan: '<?= e($userPlan) ?>',
        page: '/cv/create'
    });
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

window.cvTrackEvent && window.cvTrackEvent('cv_creation_flow_started', {
    user_plan: '<?= e($userPlan) ?>',
    session_cv_count: <?= (int) ($cvCount ?? 0) ?>,
    max_cvs: <?= (int) ($maxCvs ?? 0) ?>,
    page: '/cv/create'
});

document.querySelectorAll('.template-select-card').forEach(function(card) {
    if (card.dataset.locked === '1') {
        window.cvTrackEvent && window.cvTrackEvent('template_locked_badge_shown', Object.assign(cvCreateTemplateMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
        window.cvTrackEvent && window.cvTrackEvent('paywall_shown', Object.assign(cvCreateTemplateMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
        trackPostPaymentPaywall(Object.assign(cvCreateTemplateMeta(card), {
            feature_attempted: 'template_select',
            required_plan: card.dataset.templateRequiredPlan
        }));
    }

    card.addEventListener('click', function() {
        cvCreateLastStep = 'template_card_clicked';
        window.cvTrackEvent && window.cvTrackEvent('template_card_clicked', cvCreateTemplateMeta(card));
    });
});

document.getElementById('name').addEventListener('blur', function() {
    if (this.value.trim().length > 0) {
        trackCvCreateStep('cv_name', 1);
    }
});

document.querySelectorAll('.template-radio').forEach(function(radio) {
    radio.addEventListener('change', function() {
        cvCreateLastStep = 'template_selected_in_form';
        if (this.dataset.locked !== '1') {
            trackCvCreateStep('template_selection', 2);
        }
    });
});

document.querySelectorAll('.template-upgrade-link').forEach(function(link) {
    link.addEventListener('click', function() {
        const meta = cvCreateTemplateMeta(this);
        window.cvTrackEvent && window.cvTrackEvent('upgrade_cta_clicked', Object.assign(meta, {
            feature_attempted: 'template_select',
            required_plan: meta.template_required_plan
        }), { keepalive: true });
    });
});

document.getElementById('cvCreateForm').addEventListener('submit', function(e) {
    const checked = document.querySelector('.template-radio:checked');
    if (checked && checked.dataset.locked === '1') {
        e.preventDefault();
        const meta = cvCreateTemplateMeta(checked);
        window.cvTrackEvent && window.cvTrackEvent('paywall_shown', Object.assign(meta, {
            feature_attempted: 'template_select',
            required_plan: meta.template_required_plan
        }));
        trackPostPaymentPaywall(Object.assign(meta, {
            feature_attempted: 'template_select',
            required_plan: meta.template_required_plan
        }));
        if (confirm('This template requires the Pro plan. Go to the plans page to upgrade?')) {
            window.cvTrackEvent && window.cvTrackEvent('upgrade_cta_clicked', Object.assign(meta, {
                feature_attempted: 'template_select',
                required_plan: meta.template_required_plan
            }), { keepalive: true });
            window.location.href = '<?= APP_URL ?>/plans';
        }
        return;
    }

    if (checked) {
        cvCreateSubmitted = true;
        document.getElementById('cvCreateTimeToComplete').value = String(Date.now() - cvCreateStartedAt);
        const meta = cvCreateTemplateMeta(checked);
        window.cvTrackEvent && window.cvTrackEvent('template_selected', meta, { keepalive: true });
    }
});

window.addEventListener('pagehide', function() {
    if (cvCreateSubmitted) return;
    window.cvTrackEvent && window.cvTrackEvent('cv_creation_abandoned', {
        last_step_reached: cvCreateLastStep,
        user_plan: '<?= e($userPlan) ?>',
        time_on_page_ms: Date.now() - cvCreateStartedAt,
        page: '/cv/create'
    }, { beacon: true });
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
