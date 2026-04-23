<?php
$pageTitle = 'Payment History';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-cash-stack me-2"></i>Payments</h2>
            <p class="text-muted mb-0">Payment history and refund management</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <?= flash_messages() ?>

    <!-- Filters -->
    <div class="card shadow-sm mb-4">
        <div class="card-body py-3">
            <form method="GET" action="<?= APP_URL ?>/admin/payments" class="row g-2 align-items-end">
                <div class="col-md-4">
                    <label class="form-label small text-muted mb-1">Search by email or order ID</label>
                    <input type="text" class="form-control form-control-sm" name="search" value="<?= e($search ?? '') ?>" placeholder="Email or order ID...">
                </div>
                <div class="col-md-3">
                    <label class="form-label small text-muted mb-1">Status</label>
                    <select class="form-select form-select-sm" name="status">
                        <option value="">All</option>
                        <option value="completed" <?= ($statusFilter ?? '') === 'completed' ? 'selected' : '' ?>>Completed</option>
                        <option value="pending" <?= ($statusFilter ?? '') === 'pending' ? 'selected' : '' ?>>Pending</option>
                        <option value="failed" <?= ($statusFilter ?? '') === 'failed' ? 'selected' : '' ?>>Failed</option>
                        <option value="cancelled" <?= ($statusFilter ?? '') === 'cancelled' ? 'selected' : '' ?>>Cancelled</option>
                        <option value="refunded" <?= ($statusFilter ?? '') === 'refunded' ? 'selected' : '' ?>>Refunded</option>
                        <option value="chargedback" <?= ($statusFilter ?? '') === 'chargedback' ? 'selected' : '' ?>>Chargedback</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button type="submit" class="btn btn-primary btn-sm w-100"><i class="bi bi-search me-1"></i>Filter</button>
                </div>
                <?php if (!empty($search) || !empty($statusFilter)): ?>
                <div class="col-md-2">
                    <a href="<?= APP_URL ?>/admin/payments" class="btn btn-outline-secondary btn-sm w-100">Clear</a>
                </div>
                <?php endif; ?>
            </form>
        </div>
    </div>

    <!-- Summary Stats -->
    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-3">
                    <div class="fw-bold fs-4 text-success">$<?= number_format($paymentStats['total_revenue'] ?? 0, 2) ?></div>
                    <div class="text-muted small">Total Revenue</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-3">
                    <div class="fw-bold fs-4 text-primary"><?= $paymentStats['total_completed'] ?? 0 ?></div>
                    <div class="text-muted small">Completed</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-3">
                    <div class="fw-bold fs-4 text-warning"><?= $paymentStats['total_pending'] ?? 0 ?></div>
                    <div class="text-muted small">Pending</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-3">
                    <div class="fw-bold fs-4 text-danger">$<?= number_format($paymentStats['total_refunded'] ?? 0, 2) ?></div>
                    <div class="text-muted small">Refunded</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Payments Table -->
    <div class="card shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>User</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Cycle</th>
                        <th>Status</th>
                        <th>PayHere ID</th>
                        <th>Date</th>
                        <th>Sub. Expires</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($payments)): ?>
                    <tr>
                        <td colspan="10" class="text-center text-muted py-5">
                            <i class="bi bi-inbox display-6 d-block mb-2"></i>
                            No payments found
                        </td>
                    </tr>
                    <?php else: ?>
                    <?php foreach ($payments as $p): ?>
                    <tr>
                        <td class="text-muted small"><?= $p['id'] ?></td>
                        <td>
                            <div class="fw-semibold small"><?= e($p['email'] ?? '') ?></div>
                            <div class="text-muted" style="font-size: 0.75rem;"><?= e($p['full_name'] ?? $p['username'] ?? '') ?></div>
                        </td>
                        <td><span class="badge bg-info"><?= e(ucfirst($p['subscription_plan'] ?? '')) ?></span></td>
                        <td class="fw-semibold"><?= e($p['currency'] ?? 'USD') ?> <?= number_format($p['amount'] ?? 0, 2) ?></td>
                        <td class="small"><?= e(ucfirst($p['billing_cycle'] ?? 'N/A')) ?></td>
                        <td>
                            <?php
                            $statusBadge = match($p['status'] ?? '') {
                                'completed' => 'bg-success',
                                'pending' => 'bg-warning text-dark',
                                'failed' => 'bg-danger',
                                'cancelled' => 'bg-secondary',
                                'refunded' => 'bg-info',
                                'chargedback' => 'bg-dark',
                                default => 'bg-secondary',
                            };
                            ?>
                            <span class="badge <?= $statusBadge ?>"><?= e(ucfirst($p['status'] ?? 'unknown')) ?></span>
                            <?php if (!empty($p['refund_status'])): ?>
                            <br><span class="badge bg-info mt-1" style="font-size: 0.65rem;">Refund: <?= e($p['refund_status']) ?></span>
                            <?php endif; ?>
                        </td>
                        <td class="small text-muted"><?= e($p['payhere_payment_id'] ?? '—') ?></td>
                        <td class="small text-muted"><?= date('M j, Y H:i', strtotime($p['created_at'])) ?></td>
                        <td class="small">
                            <?php if (!empty($p['subscription_expires_at'])): ?>
                            <?= date('M j, Y', strtotime($p['subscription_expires_at'])) ?>
                            <?php if ($p['subscription_plan'] !== 'free'): ?>
                            <span class="badge bg-success ms-1" style="font-size:0.6rem">Active</span>
                            <?php endif; ?>
                            <?php else: ?>
                            <span class="text-muted">—</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($p['status'] === 'pending'): ?>
                            <form method="POST" action="<?= APP_URL ?>/admin/payments/approve" class="d-inline">
                                <?= Auth::csrfField() ?>
                                <input type="hidden" name="payment_id" value="<?= (int)$p['id'] ?>">
                                <button type="submit" class="btn btn-success btn-sm"
                                        onclick="return confirm('Manually approve this payment and upgrade the user?')"
                                        title="Approve and upgrade user">
                                    <i class="bi bi-check-circle me-1"></i>Approve
                                </button>
                            </form>
                            <?php elseif ($p['status'] === 'completed' && empty($p['refund_status']) && !empty($p['payhere_payment_id'])): ?>
                            <button class="btn btn-outline-danger btn-sm" data-bs-toggle="modal" data-bs-target="#refundModal"
                                onclick="setRefundData(<?= $p['id'] ?>, '<?= e($p['payhere_payment_id']) ?>', <?= $p['amount'] ?>, '<?= e($p['email'] ?? '') ?>', '<?= e(ucfirst($p['subscription_plan'] ?? '')) ?>')">
                                <i class="bi bi-arrow-counterclockwise me-1"></i>Refund
                            </button>
                            <?php elseif ($p['status'] === 'completed' && !empty($p['refund_status'])): ?>
                            <span class="text-muted small">Refunded</span>
                            <?php else: ?>
                            <span class="text-muted">—</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Refund Modal -->
<div class="modal fade" id="refundModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST" action="<?= APP_URL ?>/admin/payments/refund">
                <?= Auth::csrfField() ?>
                <input type="hidden" name="payment_id" id="refund_payment_id">

                <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-arrow-counterclockwise me-2"></i>Process Refund</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning py-2">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        This will process a refund through PayHere. This action cannot be undone.
                    </div>

                    <table class="table table-sm mb-3">
                        <tr><td class="text-muted">User</td><td class="fw-semibold" id="refund_email"></td></tr>
                        <tr><td class="text-muted">Plan</td><td id="refund_plan"></td></tr>
                        <tr><td class="text-muted">Amount</td><td class="fw-semibold" id="refund_amount_display"></td></tr>
                        <tr><td class="text-muted">PayHere ID</td><td><code id="refund_payhere_id"></code></td></tr>
                    </table>

                    <div class="mb-3">
                        <label for="refund_note" class="form-label fw-semibold">Refund Note</label>
                        <textarea class="form-control" id="refund_note" name="refund_note" rows="2" placeholder="Reason for refund..."></textarea>
                    </div>

                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="downgrade_user" name="downgrade_user" value="1" checked>
                        <label class="form-check-label" for="downgrade_user">
                            Downgrade user to Free plan after refund
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-danger">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Process Refund
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
function setRefundData(paymentId, payhereId, amount, email, plan) {
    document.getElementById('refund_payment_id').value = paymentId;
    document.getElementById('refund_payhere_id').textContent = payhereId;
    document.getElementById('refund_amount_display').textContent = '$' + parseFloat(amount).toFixed(2);
    document.getElementById('refund_email').textContent = email;
    document.getElementById('refund_plan').textContent = plan;
}
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
