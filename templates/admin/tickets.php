<?php
$pageTitle = 'Admin — Support Tickets';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-ticket-detailed me-2"></i>Support Tickets</h2>
            <p class="text-muted mb-0">Manage user support requests, bug reports, and feature requests</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin" class="btn btn-outline-primary"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-primary"><i class="bi bi-people me-1"></i>Users</a>
        </div>
    </div>

    <!-- Stats Cards -->
    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-primary"><?= $ticketStats['total'] ?></div>
                    <div class="small text-muted">Total</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-warning"><?= $ticketStats['open'] ?></div>
                    <div class="small text-muted">Open</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-primary"><?= $ticketStats['in_progress'] ?></div>
                    <div class="small text-muted">In Progress</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-success"><?= $ticketStats['resolved'] ?></div>
                    <div class="small text-muted">Resolved</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-secondary"><?= $ticketStats['closed'] ?></div>
                    <div class="small text-muted">Closed</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-2">
            <div class="card border-0 shadow-sm text-center border-danger">
                <div class="card-body py-3">
                    <div class="fs-4 fw-bold text-danger"><?= $ticketStats['unread'] ?></div>
                    <div class="small text-muted">Unread</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Filters -->
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-body py-2">
            <form method="GET" action="<?= APP_URL ?>/admin/tickets" class="row g-2 align-items-center">
                <div class="col-md-4">
                    <input type="text" name="search" class="form-control form-control-sm" placeholder="Search ticket #, subject, user..." value="<?= e($_GET['search'] ?? '') ?>">
                </div>
                <div class="col-md-2">
                    <select name="status" class="form-select form-select-sm">
                        <option value="">All Status</option>
                        <option value="open" <?= ($_GET['status'] ?? '') === 'open' ? 'selected' : '' ?>>Open</option>
                        <option value="in_progress" <?= ($_GET['status'] ?? '') === 'in_progress' ? 'selected' : '' ?>>In Progress</option>
                        <option value="resolved" <?= ($_GET['status'] ?? '') === 'resolved' ? 'selected' : '' ?>>Resolved</option>
                        <option value="closed" <?= ($_GET['status'] ?? '') === 'closed' ? 'selected' : '' ?>>Closed</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <select name="type" class="form-select form-select-sm">
                        <option value="">All Types</option>
                        <option value="support" <?= ($_GET['type'] ?? '') === 'support' ? 'selected' : '' ?>>Support</option>
                        <option value="bug" <?= ($_GET['type'] ?? '') === 'bug' ? 'selected' : '' ?>>Bug Report</option>
                        <option value="feature" <?= ($_GET['type'] ?? '') === 'feature' ? 'selected' : '' ?>>Feature Request</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button type="submit" class="btn btn-primary btn-sm w-100"><i class="bi bi-search me-1"></i>Filter</button>
                </div>
                <?php if (!empty($_GET['search']) || !empty($_GET['status']) || !empty($_GET['type'])): ?>
                <div class="col-md-2">
                    <a href="<?= APP_URL ?>/admin/tickets" class="btn btn-outline-secondary btn-sm w-100">Clear</a>
                </div>
                <?php endif; ?>
            </form>
        </div>
    </div>

    <!-- Tickets Table -->
    <?php if (empty($tickets)): ?>
    <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5 text-muted">
            <i class="bi bi-inbox" style="font-size:2.5rem"></i>
            <p class="mt-2 mb-0">No tickets found.</p>
        </div>
    </div>
    <?php else: ?>
    <div class="card border-0 shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover mb-0 align-middle">
                <thead class="table-light">
                    <tr>
                        <th style="width:130px">Ticket #</th>
                        <th>Subject</th>
                        <th style="width:100px">Type</th>
                        <th style="width:140px">User</th>
                        <th style="width:100px">Status</th>
                        <th style="width:80px">Replies</th>
                        <th style="width:120px">Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                        $typeIcon = ['support' => 'bi-headset', 'bug' => 'bi-bug', 'feature' => 'bi-lightbulb'];
                        $typeColor = ['support' => 'primary', 'bug' => 'danger', 'feature' => 'info'];
                        $typeLabel = ['support' => 'Support', 'bug' => 'Bug', 'feature' => 'Feature'];
                        $statusColor = ['open' => 'warning', 'in_progress' => 'primary', 'resolved' => 'success', 'closed' => 'secondary'];
                        $statusLabel = ['open' => 'Open', 'in_progress' => 'In Progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
                    ?>
                    <?php foreach ($tickets as $t): ?>
                    <tr class="<?= $t['has_unread_user_reply'] ? 'table-warning' : '' ?>" style="cursor:pointer" onclick="window.location='<?= APP_URL ?>/admin/tickets/view?id=<?= $t['id'] ?>'">
                        <td>
                            <span class="fw-semibold small"><?= e($t['ticket_number']) ?></span>
                            <?php if ($t['has_unread_user_reply']): ?>
                            <span class="badge bg-danger rounded-pill ms-1" style="font-size:0.6rem">NEW</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <span class="fw-semibold"><?= e($t['subject']) ?></span>
                        </td>
                        <td>
                            <span class="badge bg-<?= $typeColor[$t['type']] ?? 'secondary' ?>">
                                <i class="bi <?= $typeIcon[$t['type']] ?? 'bi-ticket' ?> me-1"></i><?= $typeLabel[$t['type']] ?? $t['type'] ?>
                            </span>
                        </td>
                        <td>
                            <div class="small fw-semibold"><?= e($t['full_name'] ?: $t['username']) ?></div>
                            <div class="text-muted" style="font-size:0.7rem"><?= e($t['email']) ?></div>
                        </td>
                        <td>
                            <span class="badge bg-<?= $statusColor[$t['status']] ?? 'secondary' ?>"><?= $statusLabel[$t['status']] ?? $t['status'] ?></span>
                        </td>
                        <td class="text-center"><?= (int)$t['reply_count'] ?></td>
                        <td>
                            <span class="small text-muted"><?= date('M j, g:i A', strtotime($t['last_reply_at'] ?: $t['updated_at'])) ?></span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
