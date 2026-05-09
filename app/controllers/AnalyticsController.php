<?php
/**
 * AnalyticsController
 * API endpoints for exporting analytics datasets.
 */
class AnalyticsController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function export(string $dataset): void
    {
        header('Content-Type: application/json');

        $auth = (new ApiAccessService())->authenticateAnalyticsKey($this->requestApiKey());
        if (!$auth['ok']) {
            http_response_code((int) $auth['status']);
            echo json_encode([
                'success' => false,
                'message' => $auth['message'],
                'rate_limit' => $auth['rate'] ?? null,
            ]);
            return;
        }

        $format = strtolower((string) ($_GET['format'] ?? 'json'));
        if (!in_array($format, ['json', 'csv', 'zip'], true)) {
            $format = 'json';
        }

        $allowed = ['users', 'events', 'behavior', 'sessions', 'subscriptions', 'funnel', 'performance', 'full'];
        if (!in_array($dataset, $allowed, true)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Unknown dataset.']);
            return;
        }

        try {
            if ($dataset === 'full' || $format === 'zip') {
                $this->respondZip($dataset);
                return;
            }

            $rows = $this->queryDataset($dataset);
            if ($format === 'csv') {
                $this->respondCsv($dataset, $rows);
                return;
            }

            $this->respondJson($dataset, $rows, $auth['rate']);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Export failed.']);
        }
    }

    private function queryDataset(string $dataset): array
    {
        return match ($dataset) {
            'users' => $this->datasetUsers(),
            'events' => $this->datasetUserEvents(),
            'behavior' => $this->datasetBehaviorEvents(),
            'sessions' => $this->datasetBehaviorSessions(),
            'subscriptions' => $this->datasetSubscriptions(),
            'funnel' => $this->datasetFunnel(),
            'performance' => $this->datasetPerformance(),
            default => [],
        };
    }

    /**
     * Performance diagnostics dataset.
     *
     * Returns a single-row payload with metrics and rule-based analysis so the
     * team can quickly identify likely causes of slowness in production.
     */
    private function datasetPerformance(): array
    {
        $windowHours = max(1, min(168, (int) ($_GET['window_hours'] ?? 24)));
        $windowStart = date('Y-m-d H:i:s', time() - ($windowHours * 3600));
        $generatedAt = date('Y-m-d H:i:s');

        $tables = [
            'pdf_render_events' => $this->tableExists('pdf_render_events'),
            'behavior_events' => $this->tableExists('behavior_events'),
            'cron_jobs' => $this->tableExists('cron_jobs'),
        ];

        $pdf = [
            'sample_count' => 0,
            'avg_duration_ms' => null,
            'p95_duration_ms' => null,
            'max_duration_ms' => null,
            'failure_rate_pct' => null,
            'fallback_rate_pct' => null,
            'slowest_recent' => [],
        ];
        if ($tables['pdf_render_events']) {
            $stmt = $this->db->prepare(
                "SELECT
                    COUNT(*) AS c,
                    ROUND(AVG(duration_ms), 2) AS avg_ms,
                    MAX(duration_ms) AS max_ms,
                    ROUND(100 * SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS fail_pct,
                    ROUND(100 * SUM(CASE WHEN fallback = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS fallback_pct
                 FROM pdf_render_events
                 WHERE created_at >= :from"
            );
            $stmt->execute([':from' => $windowStart]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $pdf['sample_count'] = (int) ($row['c'] ?? 0);
            $pdf['avg_duration_ms'] = $row['avg_ms'] !== null ? (float) $row['avg_ms'] : null;
            $pdf['max_duration_ms'] = $row['max_ms'] !== null ? (int) $row['max_ms'] : null;
            $pdf['failure_rate_pct'] = $row['fail_pct'] !== null ? (float) $row['fail_pct'] : null;
            $pdf['fallback_rate_pct'] = $row['fallback_pct'] !== null ? (float) $row['fallback_pct'] : null;

            $pdf['p95_duration_ms'] = $this->recentPercentile(
                "SELECT duration_ms FROM pdf_render_events
                 WHERE created_at >= :from AND duration_ms > 0
                 ORDER BY created_at DESC
                 LIMIT 5000",
                [':from' => $windowStart],
                0.95
            );

            $slowStmt = $this->db->prepare(
                "SELECT created_at, engine, duration_ms, success, fallback, error_message
                 FROM pdf_render_events
                 WHERE created_at >= :from
                 ORDER BY duration_ms DESC
                 LIMIT 10"
            );
            $slowStmt->execute([':from' => $windowStart]);
            $pdf['slowest_recent'] = $slowStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $behavior = [
            'sample_count' => 0,
            'avg_duration_ms' => null,
            'p95_duration_ms' => null,
            'js_error_count' => 0,
            'js_error_rate_pct' => null,
            'rage_click_count' => 0,
            'rage_click_rate_pct' => null,
            'top_slow_paths' => [],
        ];
        if ($tables['behavior_events']) {
            $stmt = $this->db->prepare(
                "SELECT
                    COUNT(*) AS c,
                    ROUND(AVG(NULLIF(duration_ms, 0)), 2) AS avg_ms,
                    SUM(CASE WHEN event_type = 'js_error' THEN 1 ELSE 0 END) AS js_errors,
                    SUM(CASE WHEN event_type = 'rage_click' THEN 1 ELSE 0 END) AS rage_clicks
                 FROM behavior_events
                 WHERE event_at >= :from"
            );
            $stmt->execute([':from' => $windowStart]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $total = (int) ($row['c'] ?? 0);
            $jsErrors = (int) ($row['js_errors'] ?? 0);
            $rageClicks = (int) ($row['rage_clicks'] ?? 0);

            $behavior['sample_count'] = $total;
            $behavior['avg_duration_ms'] = $row['avg_ms'] !== null ? (float) $row['avg_ms'] : null;
            $behavior['js_error_count'] = $jsErrors;
            $behavior['rage_click_count'] = $rageClicks;
            $behavior['js_error_rate_pct'] = $total > 0 ? round(($jsErrors / $total) * 100, 2) : null;
            $behavior['rage_click_rate_pct'] = $total > 0 ? round(($rageClicks / $total) * 100, 2) : null;

            $behavior['p95_duration_ms'] = $this->recentPercentile(
                "SELECT duration_ms FROM behavior_events
                 WHERE event_at >= :from AND duration_ms > 0
                 ORDER BY event_at DESC
                 LIMIT 5000",
                [':from' => $windowStart],
                0.95
            );

            $pathsStmt = $this->db->prepare(
                "SELECT path,
                        COUNT(*) AS event_count,
                        ROUND(AVG(duration_ms), 2) AS avg_duration_ms,
                        MAX(duration_ms) AS max_duration_ms
                 FROM behavior_events
                 WHERE event_at >= :from
                   AND duration_ms IS NOT NULL
                   AND duration_ms > 0
                   AND path IS NOT NULL
                   AND path <> ''
                 GROUP BY path
                 HAVING COUNT(*) >= 5
                 ORDER BY avg_duration_ms DESC
                 LIMIT 10"
            );
            $pathsStmt->execute([':from' => $windowStart]);
            $behavior['top_slow_paths'] = $pathsStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $cron = [
            'enabled_count' => 0,
            'failed_count' => 0,
            'never_ran_count' => 0,
            'stale_count' => 0,
            'failed_jobs' => [],
        ];
        if ($tables['cron_jobs']) {
            $stmt = $this->db->query(
                "SELECT
                    SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabled_count,
                    SUM(CASE WHEN is_enabled = 1 AND last_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                    SUM(CASE WHEN is_enabled = 1 AND last_run_at IS NULL THEN 1 ELSE 0 END) AS never_ran_count,
                    SUM(CASE WHEN is_enabled = 1 AND (last_run_at IS NULL OR last_run_at < DATE_SUB(NOW(), INTERVAL 50 HOUR)) THEN 1 ELSE 0 END) AS stale_count
                 FROM cron_jobs"
            );
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $cron['enabled_count'] = (int) ($row['enabled_count'] ?? 0);
            $cron['failed_count'] = (int) ($row['failed_count'] ?? 0);
            $cron['never_ran_count'] = (int) ($row['never_ran_count'] ?? 0);
            $cron['stale_count'] = (int) ($row['stale_count'] ?? 0);

            $failedStmt = $this->db->query(
                "SELECT job_key, label, schedule, last_run_at, last_status, last_output
                 FROM cron_jobs
                 WHERE is_enabled = 1 AND last_status = 'failed'
                 ORDER BY last_run_at DESC
                 LIMIT 10"
            );
            $cron['failed_jobs'] = $failedStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $server = $this->collectServerMetrics();
        $findings = $this->buildPerformanceFindings($tables, $pdf, $behavior, $cron, $server);

        return [[
            'generated_at' => $generatedAt,
            'window_hours' => $windowHours,
            'window_start' => $windowStart,
            'table_availability' => $tables,
            'metrics' => [
                'pdf' => $pdf,
                'behavior' => $behavior,
                'cron' => $cron,
                'server' => $server,
            ],
            'analysis' => $findings,
        ]];
    }

    private function datasetUsers(): array
    {
        $sql = "SELECT u.id, u.email, u.username, u.subscription_plan, u.is_active, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM cv_profiles cp WHERE cp.user_id = u.id) AS cv_count
                FROM users u
                ORDER BY u.created_at DESC";
        return $this->paginateQuery($sql, []);
    }

    private function datasetUserEvents(): array
    {
        [$where, $params] = $this->commonFilters('ue.created_at', 'ue.user_id');

        if (!empty($_GET['event_key'])) {
            $where[] = 'ue.event_key = :event_key';
            $params[':event_key'] = substr((string) $_GET['event_key'], 0, 100);
        }

        $sql = "SELECT ue.id, ue.user_id, u.email, ue.event_key, ue.metadata, ue.created_at
                FROM user_events ue
                LEFT JOIN users u ON u.id = ue.user_id";

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY ue.created_at DESC';

        return $this->paginateQuery($sql, $params);
    }

    private function datasetBehaviorEvents(): array
    {
        [$where, $params] = $this->commonFilters('be.event_at', 'be.user_id');

        if (!empty($_GET['event_type'])) {
            $where[] = 'be.event_type = :event_type';
            $params[':event_type'] = substr((string) $_GET['event_type'], 0, 50);
        }

        $sql = "SELECT be.id, be.user_id, u.email, be.session_id, be.event_type, be.path, be.selector,
                be.duration_ms, be.scroll_depth, be.frustration_score, be.metadata, be.event_at
                FROM behavior_events be
                LEFT JOIN users u ON u.id = be.user_id";

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY be.event_at DESC';

        return $this->paginateQuery($sql, $params);
    }

    private function datasetBehaviorSessions(): array
    {
        [$where, $params] = $this->commonFilters('bs.started_at', 'bs.user_id');

        $sql = "SELECT bs.id, bs.session_id, bs.user_id, u.email, bs.started_at, bs.last_event_at,
                bs.pageviews, bs.total_events, bs.last_path, bs.user_agent
                FROM behavior_sessions bs
                LEFT JOIN users u ON u.id = bs.user_id";

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY bs.started_at DESC';

        return $this->paginateQuery($sql, $params);
    }

    private function datasetSubscriptions(): array
    {
        [$where, $params] = $this->commonFilters('s.created_at', 's.user_id');

        $sql = "SELECT s.id, s.user_id, u.email, s.plan, s.billing_cycle, s.price_cents, s.status, s.starts_at, s.expires_at,
                p.id AS payment_id, p.amount AS payment_amount, p.currency AS payment_currency, p.status AS payment_status, p.created_at AS payment_created_at
                FROM subscriptions s
                LEFT JOIN users u ON u.id = s.user_id
                LEFT JOIN payments p ON p.user_id = s.user_id AND p.subscription_plan = s.plan";

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY s.created_at DESC';

        return $this->paginateQuery($sql, $params);
    }

    private function datasetFunnel(): array
    {
        $from = trim((string) ($_GET['from'] ?? ''));
        $to = trim((string) ($_GET['to'] ?? ''));

        $dateSqlUsers = '';
        $dateSqlEvents = '';
        $params = [];

        if ($from !== '') {
            $dateSqlUsers .= ' AND u.created_at >= :from';
            $dateSqlEvents .= ' AND created_at >= :from';
            $params[':from'] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $dateSqlUsers .= ' AND u.created_at <= :to';
            $dateSqlEvents .= ' AND created_at <= :to';
            $params[':to'] = $to . ' 23:59:59';
        }

        $registered = (int) $this->singleValue("SELECT COUNT(*) FROM users u WHERE 1=1 $dateSqlUsers", $params);
        $firstCv = (int) $this->singleValue("SELECT COUNT(DISTINCT user_id) FROM cv_profiles WHERE 1=1" . str_replace('u.', '', $dateSqlUsers), $params);
        $pricingView = (int) $this->singleValue("SELECT COUNT(DISTINCT user_id) FROM behavior_events WHERE event_type = 'pricing_view' $dateSqlEvents", $params);
        $checkoutStarted = (int) $this->singleValue("SELECT COUNT(DISTINCT user_id) FROM user_events WHERE event_key = 'plan_checkout_started' $dateSqlEvents", $params);
        $paymentCompleted = (int) $this->singleValue("SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'completed'" . str_replace('u.created_at', 'created_at', $dateSqlUsers), $params);

        $step = function (int $value, int $prev): array {
            $conversion = $prev > 0 ? round(($value / $prev) * 100, 2) : 0.0;
            $dropoff = $prev > 0 ? round((1 - ($value / $prev)) * 100, 2) : 0.0;
            return ['count' => $value, 'conversion_from_prev_pct' => $conversion, 'dropoff_from_prev_pct' => $dropoff];
        };

        return [[
            'registered' => ['count' => $registered, 'conversion_from_prev_pct' => 100.0, 'dropoff_from_prev_pct' => 0.0],
            'first_cv_created' => $step($firstCv, $registered),
            'pricing_viewed' => $step($pricingView, $firstCv),
            'checkout_started' => $step($checkoutStarted, $pricingView),
            'payment_completed' => $step($paymentCompleted, $checkoutStarted),
        ]];
    }

    private function commonFilters(string $dateField, string $userField): array
    {
        $where = [];
        $params = [];

        $from = trim((string) ($_GET['from'] ?? ''));
        $to = trim((string) ($_GET['to'] ?? ''));
        $userId = (int) ($_GET['user_id'] ?? 0);

        if ($from !== '') {
            $where[] = "$dateField >= :from";
            $params[':from'] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $where[] = "$dateField <= :to";
            $params[':to'] = $to . ' 23:59:59';
        }
        if ($userId > 0) {
            $where[] = "$userField = :user_id";
            $params[':user_id'] = $userId;
        }

        return [$where, $params];
    }

    private function paginateQuery(string $sql, array $params): array
    {
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = max(1, min(5000, (int) ($_GET['limit'] ?? 1000)));
        $offset = ($page - 1) * $limit;

        $sql .= ' LIMIT :limit OFFSET :offset';
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function singleValue(string $sql, array $params): mixed
    {
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        return $stmt->fetchColumn();
    }

    private function tableExists(string $table): bool
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            return false;
        }

        $stmt = $this->db->prepare('SHOW TABLES LIKE :table');
        $stmt->execute([':table' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private function recentPercentile(string $sql, array $params, float $percentile): ?int
    {
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();

        $values = [];
        while (($value = $stmt->fetchColumn()) !== false) {
            $values[] = (int) $value;
        }

        if (empty($values)) {
            return null;
        }

        sort($values);
        $index = (int) floor((count($values) - 1) * max(0.0, min(1.0, $percentile)));
        return $values[$index] ?? end($values) ?: null;
    }

    private function buildPerformanceFindings(array $tables, array $pdf, array $behavior, array $cron, array $server): array
    {
        $issues = [];
        $recommendations = [];

        $disk = $server['disk'] ?? [];
        if (isset($disk['storage_free_pct']) && $disk['storage_free_pct'] !== null && $disk['storage_free_pct'] < 10.0) {
            $issues[] = [
                'severity' => 'high',
                'area' => 'server_storage',
                'title' => 'Low free storage on app volume',
                'signal' => 'storage_free_pct=' . (string) $disk['storage_free_pct'],
                'likely_impact' => 'Low disk can cause slow writes, failed temp-file operations, and degraded compile/export performance',
            ];
            $recommendations[] = 'Free disk space or increase volume size for storage and temp paths.';
        }

        $memory = $server['memory'] ?? [];
        if (isset($memory['used_pct']) && $memory['used_pct'] !== null && $memory['used_pct'] >= 90.0) {
            $issues[] = [
                'severity' => 'high',
                'area' => 'server_memory',
                'title' => 'Server memory pressure is high',
                'signal' => 'memory_used_pct=' . (string) $memory['used_pct'],
                'likely_impact' => 'High memory pressure can cause swapping, request slowdowns, and unstable response times',
            ];
            $recommendations[] = 'Increase container/host memory limits or reduce concurrent heavy operations (for example PDF compiles).';
        }

        if (isset($memory['cgroup_used_pct']) && $memory['cgroup_used_pct'] !== null && $memory['cgroup_used_pct'] >= 90.0) {
            $issues[] = [
                'severity' => 'high',
                'area' => 'container_memory',
                'title' => 'Container memory usage is near cgroup limit',
                'signal' => 'cgroup_used_pct=' . (string) $memory['cgroup_used_pct'],
                'likely_impact' => 'Container can throttle or OOM-kill processes, creating intermittent slowness and failures',
            ];
            $recommendations[] = 'Raise container memory limit in Portainer or optimize peak memory paths.';
        }

        $io = $server['io_probe'] ?? [];
        if (($io['status'] ?? '') === 'ok') {
            $writeMs = isset($io['write_ms']) ? (float) $io['write_ms'] : null;
            $readMs = isset($io['read_ms']) ? (float) $io['read_ms'] : null;

            if (($writeMs !== null && $writeMs >= 250.0) || ($readMs !== null && $readMs >= 150.0)) {
                $issues[] = [
                    'severity' => 'medium',
                    'area' => 'server_io',
                    'title' => 'I/O probe indicates slower-than-expected disk operations',
                    'signal' => 'write_ms=' . (string) ($writeMs ?? '') . ', read_ms=' . (string) ($readMs ?? ''),
                    'likely_impact' => 'File-heavy paths (PDF compile, logs, exports) may feel slow',
                ];
                $recommendations[] = 'Investigate volume performance on host/storage driver and reduce disk-heavy bursts.';
            }
        }

        if (!$tables['pdf_render_events']) {
            $issues[] = [
                'severity' => 'medium',
                'area' => 'telemetry',
                'title' => 'PDF render telemetry table missing',
                'signal' => 'pdf_render_events not found',
                'likely_impact' => 'Cannot measure compile latency/failure trend on live traffic',
            ];
            $recommendations[] = 'Ensure migration 030 is applied so pdf_render_events is available.';
        }

        if ($pdf['sample_count'] > 0) {
            if (($pdf['avg_duration_ms'] ?? 0) >= 8000) {
                $issues[] = [
                    'severity' => 'high',
                    'area' => 'pdf_compile',
                    'title' => 'Average PDF compile time is high',
                    'signal' => 'avg_duration_ms=' . (string) $pdf['avg_duration_ms'],
                    'likely_impact' => 'Users feel PDF generation is slow and may abandon compile/download flow',
                ];
                $recommendations[] = 'Inspect xelatex runtime, fonts, and template complexity; check host CPU pressure during compile spikes.';
            }

            if (($pdf['failure_rate_pct'] ?? 0) >= 10.0) {
                $issues[] = [
                    'severity' => 'high',
                    'area' => 'pdf_compile',
                    'title' => 'PDF compile failure rate is elevated',
                    'signal' => 'failure_rate_pct=' . (string) $pdf['failure_rate_pct'],
                    'likely_impact' => 'Retries and failed downloads increase perceived slowness and support load',
                ];
                $recommendations[] = 'Review recent error_message values in slowest_recent and fix recurring LaTeX input/template issues.';
            }

            if (($pdf['p95_duration_ms'] ?? 0) >= 12000) {
                $issues[] = [
                    'severity' => 'medium',
                    'area' => 'pdf_compile',
                    'title' => 'Tail PDF latency is high',
                    'signal' => 'p95_duration_ms=' . (string) $pdf['p95_duration_ms'],
                    'likely_impact' => 'A subset of users experience very slow responses despite acceptable average latency',
                ];
            }
        }

        if (!$tables['behavior_events']) {
            $issues[] = [
                'severity' => 'medium',
                'area' => 'telemetry',
                'title' => 'Behavior telemetry table missing',
                'signal' => 'behavior_events not found',
                'likely_impact' => 'Unable to detect frontend friction, JS errors, or rage-click spikes',
            ];
            $recommendations[] = 'Ensure behavior tracking migrations are applied and /api/behavior/track is active in production.';
        }

        if ($behavior['sample_count'] > 0) {
            if (($behavior['js_error_rate_pct'] ?? 0) >= 2.0) {
                $issues[] = [
                    'severity' => 'high',
                    'area' => 'frontend',
                    'title' => 'JS error rate is elevated',
                    'signal' => 'js_error_rate_pct=' . (string) $behavior['js_error_rate_pct'],
                    'likely_impact' => 'Client errors can block saves/compile actions and feel like server slowness',
                ];
                $recommendations[] = 'Inspect top js_error events and deploy a hotfix for the most frequent failing path.';
            }

            if (($behavior['rage_click_rate_pct'] ?? 0) >= 1.0) {
                $issues[] = [
                    'severity' => 'medium',
                    'area' => 'ux',
                    'title' => 'Rage-click rate indicates interaction friction',
                    'signal' => 'rage_click_rate_pct=' . (string) $behavior['rage_click_rate_pct'],
                    'likely_impact' => 'Users repeatedly click unresponsive controls, perceived as slowness',
                ];
            }

            if (($behavior['p95_duration_ms'] ?? 0) >= 8000) {
                $issues[] = [
                    'severity' => 'medium',
                    'area' => 'frontend_latency',
                    'title' => 'High tail latency in behavior events',
                    'signal' => 'p95_duration_ms=' . (string) $behavior['p95_duration_ms'],
                    'likely_impact' => 'Intermittent long waits on key pages',
                ];
            }
        }

        if (!$tables['cron_jobs']) {
            $issues[] = [
                'severity' => 'low',
                'area' => 'telemetry',
                'title' => 'Cron registry table missing',
                'signal' => 'cron_jobs not found',
                'likely_impact' => 'Background task failures may go unnoticed',
            ];
        }

        if ($cron['failed_count'] > 0) {
            $issues[] = [
                'severity' => 'high',
                'area' => 'background_jobs',
                'title' => 'One or more enabled cron jobs are failing',
                'signal' => 'failed_count=' . (string) $cron['failed_count'],
                'likely_impact' => 'Operational backlog, delayed workflows, and error noise affecting overall UX',
            ];
            $recommendations[] = 'Check cron last_output and storage/logs/cron.log for failing jobs, then redeploy after fixes.';
        }

        if ($cron['stale_count'] > 0) {
            $issues[] = [
                'severity' => 'medium',
                'area' => 'background_jobs',
                'title' => 'Some enabled cron jobs appear stale',
                'signal' => 'stale_count=' . (string) $cron['stale_count'],
                'likely_impact' => 'Scheduled maintenance or reliability checks may not be running',
            ];
        }

        if (empty($recommendations)) {
            $recommendations[] = 'No obvious hotspot detected in the selected window; increase window_hours or inspect container CPU/memory and MySQL slow query log.';
        }

        return [
            'summary' => [
                'status' => empty($issues) ? 'healthy' : 'attention_needed',
                'issue_count' => count($issues),
                'highest_severity' => $this->highestSeverity($issues),
            ],
            'issues' => $issues,
            'recommended_actions' => array_values(array_unique($recommendations)),
        ];
    }

    private function collectServerMetrics(): array
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : sys_get_temp_dir();
        $rootPath = DIRECTORY_SEPARATOR;

        $disk = [
            'storage_path' => $storagePath,
            'storage_total_bytes' => null,
            'storage_free_bytes' => null,
            'storage_free_pct' => null,
            'root_total_bytes' => null,
            'root_free_bytes' => null,
            'root_free_pct' => null,
        ];

        $storageTotal = @disk_total_space($storagePath);
        $storageFree = @disk_free_space($storagePath);
        if ($storageTotal !== false && $storageFree !== false && $storageTotal > 0) {
            $disk['storage_total_bytes'] = (int) $storageTotal;
            $disk['storage_free_bytes'] = (int) $storageFree;
            $disk['storage_free_pct'] = round(((float) $storageFree / (float) $storageTotal) * 100, 2);
        }

        $rootTotal = @disk_total_space($rootPath);
        $rootFree = @disk_free_space($rootPath);
        if ($rootTotal !== false && $rootFree !== false && $rootTotal > 0) {
            $disk['root_total_bytes'] = (int) $rootTotal;
            $disk['root_free_bytes'] = (int) $rootFree;
            $disk['root_free_pct'] = round(((float) $rootFree / (float) $rootTotal) * 100, 2);
        }

        $memory = [
            'source' => 'unknown',
            'total_bytes' => null,
            'available_bytes' => null,
            'used_pct' => null,
            'cgroup_limit_bytes' => null,
            'cgroup_current_bytes' => null,
            'cgroup_used_pct' => null,
        ];

        $memInfo = $this->readProcMeminfo();
        if (!empty($memInfo['MemTotal']) && !empty($memInfo['MemAvailable'])) {
            $total = (int) $memInfo['MemTotal'];
            $available = (int) $memInfo['MemAvailable'];
            if ($total > 0) {
                $memory['source'] = 'proc_meminfo';
                $memory['total_bytes'] = $total;
                $memory['available_bytes'] = $available;
                $memory['used_pct'] = round((1 - ($available / $total)) * 100, 2);
            }
        }

        $cgLimit = $this->readCgroupBytes([
            '/sys/fs/cgroup/memory.max',
            '/sys/fs/cgroup/memory/memory.limit_in_bytes',
        ]);
        $cgCurrent = $this->readCgroupBytes([
            '/sys/fs/cgroup/memory.current',
            '/sys/fs/cgroup/memory/memory.usage_in_bytes',
        ]);

        if ($cgLimit !== null) {
            $memory['cgroup_limit_bytes'] = $cgLimit;
        }
        if ($cgCurrent !== null) {
            $memory['cgroup_current_bytes'] = $cgCurrent;
        }
        if ($cgLimit !== null && $cgCurrent !== null && $cgLimit > 0) {
            $memory['cgroup_used_pct'] = round(($cgCurrent / $cgLimit) * 100, 2);
        }

        $loadRaw = @sys_getloadavg();
        $load = [
            'one_min' => null,
            'five_min' => null,
            'fifteen_min' => null,
            'cpu_count' => null,
            'one_min_per_cpu' => null,
        ];
        if (is_array($loadRaw) && count($loadRaw) >= 3) {
            $load['one_min'] = (float) $loadRaw[0];
            $load['five_min'] = (float) $loadRaw[1];
            $load['fifteen_min'] = (float) $loadRaw[2];
        }
        $cpuCount = $this->detectCpuCount();
        if ($cpuCount !== null && $cpuCount > 0) {
            $load['cpu_count'] = $cpuCount;
            if ($load['one_min'] !== null) {
                $load['one_min_per_cpu'] = round($load['one_min'] / $cpuCount, 2);
            }
        }

        return [
            'captured_at' => date('Y-m-d H:i:s'),
            'hostname' => gethostname() ?: null,
            'php_sapi' => PHP_SAPI,
            'disk' => $disk,
            'memory' => $memory,
            'load' => $load,
            'io_probe' => $this->runIoProbe($storagePath),
        ];
    }

    private function runIoProbe(string $basePath): array
    {
        $dir = rtrim($basePath, '/\\') . '/temp';
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            return [
                'status' => 'error',
                'error' => 'Cannot create temp probe directory',
            ];
        }

        $file = $dir . '/io_probe_' . bin2hex(random_bytes(4)) . '.bin';
        $bytes = 1024 * 1024;
        $payload = str_repeat('a', $bytes);

        $writeStart = microtime(true);
        $written = @file_put_contents($file, $payload, LOCK_EX);
        $writeMs = (microtime(true) - $writeStart) * 1000;
        if ($written === false || $written !== $bytes) {
            @unlink($file);
            return [
                'status' => 'error',
                'error' => 'Write probe failed',
                'write_ms' => round($writeMs, 2),
            ];
        }

        $readStart = microtime(true);
        $data = @file_get_contents($file);
        $readMs = (microtime(true) - $readStart) * 1000;

        $deleteStart = microtime(true);
        @unlink($file);
        $deleteMs = (microtime(true) - $deleteStart) * 1000;

        if ($data === false || strlen($data) !== $bytes) {
            return [
                'status' => 'error',
                'error' => 'Read probe failed',
                'write_ms' => round($writeMs, 2),
                'read_ms' => round($readMs, 2),
                'delete_ms' => round($deleteMs, 2),
            ];
        }

        return [
            'status' => 'ok',
            'bytes' => $bytes,
            'write_ms' => round($writeMs, 2),
            'read_ms' => round($readMs, 2),
            'delete_ms' => round($deleteMs, 2),
        ];
    }

    private function readProcMeminfo(): array
    {
        $path = '/proc/meminfo';
        if (!is_readable($path)) {
            return [];
        }

        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return [];
        }

        $out = [];
        foreach ($lines as $line) {
            if (preg_match('/^([A-Za-z_()]+):\s+([0-9]+)\s+kB$/', $line, $m)) {
                $out[$m[1]] = (int) $m[2] * 1024;
            }
        }

        return $out;
    }

    private function readCgroupBytes(array $paths): ?int
    {
        foreach ($paths as $path) {
            if (!is_readable($path)) {
                continue;
            }

            $raw = trim((string) @file_get_contents($path));
            if ($raw === '' || $raw === 'max' || !ctype_digit($raw)) {
                continue;
            }

            $value = (int) $raw;
            if ($value <= 0 || $value >= 9223372036854771712) {
                // Treat gigantic limits as effectively unlimited.
                continue;
            }

            return $value;
        }

        return null;
    }

    private function detectCpuCount(): ?int
    {
        $count = (int) ($_SERVER['NUMBER_OF_PROCESSORS'] ?? 0);
        if ($count > 0) {
            return $count;
        }

        $cpuinfo = '/proc/cpuinfo';
        if (is_readable($cpuinfo)) {
            $content = (string) @file_get_contents($cpuinfo);
            if ($content !== '') {
                $matches = [];
                preg_match_all('/^processor\s*:/m', $content, $matches);
                $detected = count($matches[0] ?? []);
                if ($detected > 0) {
                    return $detected;
                }
            }
        }

        return null;
    }

    private function highestSeverity(array $issues): string
    {
        if (empty($issues)) {
            return 'none';
        }

        $score = ['low' => 1, 'medium' => 2, 'high' => 3];
        $max = 'low';
        foreach ($issues as $issue) {
            $severity = (string) ($issue['severity'] ?? 'low');
            if (($score[$severity] ?? 0) > ($score[$max] ?? 0)) {
                $max = $severity;
            }
        }
        return $max;
    }

    private function requestApiKey(): string
    {
        $header = (string) ($_SERVER['HTTP_X_API_KEY'] ?? '');
        if ($header !== '') {
            return $header;
        }

        $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
            return trim((string) $m[1]);
        }

        return '';
    }

    private function respondJson(string $dataset, array $rows, array $rate): void
    {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'dataset' => $dataset,
            'count' => count($rows),
            'rate_limit' => $rate,
            'data' => $rows,
        ], JSON_UNESCAPED_SLASHES);
    }

    private function respondCsv(string $dataset, array $rows): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="analytics_' . $dataset . '_' . date('Ymd_His') . '.csv"');

        $out = fopen('php://output', 'w');
        if (empty($rows)) {
            fputcsv($out, ['message']);
            fputcsv($out, ['No data']);
            fclose($out);
            return;
        }

        $headers = array_keys($rows[0]);
        fputcsv($out, $headers);

        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $h) {
                $value = $row[$h] ?? null;
                if (is_array($value)) {
                    $line[] = json_encode($value, JSON_UNESCAPED_SLASHES);
                } else {
                    $line[] = $value;
                }
            }
            fputcsv($out, $line);
        }

        fclose($out);
    }

    private function respondZip(string $dataset): void
    {
        if (!class_exists('ZipArchive')) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'ZipArchive extension is not available.']);
            return;
        }

        $datasets = $dataset === 'full'
            ? ['users', 'events', 'behavior', 'sessions', 'subscriptions', 'funnel', 'performance']
            : [$dataset];

        $tmpFile = tempnam(sys_get_temp_dir(), 'cvscholar_zip_');
        if ($tmpFile === false) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to create temporary zip file.']);
            return;
        }

        $zip = new ZipArchive();
        $opened = $zip->open($tmpFile, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        if ($opened !== true) {
            @unlink($tmpFile);
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to initialize zip archive.']);
            return;
        }

        foreach ($datasets as $name) {
            $rows = $this->queryDataset($name);
            $zip->addFromString($name . '.json', json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            $zip->addFromString($name . '.csv', $this->csvString($rows));
        }

        $zip->addFromString('README.txt', "CVScholar Analytics Export\nGenerated: " . date('Y-m-d H:i:s') . "\nDatasets: " . implode(', ', $datasets) . "\n");
        $zip->close();

        $filename = 'analytics_' . $dataset . '_' . date('Ymd_His') . '.zip';
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($tmpFile));
        readfile($tmpFile);
        @unlink($tmpFile);
    }

    private function csvString(array $rows): string
    {
        $fh = fopen('php://temp', 'r+');
        if (empty($rows)) {
            fputcsv($fh, ['message']);
            fputcsv($fh, ['No data']);
        } else {
            $headers = array_keys($rows[0]);
            fputcsv($fh, $headers);
            foreach ($rows as $row) {
                $line = [];
                foreach ($headers as $h) {
                    $value = $row[$h] ?? null;
                    $line[] = is_array($value) ? json_encode($value, JSON_UNESCAPED_SLASHES) : $value;
                }
                fputcsv($fh, $line);
            }
        }
        rewind($fh);
        $csv = stream_get_contents($fh) ?: '';
        fclose($fh);
        return $csv;
    }
}
