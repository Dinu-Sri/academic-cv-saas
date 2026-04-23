<?php
$pageTitle = 'Admin - Retention';
ob_start();

$cvRate = $funnel['registered'] > 0 ? round(($funnel['cv_created'] / $funnel['registered']) * 100) : 0;
$compileRate = $funnel['registered'] > 0 ? round(($funnel['pdf_compiled'] / $funnel['registered']) * 100) : 0;
$downloadRate = $funnel['registered'] > 0 ? round(($funnel['pdf_downloaded'] / $funnel['registered']) * 100) : 0;
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-graph-up-arrow me-2"></i>Retention Analytics</h2>
            <p class="text-muted mb-0">Find where users drop off and what to improve first</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin" class="btn btn-outline-primary"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-primary"><i class="bi bi-people me-1"></i>Users</a>
            <a href="<?= APP_URL ?>/admin/tickets" class="btn btn-outline-primary position-relative">
                <i class="bi bi-ticket-detailed me-1"></i>Tickets
                <?php if (!empty($ticketStats['unread'])): ?>
                <span class="badge bg-danger rounded-pill ms-1"><?= $ticketStats['unread'] ?></span>
                <?php endif; ?>
            </a>
        </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-body py-3">
            <form method="GET" action="<?= APP_URL ?>/admin/retention" class="row g-2 align-items-end">
                <div class="col-md-3">
                    <label class="form-label form-label-sm">Window</label>
                    <select name="period" class="form-select form-select-sm" onchange="this.form.submit()">
                        <option value="7" <?= $period === 7 ? 'selected' : '' ?>>Last 7 days</option>
                        <option value="30" <?= $period === 30 ? 'selected' : '' ?>>Last 30 days</option>
                        <option value="90" <?= $period === 90 ? 'selected' : '' ?>>Last 90 days</option>
                    </select>
                </div>
            </form>
        </div>
    </div>

    <?php if (!$trackingReady): ?>
    <div class="alert alert-warning mb-4">
        <strong>Event tracking table not found.</strong>
        Apply migration <code>024_user_events.sql</code> to unlock compile/download funnel analytics.
    </div>
    <?php endif; ?>

    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center py-4">
                    <div class="small text-muted mb-1">Registered</div>
                    <div class="display-6 fw-bold"><?= $funnel['registered'] ?></div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center py-4">
                    <div class="small text-muted mb-1">Created First CV</div>
                    <div class="display-6 fw-bold text-primary"><?= $funnel['cv_created'] ?></div>
                    <div class="small text-muted"><?= $cvRate ?>% of signups</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center py-4">
                    <div class="small text-muted mb-1">Compiled PDF</div>
                    <div class="display-6 fw-bold text-success"><?= $funnel['pdf_compiled'] ?></div>
                    <div class="small text-muted"><?= $compileRate ?>% of signups</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center py-4">
                    <div class="small text-muted mb-1">Downloaded PDF</div>
                    <div class="display-6 fw-bold text-info"><?= $funnel['pdf_downloaded'] ?></div>
                    <div class="small text-muted"><?= $downloadRate ?>% of signups</div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-4">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-transparent fw-semibold">
                    <i class="bi bi-person-lines-fill me-1"></i>User Activity Segments
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2"><span>Active (last 7d)</span><strong><?= $segments['active'] ?></strong></div>
                    <div class="d-flex justify-content-between mb-2"><span>Dormant (7-30d)</span><strong><?= $segments['dormant'] ?></strong></div>
                    <div class="d-flex justify-content-between mb-2"><span>Churned (30d+)</span><strong><?= $segments['churned'] ?></strong></div>
                    <div class="d-flex justify-content-between"><span>Never Returned</span><strong class="text-danger"><?= $segments['never_returned'] ?></strong></div>
                    <hr>
                    <div class="small text-muted">Avg days signup to first CV</div>
                    <div class="h4 mb-0"><?= $avgDaysToFirstCv !== null ? e((string) $avgDaysToFirstCv) : 'N/A' ?></div>
                </div>
            </div>
        </div>

        <div class="col-lg-8">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-transparent fw-semibold d-flex justify-content-between">
                    <span><i class="bi bi-person-x me-1"></i>Latest Zero-CV Users</span>
                    <span class="small text-muted">Top 25</span>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>User</th>
                                <th>Plan</th>
                                <th>Joined</th>
                                <th>Last Login</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($zeroCvUsers)): ?>
                                <tr><td colspan="4" class="text-center text-muted py-4">No users in this segment.</td></tr>
                            <?php else: ?>
                                <?php foreach ($zeroCvUsers as $u): ?>
                                <tr>
                                    <td>
                                        <div class="fw-semibold small"><?= e($u['full_name'] ?: $u['username']) ?></div>
                                        <div class="text-muted" style="font-size: 0.75rem;"><?= e($u['email']) ?></div>
                                    </td>
                                    <td><span class="badge bg-secondary"><?= ucfirst(e($u['subscription_plan'])) ?></span></td>
                                    <td class="small"><?= date('M j, Y', strtotime($u['created_at'])) ?></td>
                                    <td class="small text-muted"><?= $u['last_login_at'] ? date('M j, Y', strtotime($u['last_login_at'])) : 'Never' ?></td>
                                </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
