<?php
$pageTitle = 'Ticket: ' . e($ticket['subject']);
$typeLabel = ['support' => 'Support Ticket', 'bug' => 'Bug Report', 'feature' => 'Feature Request'];
$typeColor = ['support' => 'primary', 'bug' => 'danger', 'feature' => 'info'];
$typeIcon = ['support' => 'bi-headset', 'bug' => 'bi-bug', 'feature' => 'bi-lightbulb'];
$statusColor = ['open' => 'warning', 'in_progress' => 'primary', 'resolved' => 'success', 'closed' => 'secondary'];
$statusLabel = ['open' => 'Open', 'in_progress' => 'In Progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
ob_start();
?>
<div class="container py-4" style="max-width:800px">
    <!-- Back + Header -->
    <a href="<?= APP_URL ?>/support" class="text-decoration-none small mb-3 d-inline-block">
        <i class="bi bi-arrow-left me-1"></i>Back to Support
    </a>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h4 class="fw-bold mb-1"><?= e($ticket['subject']) ?></h4>
                    <div class="d-flex align-items-center gap-2 text-muted small">
                        <span class="badge bg-<?= $typeColor[$ticket['type']] ?? 'secondary' ?>">
                            <i class="bi <?= $typeIcon[$ticket['type']] ?? 'bi-ticket' ?> me-1"></i><?= $typeLabel[$ticket['type']] ?? $ticket['type'] ?>
                        </span>
                        <span><?= e($ticket['ticket_number']) ?></span>
                        <span>&middot;</span>
                        <span>Opened <?= date('M j, Y \a\t g:i A', strtotime($ticket['created_at'])) ?></span>
                    </div>
                </div>
                <span class="badge bg-<?= $statusColor[$ticket['status']] ?? 'secondary' ?> fs-6"><?= $statusLabel[$ticket['status']] ?? $ticket['status'] ?></span>
            </div>
        </div>
    </div>

    <!-- Thread -->
    <div class="mb-4">
        <?php foreach ($replies as $i => $r): ?>
        <div class="d-flex mb-3 <?= $r['is_admin_reply'] ? 'flex-row-reverse' : '' ?>">
            <div class="flex-shrink-0 <?= $r['is_admin_reply'] ? 'ms-3' : 'me-3' ?>">
                <div class="rounded-circle d-flex align-items-center justify-content-center <?= $r['is_admin_reply'] ? 'bg-primary' : 'bg-secondary' ?>" style="width:36px;height:36px">
                    <i class="bi <?= $r['is_admin_reply'] ? 'bi-shield-check' : 'bi-person' ?> text-white" style="font-size:1rem"></i>
                </div>
            </div>
            <div class="flex-grow-1" style="max-width:85%">
                <div class="d-flex align-items-center gap-2 mb-1 <?= $r['is_admin_reply'] ? 'justify-content-end' : '' ?>">
                    <span class="fw-semibold small">
                        <?php if ($r['is_admin_reply']): ?>
                            <span class="text-primary">CVScholar Team</span>
                        <?php else: ?>
                            <?= e($r['full_name'] ?: $r['username']) ?>
                        <?php endif; ?>
                    </span>
                    <span class="text-muted" style="font-size:0.75rem"><?= date('M j, g:i A', strtotime($r['created_at'])) ?></span>
                </div>
                <div class="card border-0 <?= $r['is_admin_reply'] ? 'bg-primary-subtle' : 'bg-light' ?>">
                    <div class="card-body py-2 px-3">
                        <p class="mb-0" style="white-space:pre-wrap"><?= e($r['message']) ?></p>
                    </div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Reply Form -->
    <?php if ($ticket['status'] !== 'closed'): ?>
    <div class="card border-0 shadow-sm">
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/support/reply">
                <?= Auth::csrfField() ?>
                <input type="hidden" name="ticket_id" value="<?= $ticket['id'] ?>">
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Your Reply</label>
                    <textarea class="form-control" name="message" rows="4" placeholder="Type your reply..." required minlength="5"></textarea>
                </div>
                <div class="d-flex justify-content-end">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-send me-1"></i>Send Reply
                    </button>
                </div>
            </form>
        </div>
    </div>
    <?php else: ?>
    <div class="alert alert-secondary text-center">
        <i class="bi bi-lock me-1"></i>This ticket is closed. If you need further help, please open a new ticket.
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
