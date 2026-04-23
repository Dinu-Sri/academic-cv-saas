<?php
$pageTitle = 'Admin — WhatsApp Support';
ob_start();

$wa_enabled   = $settings['whatsapp_enabled'] ?? '0';
$wa_phone     = $settings['whatsapp_phone'] ?? '';
$wa_agent     = $settings['whatsapp_agent_name'] ?? 'Support';
$wa_plans_raw = $settings['whatsapp_show_for_plans'] ?? '["free","starter","pro","enterprise"]';
$wa_plans     = json_decode($wa_plans_raw, true) ?: ['free', 'starter', 'pro', 'enterprise'];
$wa_questions_raw = $settings['whatsapp_questions'] ?? '[]';
$wa_questions = json_decode($wa_questions_raw, true) ?: [];
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-whatsapp me-2 text-success"></i>WhatsApp Support Button</h2>
            <p class="text-muted mb-0">Configure the floating WhatsApp support button shown to users</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin" class="btn btn-outline-primary"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            <a href="<?= APP_URL ?>/admin/emails" class="btn btn-outline-primary"><i class="bi bi-envelope me-1"></i>Emails</a>
            <a href="<?= APP_URL ?>/admin/crons" class="btn btn-outline-primary"><i class="bi bi-clock me-1"></i>Crons</a>
            <a href="<?= APP_URL ?>/admin/settings" class="btn btn-outline-primary"><i class="bi bi-gear me-1"></i>Settings</a>
        </div>
    </div>

    <?php if (!empty($flash)): ?>
    <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?> alert-dismissible fade show">
        <?= e($flash['message']) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
    <?php endif; ?>

    <div class="row g-4">
        <div class="col-lg-8">
            <form method="POST" action="<?= APP_URL ?>/admin/whatsapp/update">
                <input type="hidden" name="csrf_token" value="<?= e($_SESSION['csrf_token'] ?? '') ?>">

                <!-- Enable / Phone / Agent -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header bg-white border-bottom-0 py-3">
                        <h5 class="fw-semibold mb-0">Basic Settings</h5>
                    </div>
                    <div class="card-body">
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" name="whatsapp_enabled" id="waEnabled"
                                   value="1" <?= $wa_enabled === '1' ? 'checked' : '' ?>>
                            <label class="form-check-label fw-semibold" for="waEnabled">Enable WhatsApp Support Button</label>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold">WhatsApp Phone Number</label>
                            <div class="input-group">
                                <span class="input-group-text">+</span>
                                <input type="text" name="whatsapp_phone" class="form-control"
                                       value="<?= e($wa_phone) ?>"
                                       placeholder="94771234567 (country code + number, no spaces)">
                            </div>
                            <div class="form-text">Include country code without the + sign. E.g. 94771234567 for Sri Lanka.</div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold">Agent Display Name</label>
                            <input type="text" name="whatsapp_agent_name" class="form-control"
                                   value="<?= e($wa_agent) ?>" placeholder="Support">
                        </div>
                    </div>
                </div>

                <!-- Plan Visibility -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header bg-white border-bottom-0 py-3">
                        <h5 class="fw-semibold mb-0">Show Button For Plans</h5>
                    </div>
                    <div class="card-body">
                        <div class="row g-2">
                            <?php foreach (['free', 'starter', 'pro', 'enterprise'] as $plan): ?>
                            <div class="col-6 col-md-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox"
                                           name="show_for_plans[]" value="<?= $plan ?>"
                                           id="plan_<?= $plan ?>"
                                           <?= in_array($plan, $wa_plans) ? 'checked' : '' ?>>
                                    <label class="form-check-label text-capitalize" for="plan_<?= $plan ?>"><?= ucfirst($plan) ?></label>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>

                <!-- Questions -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header bg-white border-bottom-0 py-3 d-flex justify-content-between align-items-center">
                        <h5 class="fw-semibold mb-0">Quick Questions</h5>
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="addQuestion()">
                            <i class="bi bi-plus-circle me-1"></i>Add Question
                        </button>
                    </div>
                    <div class="card-body">
                        <p class="text-muted small mb-3">Each question appears as a clickable link that opens WhatsApp with the message pre-filled.</p>
                        <div id="questionsContainer">
                            <?php if (empty($wa_questions)): ?>
                            <!-- Default first question added via JS -->
                            <?php else: ?>
                            <?php foreach ($wa_questions as $i => $q): ?>
                            <div class="input-group mb-2 question-row">
                                <span class="input-group-text text-muted"><?= $i + 1 ?></span>
                                <input type="text" name="questions[]" class="form-control"
                                       value="<?= e($q) ?>" placeholder="Question text">
                                <button type="button" class="btn btn-outline-danger" onclick="removeQuestion(this)">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                            <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button type="submit" class="btn btn-success">
                        <i class="bi bi-save me-1"></i>Save WhatsApp Settings
                    </button>
                </div>
            </form>
        </div>

        <!-- Preview -->
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm position-sticky" style="top:1rem">
                <div class="card-header bg-white border-bottom-0 py-3">
                    <h5 class="fw-semibold mb-0"><i class="bi bi-eye me-2"></i>Preview</h5>
                </div>
                <div class="card-body">
                    <div class="border rounded p-3 bg-light position-relative" style="min-height:200px">
                        <div style="position:absolute;bottom:16px;right:16px">
                            <div class="bg-success text-white rounded-circle shadow d-flex align-items-center justify-content-center"
                                 style="width:56px;height:56px;cursor:pointer"
                                 onclick="document.getElementById('waPreviewPopup').classList.toggle('d-none')">
                                <i class="bi bi-whatsapp fs-4"></i>
                            </div>
                            <div id="waPreviewPopup" class="d-none bg-white border rounded shadow p-3 mt-2"
                                 style="width:220px;position:absolute;bottom:64px;right:0">
                                <div class="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center"
                                         style="width:36px;height:36px;flex-shrink:0">
                                        <i class="bi bi-person-fill"></i>
                                    </div>
                                    <div>
                                        <div class="fw-semibold small" id="previewAgentName"><?= e($wa_agent) ?></div>
                                        <div class="text-muted" style="font-size:11px"><span class="text-success">●</span> Free Support</div>
                                    </div>
                                </div>
                                <div class="small text-muted mb-2">How can I help you?</div>
                                <div id="previewQuestions">
                                    <?php foreach (array_slice($wa_questions, 0, 3) as $q): ?>
                                    <a href="#" class="d-block text-decoration-none text-success small py-1 border-bottom"><?= e($q) ?></a>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                        <p class="text-muted small mb-0">The button appears in the bottom-right corner of every page for users in the selected plans.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
let questionCount = document.querySelectorAll('.question-row').length;

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    const div = document.createElement('div');
    div.className = 'input-group mb-2 question-row';
    div.innerHTML = `<span class="input-group-text text-muted">${questionCount}</span>
        <input type="text" name="questions[]" class="form-control" placeholder="Question text">
        <button type="button" class="btn btn-outline-danger" onclick="removeQuestion(this)">
            <i class="bi bi-trash"></i>
        </button>`;
    container.appendChild(div);
}

function removeQuestion(btn) {
    btn.closest('.question-row').remove();
    // Renumber
    document.querySelectorAll('.question-row').forEach((row, i) => {
        row.querySelector('.input-group-text').textContent = i + 1;
    });
    questionCount = document.querySelectorAll('.question-row').length;
}

// Auto-add one row if empty
if (questionCount === 0) addQuestion();
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
