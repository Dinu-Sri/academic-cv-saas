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

        $allowed = ['users', 'events', 'behavior', 'sessions', 'subscriptions', 'funnel', 'full'];
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
            default => [],
        };
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
            ? ['users', 'events', 'behavior', 'sessions', 'subscriptions', 'funnel']
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
