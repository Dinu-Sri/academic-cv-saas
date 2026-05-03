<?php
/**
 * PdfRenderMetrics
 *
 * Lightweight telemetry sink for renderer outcomes. Designed to never throw —
 * a metrics failure must not break a user's PDF download.
 *
 * Phase 6 hooks (circuit breaker, admin dashboard) will read from the
 * pdf_render_events table populated here.
 */
class PdfRenderMetrics
{
    /**
     * Record a single render outcome. Silently swallows DB errors.
     *
     * @param array{
     *     success?: bool,
     *     engine?: string,
     *     primary_engine?: string,
     *     fallback?: bool,
     *     duration_ms?: int,
     *     error?: string
     * } $result Renderer result array.
     */
    public static function record(?int $profileId, ?int $userId, array $result): void
    {
        if (!self::isDatabaseReachable()) {
            return;
        }
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare(
                "INSERT INTO pdf_render_events
                    (profile_id, user_id, engine, primary_engine, fallback, success, duration_ms, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $profileId,
                $userId,
                substr((string) ($result['engine'] ?? 'unknown'), 0, 32),
                isset($result['primary_engine']) ? substr((string) $result['primary_engine'], 0, 32) : null,
                !empty($result['fallback']) ? 1 : 0,
                !empty($result['success']) ? 1 : 0,
                (int) ($result['duration_ms'] ?? 0),
                isset($result['error']) ? substr((string) $result['error'], 0, 500) : null,
            ]);
        } catch (\Throwable $e) {
            error_log('PdfRenderMetrics: record failed: ' . $e->getMessage());
        }
    }

    /**
     * Recent failure rate for the given engine within the lookback window.
     * Returns a float between 0.0 and 1.0; returns 0.0 on any error so the
     * circuit breaker fails OPEN (i.e. allows the engine).
     */
    public static function recentFailureRate(string $engine, int $lookbackMinutes = 60): float
    {
        if (!self::isDatabaseReachable()) {
            return 0.0;
        }
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare(
                "SELECT
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
                    COUNT(*) AS total
                 FROM pdf_render_events
                 WHERE engine = ?
                   AND created_at >= (NOW() - INTERVAL ? MINUTE)"
            );
            $stmt->execute([$engine, $lookbackMinutes]);
            $row = $stmt->fetch();
            $total = (int) ($row['total'] ?? 0);
            if ($total < 10) {
                // Not enough samples to be confident. Don't trip the breaker.
                return 0.0;
            }
            return ((int) ($row['failures'] ?? 0)) / $total;
        } catch (\Throwable $e) {
            return 0.0;
        }
    }

    /**
     * Pre-flight socket probe so we never trigger the Database singleton's
     * die() when MySQL is unreachable. Cached for the request.
     */
    private static function isDatabaseReachable(): bool
    {
        static $reachable = null;
        if ($reachable !== null) {
            return $reachable;
        }
        $fp = @fsockopen(DB_HOST, (int) DB_PORT, $errno, $errstr, 0.5);
        if ($fp) {
            fclose($fp);
            return $reachable = true;
        }
        return $reachable = false;
    }
}
