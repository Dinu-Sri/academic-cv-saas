<?php
$pageTitle = 'Manage Users';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-people me-2"></i>Manage Users</h2>
            <p class="text-muted mb-0"><?= count($users) ?> user<?= count($users) !== 1 ? 's' : '' ?> found</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <!-- Filters -->
    <div class="card shadow-sm mb-4">
        <div class="card-body py-3">
            <form method="GET" action="<?= APP_URL ?>/admin/users" class="row g-2 align-items-end">
                <div class="col-md-5">
                    <label class="form-label small fw-semibold mb-1">Search</label>
                    <input type="text" name="search" class="form-control" placeholder="Search by name, email, or username..." 
                           value="<?= e($search) ?>">
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-semibold mb-1">Plan</label>
                    <select name="plan" class="form-select">
                        <option value="">All Plans</option>
                        <option value="free" <?= $planFilter === 'free' ? 'selected' : '' ?>>Free</option>
                        <option value="pro" <?= $planFilter === 'pro' ? 'selected' : '' ?>>Pro</option>
                        <option value="enterprise" <?= $planFilter === 'enterprise' ? 'selected' : '' ?>>Enterprise</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button type="submit" class="btn btn-primary w-100"><i class="bi bi-search me-1"></i>Filter</button>
                </div>
                <div class="col-md-2">
                    <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline-secondary w-100">Clear</a>
                </div>
            </form>
        </div>
    </div>

    <!-- Users Table -->
    <div class="card shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>User</th>
                        <th>Plan</th>
                        <th>CVs</th>
                        <th>Auth</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Last Login</th>
                        <th style="width: 200px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                    <tr class="<?= !$u['is_active'] ? 'table-secondary' : '' ?>">
                        <td class="text-muted small"><?= $u['id'] ?></td>
                        <td>
                            <div class="fw-semibold"><?= e($u['full_name'] ?: $u['username']) ?></div>
                            <div class="text-muted small"><?= e($u['email']) ?></div>
                            <?php if ($u['is_admin']): ?>
                                <span class="badge bg-danger small">Admin</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <span class="badge bg-<?= $u['subscription_plan'] === 'pro' ? 'primary' : ($u['subscription_plan'] === 'enterprise' ? 'warning text-dark' : 'secondary') ?>">
                                <?= ucfirst(e($u['subscription_plan'])) ?>
                            </span>
                        </td>
                        <td><span class="badge bg-light text-dark"><?= $u['cv_count'] ?></span></td>
                        <td>
                            <?php if ($u['google_id']): ?>
                                <i class="bi bi-google text-danger" title="Google"></i>
                            <?php endif; ?>
                            <?php if ($u['hashed_password']): ?>
                                <i class="bi bi-key text-muted" title="Password"></i>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($u['is_active']): ?>
                                <span class="badge bg-success-subtle text-success">Active</span>
                            <?php else: ?>
                                <span class="badge bg-danger-subtle text-danger">Inactive</span>
                            <?php endif; ?>
                        </td>
                        <td class="small text-muted"><?= date('M j, Y', strtotime($u['created_at'])) ?></td>
                        <td class="small text-muted"><?= $u['last_login_at'] ? date('M j, Y', strtotime($u['last_login_at'])) : 'Never' ?></td>
                        <td>
                            <div class="d-flex gap-1">
                                <!-- Change Plan -->
                                <form method="POST" action="<?= APP_URL ?>/admin/users/update-plan" class="d-inline">
                                    <?= Auth::csrfField() ?>
                                    <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                    <select name="plan" class="form-select form-select-sm d-inline-block" style="width: auto;"
                                            onchange="this.form.submit()">
                                        <option value="free" <?= $u['subscription_plan'] === 'free' ? 'selected' : '' ?>>Free</option>
                                        <option value="pro" <?= $u['subscription_plan'] === 'pro' ? 'selected' : '' ?>>Pro</option>
                                        <option value="enterprise" <?= $u['subscription_plan'] === 'enterprise' ? 'selected' : '' ?>>Enterprise</option>
                                    </select>
                                </form>

                                <!-- Toggle Active -->
                                <?php if ($u['id'] !== Auth::id()): ?>
                                <form method="POST" action="<?= APP_URL ?>/admin/users/toggle-status"
                                      data-confirm="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?> this user?"
                                      data-confirm-title="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?> User"
                                      data-confirm-type="<?= $u['is_active'] ? 'warning' : 'info' ?>"
                                      data-confirm-btn="Yes, <?= $u['is_active'] ? 'deactivate' : 'activate' ?>">
                                    <?= Auth::csrfField() ?>
                                    <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                    <button type="submit" class="btn btn-sm <?= $u['is_active'] ? 'btn-outline-warning' : 'btn-outline-success' ?>"
                                            title="<?= $u['is_active'] ? 'Deactivate' : 'Activate' ?>">
                                        <i class="bi bi-<?= $u['is_active'] ? 'pause-circle' : 'play-circle' ?>"></i>
                                    </button>
                                </form>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($users)): ?>
                    <tr>
                        <td colspan="9" class="text-center text-muted py-4">No users found.</td>
                    </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
