<?php
$pageTitle = 'Admin — Email Management';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-envelope-fill me-2"></i>Email Management</h2>
            <p class="text-muted mb-0">Test email templates and send campaign emails to user groups</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin" class="btn btn-outline-primary"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            <a href="<?= APP_URL ?>/admin/crons" class="btn btn-outline-primary"><i class="bi bi-clock me-1"></i>Crons</a>
            <a href="<?= APP_URL ?>/admin/whatsapp" class="btn btn-outline-primary"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>
            <a href="<?= APP_URL ?>/admin/settings" class="btn btn-outline-primary"><i class="bi bi-gear me-1"></i>Settings</a>
        </div>
    </div>

    <?php if (!empty($flash)): ?>
    <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?> alert-dismissible fade show" role="alert">
        <?= e($flash['message']) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
    <?php endif; ?>

    <!-- Email Templates Table -->
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white border-bottom-0 py-3">
            <h5 class="fw-semibold mb-0"><i class="bi bi-file-earmark-code me-2"></i>Email Templates</h5>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Template Key</th>
                            <th>File</th>
                            <th>Last Modified</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($emailTemplates as $tpl): ?>
                        <tr>
                            <td><code><?= e($tpl['key']) ?></code></td>
                            <td class="text-muted small"><?= e($tpl['file']) ?></td>
                            <td class="text-muted small"><?= e($tpl['modified']) ?></td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-primary" onclick="openTestModal('<?= e($tpl['key']) ?>')">
                                    <i class="bi bi-send me-1"></i>Send Test
                                </button>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Campaign Email Section -->
    <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom-0 py-3">
            <h5 class="fw-semibold mb-0"><i class="bi bi-megaphone me-2"></i>Send Campaign Email</h5>
        </div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/admin/emails/campaign" id="campaignForm">
                <input type="hidden" name="csrf_token" value="<?= e($_SESSION['csrf_token'] ?? '') ?>">

                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label fw-semibold">Recipient Group</label>
                        <select name="group" class="form-select" required id="groupSelect">
                            <option value="all">All Users (<?= $userCounts['all'] ?>)</option>
                            <option value="free">Free Plan (<?= $userCounts['free'] ?>)</option>
                            <option value="starter">Starter Plan (<?= $userCounts['starter'] ?? 0 ?>)</option>
                            <option value="pro">Pro Plan (<?= $userCounts['pro'] ?? 0 ?>)</option>
                            <option value="enterprise">Enterprise Plan (<?= $userCounts['enterprise'] ?? 0 ?>)</option>
                            <option value="specific">Specific Email Address</option>
                        </select>
                    </div>
                    <div class="col-md-8" id="specificEmailWrap" style="display:none">
                        <label class="form-label fw-semibold">Email Address</label>
                        <input type="email" name="specific_email" class="form-control" placeholder="user@example.com">
                    </div>
                </div>

                <div class="mt-3">
                    <label class="form-label fw-semibold">Subject</label>
                    <input type="text" name="subject" class="form-control" required placeholder="Email subject line">
                </div>

                <div class="mt-3">
                    <label class="form-label fw-semibold">Message Body</label>
                    <small class="text-muted ms-2">Supports <code>{{name}}</code> and <code>{{email}}</code> placeholders</small>
                    <textarea name="body" class="form-control mt-1" rows="8" required placeholder="Hi {{name}},&#10;&#10;Your message here..."></textarea>
                </div>

                <div class="mt-3 d-flex gap-2 align-items-center">
                    <button type="submit" class="btn btn-primary" onclick="return confirmCampaign()">
                        <i class="bi bi-send me-1"></i>Send Campaign
                    </button>
                    <span id="campaignStatus" class="text-muted small"></span>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Test Email Modal -->
<div class="modal fade" id="testEmailModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-send me-2"></i>Send Test Email</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label fw-semibold">Template</label>
                    <input type="text" id="testTemplateKey" class="form-control" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-semibold">Send To</label>
                    <input type="email" id="testEmailAddress" class="form-control" placeholder="your@email.com">
                </div>
                <div id="testEmailResult" class="mt-2"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="sendTestEmail()">
                    <i class="bi bi-send me-1"></i>Send Test
                </button>
            </div>
        </div>
    </div>
</div>

<script>
function openTestModal(templateKey) {
    document.getElementById('testTemplateKey').value = templateKey;
    document.getElementById('testEmailAddress').value = '';
    document.getElementById('testEmailResult').innerHTML = '';
    new bootstrap.Modal(document.getElementById('testEmailModal')).show();
}

function sendTestEmail() {
    const key   = document.getElementById('testTemplateKey').value;
    const email = document.getElementById('testEmailAddress').value.trim();
    const result = document.getElementById('testEmailResult');
    if (!email) { result.innerHTML = '<div class="alert alert-warning py-2">Please enter an email address.</div>'; return; }
    result.innerHTML = '<div class="text-muted">Sending…</div>';
    fetch('<?= APP_URL ?>/admin/emails/test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': '<?= e($_SESSION['csrf_token'] ?? '') ?>'},
        body: JSON.stringify({template: key, email: email, csrf_token: '<?= e($_SESSION['csrf_token'] ?? '') ?>'}),
    })
    .then(r => r.json())
    .then(data => {
        result.innerHTML = data.success
            ? '<div class="alert alert-success py-2">Test email sent successfully!</div>'
            : '<div class="alert alert-danger py-2">' + (data.error || 'Failed to send.') + '</div>';
    })
    .catch(() => { result.innerHTML = '<div class="alert alert-danger py-2">Request failed.</div>'; });
}

document.getElementById('groupSelect').addEventListener('change', function() {
    document.getElementById('specificEmailWrap').style.display = this.value === 'specific' ? '' : 'none';
});

function confirmCampaign() {
    const group = document.getElementById('groupSelect').value;
    const label = document.getElementById('groupSelect').selectedOptions[0].text;
    return confirm('Send campaign email to: ' + label + '?\n\nThis cannot be undone.');
}
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
