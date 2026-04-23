<?php
// Admin Behavior Analytics Dashboard
$page_title = 'User Behavior Analytics';
?>

<div class="card shadow-sm">
    <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <h5 class="mb-0">📊 User Behavior Tracking & Timeline</h5>
        <small class="text-white-50">Real-time user interaction logs</small>
    </div>
    <div class="card-body">

        <!-- Search & Filter Row -->
        <div class="row mb-4">
            <div class="col-md-3">
                <label class="form-label fw-bold">📧 Search User</label>
                <select id="userFilter" class="form-select">
                    <option value="">-- Select User --</option>
                    <?php foreach ($users as $user): ?>
                        <option value="<?= e($user['id']) ?>" <?= ($selected_user_id == $user['id'] ? 'selected' : '') ?>>
                            <?= e($user['email']) ?> (ID: <?= $user['id'] ?>)
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label fw-bold">📅 From Date</label>
                <input type="date" id="dateFrom" class="form-control" value="<?= e($date_from) ?>">
            </div>
            <div class="col-md-2">
                <label class="form-label fw-bold">📅 To Date</label>
                <input type="date" id="dateTo" class="form-control" value="<?= e($date_to) ?>">
            </div>
            <div class="col-md-2">
                <label class="form-label fw-bold">🎯 Event Type</label>
                <select id="eventFilter" class="form-select">
                    <option value="">-- All Events --</option>
                    <option value="page_view">📄 Page View</option>
                    <option value="click">🖱️ Click</option>
                    <option value="scroll">⬇️ Scroll</option>
                    <option value="rage_click">😠 Rage Click</option>
                    <option value="error">⚠️ Error</option>
                    <option value="form_submit">✅ Form Submit</option>
                    <option value="unhandled_rejection">❌ JS Error</option>
                </select>
            </div>
            <div class="col-md-3 d-flex align-items-end">
                <button id="filterBtn" class="btn btn-primary w-100">🔍 Filter & Load</button>
            </div>
        </div>

        <hr>

        <!-- User Session Summary -->
        <?php if ($selected_user_id && $session_summary): ?>
            <div class="row mb-4">
                <div class="col-md-12">
                    <h6 class="fw-bold text-primary">📊 Session Summary for <?= e($selected_user['email']) ?></h6>
                </div>
                <div class="col-md-3">
                    <div class="alert alert-info mb-2">
                        <strong>Total Sessions:</strong> <?= $session_summary['total_sessions'] ?>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="alert alert-warning mb-2">
                        <strong>Total Events:</strong> <?= $session_summary['total_events'] ?>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="alert alert-success mb-2">
                        <strong>Total Page Views:</strong> <?= $session_summary['total_pageviews'] ?>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="alert alert-danger mb-2">
                        <strong>Rage Clicks:</strong> <?= $session_summary['total_rage_clicks'] ?>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- Behavior Timeline Table -->
        <div class="table-responsive">
            <table class="table table-hover table-sm">
                <thead class="table-dark">
                    <tr>
                        <th>⏰ Time</th>
                        <th>🎯 Event Type</th>
                        <th>📍 Page/Path</th>
                        <th>🔗 Details</th>
                        <th>😠 Frustration Score</th>
                        <th>⏱️ Duration</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($events)): ?>
                        <tr>
                            <td colspan="6" class="text-center text-muted py-4">
                                No behavior events found. Select a user and date range to view logs.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($events as $event): ?>
                            <tr class="<?= ($event['frustration_score'] > 5 ? 'table-danger' : '') ?>">
                                <td>
                                    <small class="text-monospace">
                                        <?= date('M d, H:i:s', strtotime($event['event_at'])) ?>
                                    </small>
                                </td>
                                <td>
                                    <span class="badge bg-info">
                                        <?= htmlspecialchars(strtoupper(str_replace('_', ' ', $event['event_type']))) ?>
                                    </span>
                                </td>
                                <td>
                                    <code class="text-secondary" style="font-size: 11px;">
                                        <?= htmlspecialchars(substr($event['path'], 0, 50)) ?>
                                        <?= (strlen($event['path']) > 50 ? '...' : '') ?>
                                    </code>
                                </td>
                                <td>
                                    <?php 
                                    $metadata = json_decode($event['metadata'], true) ?? [];
                                    $selector = $event['selector'] ? htmlspecialchars($event['selector']) : '-';
                                    ?>
                                    <small>
                                        <?php if ($event['event_type'] === 'click'): ?>
                                            <strong>Click:</strong> <?= $selector ?><br>
                                            <em class="text-muted">Coords: (<?= $metadata['x'] ?? '?' ?>, <?= $metadata['y'] ?? '?' ?>)</em>
                                        <?php elseif ($event['event_type'] === 'scroll'): ?>
                                            <strong>Scroll Depth:</strong> <?= $event['scroll_depth'] ?? 0 ?>%
                                        <?php elseif ($event['event_type'] === 'rage_click'): ?>
                                            <strong>Rage Clicked:</strong> <?= $selector ?><br>
                                            <em class="text-danger">Clicked 3+ times in 2 sec (frustration signal)</em>
                                        <?php elseif ($event['event_type'] === 'error'): ?>
                                            <strong>Error:</strong> <?= htmlspecialchars(substr($metadata['message'] ?? '', 0, 60)) ?><br>
                                            <em class="text-muted"><?= htmlspecialchars(substr($metadata['stack'] ?? '', 0, 60)) ?>...</em>
                                        <?php elseif ($event['event_type'] === 'page_view'): ?>
                                            <strong>Title:</strong> <?= htmlspecialchars(substr($metadata['title'] ?? 'N/A', 0, 50)) ?><br>
                                            <em class="text-muted">Referrer: <?= htmlspecialchars(substr($metadata['referrer'] ?? 'N/A', 0, 40)) ?></em>
                                        <?php else: ?>
                                            <?= json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
                                        <?php endif; ?>
                                    </small>
                                </td>
                                <td>
                                    <?php 
                                    $frustration = $event['frustration_score'];
                                    $color = 'success';
                                    if ($frustration > 15) $color = 'danger';
                                    elseif ($frustration > 10) $color = 'warning';
                                    elseif ($frustration > 5) $color = 'warning';
                                    ?>
                                    <span class="badge bg-<?= $color ?>">
                                        <?= $frustration ?>
                                    </span>
                                </td>
                                <td>
                                    <?php if ($event['duration_ms']): ?>
                                        <small class="text-muted"><?= number_format($event['duration_ms']) ?>ms</small>
                                    <?php else: ?>
                                        <small class="text-muted">-</small>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- Export Section -->
        <?php if ($selected_user_id && !empty($events)): ?>
            <hr>
            <div class="row">
                <div class="col-md-12">
                    <h6 class="fw-bold">📥 Export Behavior Data</h6>
                    <form method="POST" action="/admin/behavior/export" style="display: inline;">
                        <input type="hidden" name="user_id" value="<?= $selected_user_id ?>">
                        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
                        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
                        <input type="hidden" name="format" value="csv">
                        <button type="submit" class="btn btn-success btn-sm">📊 Export as CSV</button>
                    </form>
                    <form method="POST" action="/admin/behavior/export" style="display: inline;">
                        <input type="hidden" name="user_id" value="<?= $selected_user_id ?>">
                        <input type="hidden" name="date_from" value="<?= e($date_from) ?>">
                        <input type="hidden" name="date_to" value="<?= e($date_to) ?>">
                        <input type="hidden" name="format" value="json">
                        <button type="submit" class="btn btn-info btn-sm">📋 Export as JSON</button>
                    </form>
                </div>
            </div>
        <?php endif; ?>

    </div>
</div>

<!-- Information Panel -->
<div class="row mt-4">
    <div class="col-md-12">
        <div class="card bg-light">
            <div class="card-header bg-secondary text-white">
                <h6 class="mb-0">ℹ️ What Events Are Being Logged?</h6>
            </div>
            <div class="card-body">
                <p class="text-muted"><strong>Privacy Note:</strong> If "Behavior Masking" is enabled in settings, input values are redacted.</p>
                
                <table class="table table-sm table-borderless">
                    <thead>
                        <tr class="border-bottom">
                            <th width="20%"><strong>Event Type</strong></th>
                            <th width="60%"><strong>What It Captures</strong></th>
                            <th width="20%"><strong>Use Case</strong></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="badge bg-info">page_view</span></td>
                            <td>User lands on a page. Logs: page path, title, referrer.</td>
                            <td>Track which pages users visit and traffic flow</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-info">page_leave</span></td>
                            <td>User navigates away. Logs: dwell time (seconds on page).</td>
                            <td>Measure engagement and time spent per page</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-info">click</span></td>
                            <td>User clicks element. Logs: CSS selector, coordinates, element text (if not input).</td>
                            <td>Identify popular buttons/links and UI interactions</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-danger">rage_click</span></td>
                            <td>User clicks same element 3+ times within 2 seconds. HIGH frustration signal.</td>
                            <td>Identify broken features, confusing UI, unresponsive buttons</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-info">scroll</span></td>
                            <td>User scrolls to depth milestone (25%, 50%, 75%, 100%).</td>
                            <td>Measure content engagement and scroll depth</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-danger">error</span></td>
                            <td>JavaScript error occurred. Logs: error message & stack trace (masked).</td>
                            <td>Identify bugs affecting user experience</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-warning">unhandled_rejection</span></td>
                            <td>Promise rejection (async error). Logs: rejection reason (masked).</td>
                            <td>Catch async operation failures</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-info">visibility_change</span></td>
                            <td>User tabs away or returns to page. Logs: visible/hidden state.</td>
                            <td>Measure active engagement vs background activity</td>
                        </tr>
                        <tr>
                            <td><span class="badge bg-info">session_end</span></td>
                            <td>User closes browser/tab. Session aggregates finalized.</td>
                            <td>Mark session boundaries for analysis</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<style>
    .text-monospace {
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        font-size: 11px;
    }
    table.table-sm th {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
    }
</style>

<script>
    document.getElementById('filterBtn').addEventListener('click', function() {
        var userId = document.getElementById('userFilter').value;
        var dateFrom = document.getElementById('dateFrom').value;
        var dateTo = document.getElementById('dateTo').value;
        var eventType = document.getElementById('eventFilter').value;
        
        if (!userId) {
            alert('Please select a user');
            return;
        }
        
        window.location.href = '/admin/behavior?user_id=' + userId 
            + '&date_from=' + dateFrom 
            + '&date_to=' + dateTo 
            + (eventType ? '&event_type=' + eventType : '');
    });
</script>
