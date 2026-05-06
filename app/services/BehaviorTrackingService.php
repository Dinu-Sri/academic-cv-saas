<?php
/**
 * BehaviorTrackingService
 * Stores detailed user interaction timeline events in a non-blocking way.
 */
class BehaviorTrackingService
{
    private PDO $db;
    private SiteSetting $settingsModel;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
        $this->settingsModel = new SiteSetting();
    }

    public function ingestBatch(int $userId, string $sessionId, array $events, array $context = []): int
    {
        if (empty($events)) {
            return 0;
        }

        $samplingRate = $this->getSamplingRate();
        if ($samplingRate < 100) {
            $rand = random_int(1, 100);
            if ($rand > $samplingRate) {
                return 0;
            }
        }

        $now = date('Y-m-d H:i:s');
        $ipHash = $this->getClientIpHash();
        $userAgent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
        $defaultPath = $this->normalizePath((string) ($context['path'] ?? ''));

        $pageviewCount = 0;
        $inserted = 0;

        $insertStmt = $this->db->prepare(
            "INSERT INTO behavior_events (user_id, session_id, event_type, path, selector, duration_ms, scroll_depth, frustration_score, metadata, event_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }

            $normalized = $this->normalizeEvent($event, $defaultPath, $now);
            if ($normalized === null) {
                continue;
            }

            if ($normalized['event_type'] === 'page_view') {
                $pageviewCount++;
            }

            $insertStmt->execute([
                $userId,
                $sessionId,
                $normalized['event_type'],
                $normalized['path'],
                $normalized['selector'],
                $normalized['duration_ms'],
                $normalized['scroll_depth'],
                $normalized['frustration_score'],
                $normalized['metadata'],
                $normalized['event_at'],
            ]);

            $inserted++;
        }

        if ($inserted > 0) {
            $this->upsertSession($userId, $sessionId, $now, $defaultPath, $userAgent, $ipHash, $inserted, $pageviewCount);
            $this->forwardSignalEventsToPostHog($userId, $sessionId, $events, $defaultPath);
        }

        return $inserted;
    }

    /**
     * Forward high-signal behavior events to PostHog.
     * We send only the events that are meaningful for product analytics;
     * low-level scroll / focus events are kept local-only to avoid noise.
     */
    private function forwardSignalEventsToPostHog(int $userId, string $sessionId, array $events, string $defaultPath): void
    {
        if (!defined('POSTHOG_ENABLED') || !POSTHOG_ENABLED) {
            return;
        }

        $ip = $this->getClientIp();
        $ipHash = $ip !== '' ? hash('sha256', $ip . '|' . JWT_SECRET) : null;
        $countryCode = strtoupper(trim((string) ($_SERVER['HTTP_CF_IPCOUNTRY'] ?? $_SERVER['HTTP_X_COUNTRY_CODE'] ?? '')));
        if (!preg_match('/^[A-Z]{2}$/', $countryCode)) {
            $countryCode = '';
        }
        $countryName = $countryCode !== '' ? $this->countryNameFromCode($countryCode) : null;

        $highSignal = [
            'page_view', 'page_leave', 'rage_click', 'dead_click',
            'form_start', 'form_submit', 'form_abandon',
            'js_error', 'unhandled_rejection',
            'pricing_view', 'pricing_click_plan', 'cv_template_change',
        ];

        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }

            $eventType = strtolower(trim((string) ($event['event_type'] ?? '')));
            if (!in_array($eventType, $highSignal, true)) {
                continue;
            }

            $path = $this->normalizePath((string) ($event['path'] ?? $defaultPath));

            try {
                $payload = [
                    'api_key'    => POSTHOG_API_KEY,
                    'event'      => 'behavior_' . $eventType,
                    'properties' => [
                        'distinct_id'       => (string)$userId,
                        'session_id'        => $sessionId,
                        'path'              => $path,
                        'selector'          => $event['selector'] ?? null,
                        'frustration_score' => $event['frustration_score'] ?? 0,
                        'scroll_depth'      => $event['scroll_depth'] ?? null,
                        'country_code'      => $countryCode !== '' ? $countryCode : null,
                        'country_name'      => $countryName,
                        'ip_hash'           => $ipHash,
                        'client_ip_present' => $ip !== '',
                        'app_name'          => APP_NAME,
                        'app_env'           => APP_ENV,
                    ],
                    'timestamp'  => date('c'),
                ];

                if (defined('POSTHOG_SEND_CLIENT_IP') && POSTHOG_SEND_CLIENT_IP && $ip !== '') {
                    $payload['properties']['$ip'] = $ip;
                }

                $context = stream_context_create([
                    'http' => [
                        'method'        => 'POST',
                        'header'        => 'Content-Type: application/json',
                        'content'       => json_encode($payload),
                        'timeout'       => 3,
                        'ignore_errors' => true,
                    ]
                ]);
                @file_get_contents(POSTHOG_API_URL . '/capture/', false, $context);
            } catch (\Throwable $e) {
                // Never block tracking
            }
        }
    }

    private function upsertSession(
        int $userId,
        string $sessionId,
        string $now,
        string $lastPath,
        string $userAgent,
        ?string $ipHash,
        int $eventCount,
        int $pageviewCount
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO behavior_sessions (session_id, user_id, started_at, last_event_at, pageviews, total_events, last_path, user_agent, ip_hash, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                last_event_at = VALUES(last_event_at),
                pageviews = pageviews + VALUES(pageviews),
                total_events = total_events + VALUES(total_events),
                last_path = VALUES(last_path),
                user_agent = VALUES(user_agent),
                ip_hash = VALUES(ip_hash)"
        );
        $stmt->execute([
            $sessionId,
            $userId,
            $now,
            $now,
            $pageviewCount,
            $eventCount,
            $lastPath,
            $userAgent,
            $ipHash,
            null,
        ]);
    }

    private function normalizeEvent(array $event, string $defaultPath, string $fallbackNow): ?array
    {
        $allowedTypes = [
            'page_view',
            'page_leave',
            'click',
            'scroll_depth',
            'rage_click',
            'dead_click',
            'focus',
            'field_focus',
            'field_fill',
            'field_blur',
            'form_start',
            'form_submit',
            'form_abandon',
            'blur',
            'navigation',
            'pricing_view',
            'pricing_click_plan',
            'cv_template_change',
            'js_error',
            'unhandled_rejection',
        ];

        $eventType = strtolower(trim((string) ($event['event_type'] ?? '')));
        if (!in_array($eventType, $allowedTypes, true)) {
            return null;
        }

        $path = $this->normalizePath((string) ($event['path'] ?? $defaultPath));
        $selector = $this->sanitizeText((string) ($event['selector'] ?? ''), 255);
        $duration = isset($event['duration_ms']) ? max(0, min((int) $event['duration_ms'], 86400000)) : null;
        $scrollDepth = isset($event['scroll_depth']) ? max(0, min((int) $event['scroll_depth'], 100)) : null;
        $frustration = isset($event['frustration_score']) ? max(0, min((int) $event['frustration_score'], 10)) : 0;

        $eventAt = $fallbackNow;
        if (isset($event['event_at_ms']) && is_numeric($event['event_at_ms'])) {
            $ts = (int) floor(((int) $event['event_at_ms']) / 1000);
            if ($ts > 0) {
                $eventAt = date('Y-m-d H:i:s', $ts);
            }
        }

        $metadata = isset($event['metadata']) && is_array($event['metadata'])
            ? json_encode($this->maskMetadata($event['metadata']), JSON_UNESCAPED_SLASHES)
            : null;

        return [
            'event_type' => $eventType,
            'path' => $path,
            'selector' => $selector !== '' ? $selector : null,
            'duration_ms' => $duration,
            'scroll_depth' => $scrollDepth,
            'frustration_score' => $frustration,
            'metadata' => $metadata,
            'event_at' => $eventAt,
        ];
    }

    private function normalizePath(string $path): string
    {
        $path = trim($path);
        if ($path === '') {
            return '/';
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            $parsedPath = parse_url($path, PHP_URL_PATH) ?: '/';
            $parsedQuery = parse_url($path, PHP_URL_QUERY);
            $path = $parsedQuery ? ($parsedPath . '?' . $parsedQuery) : $parsedPath;
        }

        $path = preg_replace('/\s+/', '', $path) ?: '/';
        if (!str_starts_with($path, '/')) {
            $path = '/' . $path;
        }

        return substr($path, 0, 255);
    }

    private function sanitizeText(string $value, int $maxLen): string
    {
        $value = preg_replace('/[\r\n\t]+/', ' ', $value) ?? '';
        $value = trim($value);
        return substr($value, 0, $maxLen);
    }

    private function maskMetadata(array $data): array
    {
        $masked = [];
        foreach ($data as $key => $value) {
            $keyStr = strtolower((string) $key);
            $isSensitive = preg_match('/password|pass|token|secret|email|value|input/', $keyStr) === 1;

            if ($isSensitive) {
                $masked[$key] = '[masked]';
                continue;
            }

            if (is_array($value)) {
                $masked[$key] = $this->maskMetadata($value);
            } elseif (is_string($value)) {
                $masked[$key] = $this->sanitizeText($value, 500);
            } elseif (is_bool($value) || is_numeric($value) || $value === null) {
                $masked[$key] = $value;
            } else {
                $masked[$key] = $this->sanitizeText((string) $value, 500);
            }
        }

        return $masked;
    }

    private function getSamplingRate(): int
    {
        $raw = (string) ($this->settingsModel->get('behavior_sampling_rate') ?? '100');
        $rate = (int) $raw;
        return max(1, min($rate, 100));
    }

    private function getClientIpHash(): ?string
    {
        $ip = $this->getClientIp();

        if ($ip === '') {
            return null;
        }

        return hash('sha256', $ip . '|' . JWT_SECRET);
    }

    private function getClientIp(): string
    {
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            return trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim((string) ($parts[0] ?? ''));
        }
        if (!empty($_SERVER['REMOTE_ADDR'])) {
            return trim((string) $_SERVER['REMOTE_ADDR']);
        }

        return '';
    }

    private function countryNameFromCode(string $countryCode): string
    {
        $map = [
            'US' => 'United States',
            'GB' => 'United Kingdom',
            'IN' => 'India',
            'LK' => 'Sri Lanka',
            'CA' => 'Canada',
            'AU' => 'Australia',
            'DE' => 'Germany',
            'FR' => 'France',
            'NL' => 'Netherlands',
            'SG' => 'Singapore',
            'AE' => 'United Arab Emirates',
            'JP' => 'Japan',
            'CN' => 'China',
            'BR' => 'Brazil',
            'ZA' => 'South Africa',
        ];

        return $map[$countryCode] ?? $countryCode;
    }
}
