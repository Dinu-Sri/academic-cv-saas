<?php
/**
 * ApiAccessService
 * Handles analytics API key generation, verification, and rate limiting.
 */
class ApiAccessService
{
    private PDO $db;
    private SiteSetting $settingsModel;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
        $this->settingsModel = new SiteSetting();
    }

    public function generateAndStoreAnalyticsApiKey(): string
    {
        $plain = 'cvs_' . bin2hex(random_bytes(24));
        $hash = hash('sha256', $plain);
        $this->settingsModel->set('analytics_api_key_hash', $hash);
        return $plain;
    }

    public function authenticateAnalyticsKey(?string $rawKey): array
    {
        $enabled = ($this->settingsModel->get('analytics_api_enabled') ?? '1') === '1';
        if (!$enabled) {
            return ['ok' => false, 'status' => 403, 'message' => 'Analytics API is disabled by admin.'];
        }

        $storedHash = (string) ($this->settingsModel->get('analytics_api_key_hash') ?? '');
        if ($storedHash === '') {
            return ['ok' => false, 'status' => 503, 'message' => 'Analytics API key has not been generated yet.'];
        }

        $rawKey = trim((string) $rawKey);
        if ($rawKey === '') {
            return ['ok' => false, 'status' => 401, 'message' => 'Missing API key.'];
        }

        $providedHash = hash('sha256', $rawKey);
        if (!hash_equals($storedHash, $providedHash)) {
            return ['ok' => false, 'status' => 401, 'message' => 'Invalid API key.'];
        }

        $limitPerHour = (int) ($this->settingsModel->get('analytics_api_rate_limit_per_hour') ?? '240');
        $limitPerHour = max(1, min($limitPerHour, 100000));

        $rate = $this->consumeRateLimit('analytics_export', $providedHash, $limitPerHour);
        if (!$rate['allowed']) {
            return [
                'ok' => false,
                'status' => 429,
                'message' => 'Rate limit exceeded. Increase API rate limit in admin settings if needed.',
                'rate' => $rate,
            ];
        }

        return [
            'ok' => true,
            'key_hash' => $providedHash,
            'rate' => $rate,
        ];
    }

    private function consumeRateLimit(string $scope, string $keyHash, int $limit): array
    {
        $windowStart = date('Y-m-d H:00:00');
        $retryAfter = max(1, strtotime(date('Y-m-d H:59:59')) - time());

        $this->db->beginTransaction();
        try {
            $upsert = $this->db->prepare(
                "INSERT INTO api_rate_limits (api_scope, key_hash, window_start, request_count)
                 VALUES (?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE request_count = request_count + 1"
            );
            $upsert->execute([$scope, $keyHash, $windowStart]);

            $select = $this->db->prepare(
                "SELECT request_count FROM api_rate_limits WHERE api_scope = ? AND key_hash = ? AND window_start = ?"
            );
            $select->execute([$scope, $keyHash, $windowStart]);
            $count = (int) ($select->fetchColumn() ?: 0);

            $this->db->commit();

            return [
                'allowed' => $count <= $limit,
                'limit' => $limit,
                'used' => $count,
                'remaining' => max(0, $limit - $count),
                'retry_after_seconds' => $retryAfter,
            ];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            return [
                'allowed' => true,
                'limit' => $limit,
                'used' => 0,
                'remaining' => $limit,
                'retry_after_seconds' => $retryAfter,
            ];
        }
    }
}
