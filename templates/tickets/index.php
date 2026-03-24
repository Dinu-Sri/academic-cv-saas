<?php
$pageTitle = 'Support';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-life-preserver me-2"></i>Support</h2>
            <p class="text-muted mb-0">Your support tickets, bug reports, and feature requests</p>
        </div>
        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newTicketModal">
            <i class="bi bi-plus-circle me-1"></i>New Request
        </button>
    </div>

    <?php if (empty($tickets)): ?>
    <!-- Empty State -->
    <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5">
            <i class="bi bi-chat-square-text text-muted" style="font-size:3rem"></i>
            <h5 class="fw-bold mt-3 mb-2">No tickets yet</h5>
            <p class="text-muted mb-3">Need help? Have a suggestion? Submit a support ticket, report a bug, or request a feature.</p>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newTicketModal">
                <i class="bi bi-plus-circle me-1"></i>Submit Your First Request
            </button>
        </div>
    </div>
    <?php else: ?>
    <!-- Tickets List -->
    <div class="card border-0 shadow-sm">
        <div class="list-group list-group-flush">
            <?php foreach ($tickets as $t): ?>
            <?php
                $typeIcon = ['support' => 'bi-headset', 'bug' => 'bi-bug', 'feature' => 'bi-lightbulb'];
                $typeColor = ['support' => 'primary', 'bug' => 'danger', 'feature' => 'info'];
                $typeLabel = ['support' => 'Support', 'bug' => 'Bug Report', 'feature' => 'Feature Request'];
                $statusColor = ['open' => 'warning', 'in_progress' => 'primary', 'resolved' => 'success', 'closed' => 'secondary'];
                $statusLabel = ['open' => 'Open', 'in_progress' => 'In Progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
            ?>
            <a href="<?= APP_URL ?>/support/view?id=<?= $t['id'] ?>" class="list-group-item list-group-item-action py-3 <?= $t['has_unread_admin_reply'] ? 'bg-primary-subtle' : '' ?>">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-start">
                        <i class="bi <?= $typeIcon[$t['type']] ?? 'bi-ticket' ?> text-<?= $typeColor[$t['type']] ?? 'secondary' ?> me-3 mt-1" style="font-size:1.3rem"></i>
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <span class="fw-semibold"><?= e($t['subject']) ?></span>
                                <?php if ($t['has_unread_admin_reply']): ?>
                                <span class="badge bg-danger rounded-pill" style="font-size:0.65rem">New reply</span>
                                <?php endif; ?>
                            </div>
                            <div class="d-flex align-items-center gap-2 small text-muted">
                                <span class="badge bg-<?= $typeColor[$t['type']] ?? 'secondary' ?>" style="font-size:0.7rem"><?= $typeLabel[$t['type']] ?? $t['type'] ?></span>
                                <span><?= e($t['ticket_number']) ?></span>
                                <span>&middot;</span>
                                <span><?= date('M j, Y', strtotime($t['created_at'])) ?></span>
                                <span>&middot;</span>
                                <span><?= (int)$t['reply_count'] ?> <?= (int)$t['reply_count'] === 1 ? 'reply' : 'replies' ?></span>
                            </div>
                        </div>
                    </div>
                    <span class="badge bg-<?= $statusColor[$t['status']] ?? 'secondary' ?> ms-2"><?= $statusLabel[$t['status']] ?? $t['status'] ?></span>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
