<?php
$pageTitle = 'User Behavior Analytics';
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1"><i class="bi bi-graph-up-arrow me-2"></i>User Behavior Analytics</h2>
            <p class="text-muted mb-0">Per-user timeline, frustration signals, and export tools</p>
        </div>
        <a href="<?= APP_URL ?>/admin" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Dashboard
        </a>
    </div>

    <?= flash_messages() ?>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <div class="row g-3 align-items-end">
                <div class="col-md-3">
                    <label class="form-label fw-semibold">User</label>
                    <select id="userFilter" class="form-select">
                        <option value="">-- Select user --</option>
                        <?php foreach ($users as $user): ?>
                            <option value="<?= e((string) $user['id']) ?>" <?= ($selected_user_id == $user['id'] ? 'selected' : '') ?>>
                                <?= e($user['email']) ?> (ID: <?= (int) $user['id'] ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-semibold">From</label>
                    <input type="date" id="dateFrom" class="form-control" value="<?= e($date_from) ?>">
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-semibold">To</label>
                    <input type="date" id="dateTo" class="form-control" value="<?= e($date_to) ?>">
                </div>
                <div class="col-md-3">
                    <label class="form-label fw-semibold">Event Type</label>
                    <select id="eventFilter" class="form-select">
                        <option value="">-- All events --</option>
                        <option value="page_view" <?= ($event_type === 'page_view' ? 'selected' : '') ?>>Page View</option>
                        <option value="click" <?= ($event_type === 'click' ? 'selected' : '') ?>>Click</option>
                        <option value="scroll_depth" <?= ($event_type === 'scroll_depth' ? 'selected' : '') ?>>Scroll Depth</option>
                        <option value="rage_click" <?= ($event_type === 'rage_click' ? 'selected' : '') ?>>Rage Click</option>
                        <option value="js_error" <?= ($event_type === 'js_error' ? 'selected' : '') ?>>JS Error</option>
                        <option value="field_fill" <?= ($event_type === 'field_fill' ? 'selected' : '') ?>>Field Fill</option>
                        <option value="form_submit" <?= ($event_type === 'form_submit' ? 'selected' : '') ?>>Form Submit</option>
                        <option value="form_abandon" <?= ($event_type === 'form_abandon' ? 'selected' : '') ?>>Form Abandon</option>
                        <option value="unhandled_rejection" <?= ($event_type === 'unhandled_rejection' ? 'selected' : '') ?>>Unhandled Rejection</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button id="filterBtn" class="btn btn-primary w-100">Filter</button>
                </div>
            </div>
        </div>
    </div>

    <?php if ($selected_user_id && $session_summary): ?>
        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="card border-0 shadow-sm bg-info-subtle">
                    <div class="card-body py-3"><strong>Sessions:</strong> <?= (int) ($session_summary['total_sessions'] ?? 0) ?></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 shadow-sm bg-warning-subtle">
                    <div class="card-body py-3"><strong>Events:</strong> <?= (int) ($session_summary['total_events'] ?? 0) ?></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 shadow-sm bg-success-subtle">
                    <div class="card-body py-3"><strong>Page Views:</strong> <?= (int) ($session_summary['total_pageviews'] ?? 0) ?></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 shadow-sm bg-danger-subtle">
                    <div class="card-body py-3"><strong>Rage Clicks:</strong> <?= (int) ($session_summary['total_rage_clicks'] ?? 0) ?></div>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <div class="card shadow-sm mb-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold"><i class="bi bi-list-check me-2"></i>Behavior Timeline</h5>
            <?php if ($selected_user_id && !empty($events)): ?>
                <div class="d-flex gap-2">
                    <form method="POST" action="<?= APP_URL ?>/admin/behavior/export">
                        <?= Auth::csrfField() ?>
                        <input type="hidden" name="user_id" value="<?= (int) $selected_user_id ?>">
                        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
                        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
                        <input type="hidden" name="format" value="csv">
                        <button type="submit" class="btn btn-sm btn-success">CSV</button>
                    </form>
                    <form method="POST" action="<?= APP_URL ?>/admin/behavior/export">
                        <?= Auth::csrfField() ?>
                        <input type="hidden" name="user_id" value="<?= (int) $selected_user_id ?>">
                        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
                        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
                        <input type="hidden" name="format" value="json">
                        <button type="submit" class="btn btn-sm btn-info">JSON</button>
                    </form>
                    <form method="POST" action="<?= APP_URL ?>/admin/behavior/export">
                        <?= Auth::csrfField() ?>
                        <input type="hidden" name="user_id" value="<?= (int) $selected_user_id ?>">
                        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
                        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
                        <input type="hidden" name="format" value="zip">
                        <button type="submit" class="btn btn-sm btn-dark">ZIP Bundle</button>
                    </form>
                </div>
            <?php endif; ?>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover table-sm mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-3">Time</th>
                            <th>Event</th>
                            <th>Path</th>
                            <th>Details</th>
                            <th>Frustration</th>
                            <th class="pe-3">Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($events)): ?>
                            <tr>
                                <td colspan="6" class="text-center text-muted py-4">No events for selected filters.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($events as $event): ?>
                                <?php $meta = json_decode((string)($event['metadata'] ?? ''), true) ?? []; ?>
                                <tr class="<?= ((int)($event['frustration_score'] ?? 0) > 5 ? 'table-danger' : '') ?>">
                                    <td class="ps-3"><small><?= e(date('M d, H:i:s', strtotime((string) $event['event_at']))) ?></small></td>
                                    <td><span class="badge bg-secondary"><?= e(strtoupper(str_replace('_', ' ', (string) $event['event_type']))) ?></span></td>
                                    <td><code><?= e(substr((string)($event['path'] ?? ''), 0, 70)) ?></code></td>
                                    <td>
                                        <?php if (($event['event_type'] ?? '') === 'field_fill'): ?>
                                            Field <?= e((string)($meta['field_name'] ?? 'unknown')) ?>
                                            (<?= e((string)($meta['field_type'] ?? 'unknown')) ?>, len=<?= (int)($meta['value_length'] ?? 0) ?>)
                                        <?php elseif (($event['event_type'] ?? '') === 'form_abandon'): ?>
                                            Abandoned forms: <?= (int)($meta['forms_count'] ?? 0) ?>
                                        <?php else: ?>
                                            <?= e(substr(json_encode($meta, JSON_UNESCAPED_SLASHES) ?: '', 0, 120)) ?>
                                        <?php endif; ?>
                                    </td>
                                    <td><?= (int) ($event['frustration_score'] ?? 0) ?></td>
                                    <td class="pe-3"><?= !empty($event['duration_ms']) ? number_format((int)$event['duration_ms']) . 'ms' : '-' ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header bg-white">
            <h5 class="mb-0 fw-bold"><i class="bi bi-info-circle me-2"></i>Tracked Events</h5>
        </div>
        <div class="card-body small text-muted">
            page_view, page_leave, click, scroll_depth, rage_click, js_error, unhandled_rejection, focus, field_focus, field_fill, field_blur, form_start, form_submit, form_abandon, pricing_view, pricing_click_plan.
            Sensitive values are masked; field-level events store metadata (name/type/length), not raw typed content.
        </div>
    </div>
</div>

<script>
(function () {
    var filterBtn = document.getElementById('filterBtn');
    if (!filterBtn) return;

    filterBtn.addEventListener('click', function () {
        var userId = document.getElementById('userFilter').value;
        var dateFrom = document.getElementById('dateFrom').value;
        var dateTo = document.getElementById('dateTo').value;
        var eventType = document.getElementById('eventFilter').value;

        if (!userId) {
            alert('Please select a user');
            return;
        }

        var url = '<?= APP_URL ?>/admin/behavior?user_id=' + encodeURIComponent(userId)
            + '&date_from=' + encodeURIComponent(dateFrom)
            + '&date_to=' + encodeURIComponent(dateTo);
        if (eventType) {
            url += '&event_type=' + encodeURIComponent(eventType);
        }
        window.location.href = url;
    });
})();
</script>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
