<?php
$pageTitle = 'Admin — Cron Jobs';
ob_start();
?>
<div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-clock-history me-2"></i>Cron Jobs</h2>
            <p class="text-muted mb-0">Monitor scheduled tasks and toggle execution</p>
        </div>
        <div class="btn-group">
            <a href="<?= APP_URL ?>/admin" class="btn btn-outline-primary"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            <a href="<?= APP_URL ?>/admin/emails" class="btn btn-outline-primary"><i class="bi bi-envelope me-1"></i>Emails</a>
            <a href="<?= APP_URL ?>/admin/whatsapp" class="btn btn-outline-primary"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>
            <a href="<?= APP_URL ?>/admin/settings" class="btn btn-outline-primary"><i class="bi bi-gear me-1"></i>Settings</a>
        </div>
    </div>

    <?php if (!empty($flash)): ?>
    <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?> alert-dismissible fade show">
        <?= e($flash['message']) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
    <?php endif; ?>

    <div class="alert alert-warning d-flex align-items-start gap-2 mb-4">
        <i class="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
        <div>
            <strong>Note:</strong> Disabling a job only prevents execution — it does <em>not</em> remove it from the crontab.
            To change the schedule itself, edit <code>docker-entrypoint.sh</code> and redeploy.
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Job Name</th>
                            <th>Schedule</th>
                            <th>Last Run</th>
                            <th>Status</th>
                            <th>Last Output</th>
                            <th class="text-end">Enable / Disable</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($cronJobs)): ?>
                        <tr><td colspan="6" class="text-center text-muted py-4">No cron jobs registered.</td></tr>
                        <?php else: ?>
                        <?php foreach ($cronJobs as $job): ?>
                        <?php
                            $status    = $job['last_status'] ?? 'never';
                            $badgeCls  = match($status) {
                                'success' => 'bg-success',
                                'failed'  => 'bg-danger',
                                'running' => 'bg-primary',
                                default   => 'bg-secondary',
                            };
                            $lastRun = $job['last_run_at']
                                ? (new DateTime($job['last_run_at']))->diff(new DateTime())->format('%a days, %H:%I ago')
                                : 'Never';
                        ?>
                        <tr>
                            <td>
                                <div class="fw-semibold"><?= e($job['label']) ?></div>
                                <small class="text-muted"><code><?= e($job['job_key']) ?></code></small>
                            </td>
                            <td><code class="small"><?= e($job['schedule']) ?></code></td>
                            <td class="text-muted small"><?= $lastRun ?></td>
                            <td>
                                <span class="badge <?= $badgeCls ?>">
                                    <?= ucfirst(e($status)) ?>
                                </span>
                            </td>
                            <td class="text-muted small" style="max-width:200px">
                                <div class="text-truncate" title="<?= e($job['last_output'] ?? '') ?>">
                                    <?= e(substr($job['last_output'] ?? '', 0, 80)) ?: '—' ?>
                                </div>
                            </td>
                            <td class="text-end">
                                <form method="POST" action="<?= APP_URL ?>/admin/crons/toggle" class="d-inline">
                                    <input type="hidden" name="csrf_token" value="<?= e($_SESSION['csrf_token'] ?? '') ?>">
                                    <input type="hidden" name="job_key" value="<?= e($job['job_key']) ?>">
                                    <button type="submit" class="btn btn-sm <?= $job['is_enabled'] ? 'btn-success' : 'btn-outline-secondary' ?>">
                                        <i class="bi bi-<?= $job['is_enabled'] ? 'toggle-on' : 'toggle-off' ?> me-1"></i>
                                        <?= $job['is_enabled'] ? 'Enabled' : 'Disabled' ?>
                                    </button>
                                </form>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
