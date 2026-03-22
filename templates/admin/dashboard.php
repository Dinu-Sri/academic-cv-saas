<?php
$pageTitle = 'Admin Dashboard';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-speedometer2 me-2"></i>Admin Dashboard</h2>
            <p class="text-muted mb-0">System overview and statistics</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-primary"><i class="bi bi-people me-1"></i>Users</a>
            <a href="<?= APP_URL ?>/admin/features" class="btn btn-outline-primary"><i class="bi bi-toggles me-1"></i>Features</a>
        </div>
    </div>

    <!-- Stats Cards Row 1 -->
    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-primary-subtle text-primary mb-2"><i class="bi bi-people-fill"></i></div>
                    <div class="admin-stat-number"><?= $stats['total_users'] ?></div>
                    <div class="admin-stat-label">Total Users</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-success-subtle text-success mb-2"><i class="bi bi-person-check-fill"></i></div>
                    <div class="admin-stat-number"><?= $stats['active_users'] ?></div>
                    <div class="admin-stat-label">Active Users</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-info-subtle text-info mb-2"><i class="bi bi-file-earmark-text-fill"></i></div>
                    <div class="admin-stat-number"><?= $stats['total_cvs'] ?></div>
                    <div class="admin-stat-label">Total CVs</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-warning-subtle text-warning mb-2"><i class="bi bi-person-plus-fill"></i></div>
                    <div class="admin-stat-number"><?= $stats['recent_signups'] ?></div>
                    <div class="admin-stat-label">Signups (7d)</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Stats Cards Row 2 -->
    <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-secondary-subtle text-secondary mb-2"><i class="bi bi-box-arrow-in-right"></i></div>
                    <div class="admin-stat-number"><?= $stats['recent_logins'] ?></div>
                    <div class="admin-stat-label">Logins (7d)</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-danger-subtle text-danger mb-2"><i class="bi bi-journal-text"></i></div>
                    <div class="admin-stat-number"><?= $stats['total_publications'] ?></div>
                    <div class="admin-stat-label">Publications</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-primary-subtle text-primary mb-2"><i class="bi bi-google"></i></div>
                    <div class="admin-stat-number"><?= $stats['google_users'] ?></div>
                    <div class="admin-stat-label">Google Users</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card border-0 shadow-sm admin-stat-card">
                <div class="card-body text-center py-4">
                    <div class="admin-stat-icon bg-info-subtle text-info mb-2"><i class="bi bi-list-check"></i></div>
                    <div class="admin-stat-number"><?= $stats['total_entries'] ?></div>
                    <div class="admin-stat-label">CV Entries</div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <!-- Plan Distribution -->
        <div class="col-lg-4">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-transparent fw-semibold">
                    <i class="bi bi-pie-chart me-1"></i>Plan Distribution
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span><span class="badge bg-secondary me-2">Free</span></span>
                        <span class="fw-bold"><?= $stats['users_free'] ?></span>
                    </div>
                    <div class="progress mb-3" style="height: 8px;">
                        <div class="progress-bar bg-secondary" style="width: <?= $stats['total_users'] > 0 ? round($stats['users_free'] / $stats['total_users'] * 100) : 0 ?>%"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span><span class="badge bg-primary me-2">Pro</span></span>
                        <span class="fw-bold"><?= $stats['users_pro'] ?></span>
                    </div>
                    <div class="progress mb-3" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: <?= $stats['total_users'] > 0 ? round($stats['users_pro'] / $stats['total_users'] * 100) : 0 ?>%"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span><span class="badge bg-warning text-dark me-2">Enterprise</span></span>
                        <span class="fw-bold"><?= $stats['users_enterprise'] ?></span>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-warning" style="width: <?= $stats['total_users'] > 0 ? round($stats['users_enterprise'] / $stats['total_users'] * 100) : 0 ?>%"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Template Usage -->
        <div class="col-lg-4">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-transparent fw-semibold">
                    <i class="bi bi-layout-text-window me-1"></i>Template Usage
                </div>
                <div class="card-body">
                    <?php if (empty($templateUsage)): ?>
                        <p class="text-muted text-center">No data yet</p>
                    <?php else: ?>
                        <?php foreach ($templateUsage as $tu): ?>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span><?= e($tu['name']) ?></span>
                            <span class="badge bg-primary rounded-pill"><?= $tu['cv_count'] ?> CVs</span>
                        </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Recent Users -->
        <div class="col-lg-4">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-transparent fw-semibold d-flex justify-content-between">
                    <span><i class="bi bi-clock-history me-1"></i>Recent Users</span>
                    <a href="<?= APP_URL ?>/admin/users" class="small">View all</a>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                        <?php foreach ($recentUsers as $ru): ?>
                        <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                            <div>
                                <div class="fw-semibold small"><?= e($ru['full_name'] ?: $ru['username']) ?></div>
                                <div class="text-muted" style="font-size: 0.75rem;"><?= e($ru['email']) ?></div>
                            </div>
                            <span class="badge bg-<?= $ru['subscription_plan'] === 'pro' ? 'primary' : ($ru['subscription_plan'] === 'enterprise' ? 'warning text-dark' : 'secondary') ?> small">
                                <?= ucfirst($ru['subscription_plan']) ?>
                            </span>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
