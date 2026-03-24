<?php
$pageTitle = 'Admin — Ticket: ' . e($ticket['subject']);
$typeLabel = ['support' => 'Support Ticket', 'bug' => 'Bug Report', 'feature' => 'Feature Request'];
$typeColor = ['support' => 'primary', 'bug' => 'danger', 'feature' => 'info'];
$typeIcon = ['support' => 'bi-headset', 'bug' => 'bi-bug', 'feature' => 'bi-lightbulb'];
$statusColor = ['open' => 'warning', 'in_progress' => 'primary', 'resolved' => 'success', 'closed' => 'secondary'];
$statusLabel = ['open' => 'Open', 'in_progress' => 'In Progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
$planColor = ['free' => 'secondary', 'pro' => 'primary', 'enterprise' => 'warning text-dark'];
ob_start();
?>
<div class="container py-4" style="max-width:900px">
    <!-- Back -->
    <a href="<?= APP_URL ?>/admin/tickets" class="text-decoration-none small mb-3 d-inline-block">
        <i class="bi bi-arrow-left me-1"></i>Back to Tickets
    </a>

    <div class="row g-4">
        <!-- Main Thread -->
        <div class="col-lg-8">
            <!-- Ticket Header -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h4 class="fw-bold mb-1"><?= e($ticket['subject']) ?></h4>
                            <div class="d-flex align-items-center gap-2 text-muted small flex-wrap">
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

            <!-- Thread Messages -->
            <div class="mb-4">
                <?php foreach ($replies as $r): ?>
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
                                    <span class="text-primary"><?= e($r['full_name'] ?: $r['username']) ?> <span class="badge bg-primary" style="font-size:0.6rem">Admin</span></span>
                                <?php else: ?>
                                    <?= e($r['full_name'] ?: $r['username']) ?>
                                <?php endif; ?>
                            </span>
                            <span class="text-muted" style="font-size:0.75rem"><?= date('M j, g:i A', strtotime($r['created_at'])) ?></span>
                        </div>
                        <div class="card border-0 <?= $r['is_admin_reply'] ? 'bg-primary-subtle' : 'bg-light' ?>">
                            <div class="card-body py-2 px-3">
                                <p class="mb-0" style="white-space:pre-wrap"><?= e($r['message']) ?></p>
                                <?php if (!empty($r['attachment'])): ?>
                                <div class="mt-2">
                                    <a href="<?= APP_URL ?>/support/attachment?file=<?= urlencode($r['attachment']) ?>" target="_blank">
                                        <img src="<?= APP_URL ?>/support/attachment?file=<?= urlencode($r['attachment']) ?>" class="img-fluid rounded border" style="max-height:300px;cursor:pointer" alt="Attachment">
                                    </a>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <!-- Admin Reply Form -->
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <h6 class="fw-bold mb-3"><i class="bi bi-reply me-1"></i>Reply & Update</h6>
                    <form method="POST" action="<?= APP_URL ?>/admin/tickets/reply" enctype="multipart/form-data">
                        <?= Auth::csrfField() ?>
                        <input type="hidden" name="ticket_id" value="<?= $ticket['id'] ?>">
                        <div class="mb-3">
                            <textarea class="form-control" name="message" rows="4" placeholder="Type your reply to the user..."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Attach Image <span class="text-muted fw-normal">(optional)</span></label>
                            <input type="file" class="form-control form-control-sm" name="attachment" accept="image/jpeg,image/png,image/gif,image/webp">
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <label class="form-label mb-0 small fw-semibold">Status:</label>
                                <select name="status" class="form-select form-select-sm" style="width:auto">
                                    <option value="">— No change —</option>
                                    <option value="open" <?= $ticket['status'] === 'open' ? 'selected' : '' ?>>Open</option>
                                    <option value="in_progress" <?= $ticket['status'] === 'in_progress' ? 'selected' : '' ?>>In Progress</option>
                                    <option value="resolved" <?= $ticket['status'] === 'resolved' ? 'selected' : '' ?>>Resolved</option>
                                    <option value="closed" <?= $ticket['status'] === 'closed' ? 'selected' : '' ?>>Closed</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-send me-1"></i>Send & Update
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Sidebar: User Info -->
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-header bg-transparent fw-semibold small">
                    <i class="bi bi-person me-1"></i>User Info
                </div>
                <div class="card-body">
                    <div class="mb-2">
                        <div class="fw-semibold"><?= e($ticket['full_name'] ?: $ticket['username']) ?></div>
                        <div class="text-muted small"><?= e($ticket['email']) ?></div>
                    </div>
                    <div>
                        <span class="badge bg-<?= $planColor[$ticket['subscription_plan']] ?? 'secondary' ?>">
                            <?= ucfirst(e($ticket['subscription_plan'])) ?> Plan
                        </span>
                    </div>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-header bg-transparent fw-semibold small">
                    <i class="bi bi-info-circle me-1"></i>Ticket Details
                </div>
                <div class="card-body small">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Ticket #</span>
                        <span class="fw-semibold"><?= e($ticket['ticket_number']) ?></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Type</span>
                        <span class="badge bg-<?= $typeColor[$ticket['type']] ?? 'secondary' ?>"><?= $typeLabel[$ticket['type']] ?? $ticket['type'] ?></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Status</span>
                        <span class="badge bg-<?= $statusColor[$ticket['status']] ?? 'secondary' ?>"><?= $statusLabel[$ticket['status']] ?? $ticket['status'] ?></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Created</span>
                        <span><?= date('M j, Y', strtotime($ticket['created_at'])) ?></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Updated</span>
                        <span><?= date('M j, Y', strtotime($ticket['updated_at'])) ?></span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Replies</span>
                        <span><?= count($replies) ?></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
