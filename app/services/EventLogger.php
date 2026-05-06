<?php
/**
 * EventLogger
 * Stores lightweight user behavior events in MySQL and forwards to PostHog.
 */
class EventLogger
{
    public static function log(string $eventKey, array $metadata = []): void
    {
        self::writeEvent(Auth::id(), $eventKey, $metadata);
    }

    public static function logForUser(int $userId, string $eventKey, array $metadata = []): void
    {
        self::writeEvent($userId, $eventKey, $metadata);
    }

    private static function writeEvent(?int $userId, string $eventKey, array $metadata = []): void
    {
        $metadata = self::sanitizeMetadata($eventKey, $metadata);

        // 1. Always write to local MySQL
        try {
            $db = Database::getInstance()->getConnection();
            $ipHash = self::getClientIpHash();
            $payload = empty($metadata) ? null : json_encode($metadata, JSON_UNESCAPED_SLASHES);

            $stmt = $db->prepare(
                "INSERT INTO user_events (user_id, event_name, metadata, ip_hash) VALUES (?, ?, ?, ?)"
            );
            $stmt->execute([$userId, $eventKey, $payload, $ipHash]);
        } catch (\Throwable $e) {
            // Tracking must never block core user flows.
        }

        // 2. Forward to PostHog if enabled
        if (defined('POSTHOG_ENABLED') && POSTHOG_ENABLED && $userId !== null) {
            self::sendToPostHog($userId, $eventKey, $metadata);
        }
    }

    /**
     * Send $identify event to PostHog to link user ID to profile properties
     * Call this on login/register so all subsequent events carry email & plan
     */
    public static function identifyInPostHog(int $userId, array $properties): void
    {
        if (!defined('POSTHOG_ENABLED') || !POSTHOG_ENABLED) {
            return;
        }

        try {
            $payload = [
                'api_key'     => POSTHOG_API_KEY,
                'event'       => '$identify',
                'properties'  => [
                    'distinct_id'     => (string)$userId,
                    '$set'            => $properties,
                ],
                'timestamp'   => date('c'),
            ];

            self::postToPostHog($payload);
        } catch (\Throwable $e) {
            // Never block user flows
        }
    }

    private static function sendToPostHog(int $userId, string $eventKey, array $metadata): void
    {
        try {
            $requestContext = self::getRequestContext();

            $payload = [
                'api_key' => POSTHOG_API_KEY,
                'event'   => $eventKey,
                'properties' => array_merge($metadata, $requestContext, [
                    'distinct_id' => (string)$userId,
                    'app_name'    => APP_NAME,
                    'app_env'     => APP_ENV,
                ]),
                'timestamp' => date('c'),
            ];

            if (defined('POSTHOG_SEND_CLIENT_IP') && POSTHOG_SEND_CLIENT_IP && isset($requestContext['client_ip'])) {
                $payload['properties']['$ip'] = $requestContext['client_ip'];
            }

            self::postToPostHog($payload);
        } catch (\Throwable $e) {
            // PostHog forwarding must never block core user flows
        }
    }

    /**
     * Build request context properties added to every PostHog event.
     * Gives URL, referrer, and device class automatically.
     */
    private static function getRequestContext(): array
    {
        $ctx = [];
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $ip = self::getClientIp();

        // Current URL
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? '';
        if ($host) {
            $ctx['$current_url'] = $scheme . '://' . $host . $uri;
        }

        // Path only (for grouping without query strings)
        $ctx['path'] = parse_url($uri, PHP_URL_PATH) ?? $uri;

        // Referrer
        if (!empty($_SERVER['HTTP_REFERER'])) {
            $ctx['$referrer'] = (string) $_SERVER['HTTP_REFERER'];
        }

        // Geo / IP hints (privacy-safe by default)
        $countryCode = strtoupper(trim((string) ($_SERVER['HTTP_CF_IPCOUNTRY'] ?? $_SERVER['HTTP_X_COUNTRY_CODE'] ?? '')));
        if ($countryCode !== '' && preg_match('/^[A-Z]{2}$/', $countryCode)) {
            $ctx['country_code'] = $countryCode;
            $ctx['country_name'] = self::countryNameFromCode($countryCode);
        }

        if ($ip !== '') {
            $ctx['ip_hash'] = hash('sha256', $ip . '|' . JWT_SECRET);
            $ctx['client_ip_present'] = true;
            if (defined('POSTHOG_SEND_CLIENT_IP') && POSTHOG_SEND_CLIENT_IP) {
                // Stored only in outgoing payload (not in local MySQL metadata).
                $ctx['client_ip'] = $ip;
            }
        } else {
            $ctx['client_ip_present'] = false;
        }

        // User agent → simple device class
        $ua = strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        if ($ua) {
            if (str_contains($ua, 'mobile') || str_contains($ua, 'android') || str_contains($ua, 'iphone')) {
                $ctx['device_type'] = 'mobile';
            } elseif (str_contains($ua, 'tablet') || str_contains($ua, 'ipad')) {
                $ctx['device_type'] = 'tablet';
            } else {
                $ctx['device_type'] = 'desktop';
            }
        }

        return $ctx;
    }

    private static function postToPostHog(array $payload): void
    {
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
    }


    private static function getClientIpHash(): ?string
    {
        $ip = self::getClientIp();

        if ($ip === '') {
            return null;
        }

        return hash('sha256', $ip . '|' . JWT_SECRET);
    }

    private static function getClientIp(): string
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

    private static function sanitizeMetadata(string $eventKey, array $metadata): array
    {
        $allowed = self::allowedMetadataKeysForEvent($eventKey);
        $clean = [];

        foreach ($metadata as $key => $value) {
            $k = trim((string) $key);
            if ($k === '') {
                continue;
            }
            if (!in_array($k, $allowed, true)) {
                continue;
            }
            if (preg_match('/password|token|secret|email|phone|address|name|title|abstract|institution/i', $k)) {
                continue;
            }

            $normalized = self::normalizeMetadataValue($value);
            if ($normalized === null && $value !== null) {
                continue;
            }
            $clean[$k] = $normalized;
        }

        return $clean;
    }

    private static function allowedMetadataKeysForEvent(string $eventKey): array
    {
        $base = [
            'source', 'campaign', 'plan', 'is_new_user', 'reason', 'message', 'duration_ms',
            'engine', 'template_id', 'template_name', 'amount',
            'profile_id', 'cv_id', 'section_id', 'section_key', 'entry_id', 'field_name',
            'fields_count', 'value_length', 'value_length_bucket', 'is_non_empty',
            'completion_pct', 'completion_bucket', 'tracked_fields_total', 'filled_fields_total',
            'entry_count', 'milestone_pct', 'is_visible', 'visible',
            'error_count', 'scope', 'missing_required_count', 'section_count',
        ];

        $byEvent = [
            'cv_field_fill' => ['profile_id', 'entry_id', 'section_key', 'field_name', 'value_length', 'value_length_bucket', 'is_non_empty'],
            'cv_section_saved' => ['profile_id', 'entry_id', 'section_id', 'section_key', 'fields_count'],
            'cv_draft_progress' => ['profile_id', 'section_id', 'section_key', 'completion_pct', 'completion_bucket', 'tracked_fields_total', 'filled_fields_total', 'entry_count'],
            'cv_draft_progress_milestone' => ['profile_id', 'section_id', 'section_key', 'milestone_pct', 'completion_pct', 'entry_count'],
            'validation_error_shown' => ['scope', 'error_count', 'missing_required_count', 'section_count', 'profile_id'],
            'validation_error_fixed' => ['scope', 'profile_id'],
            'autosave_failed' => ['scope', 'profile_id', 'entry_id', 'section_key'],
            'autosave_succeeded' => ['scope', 'profile_id', 'entry_id', 'section_key'],
            'draft_stalled_24h' => ['profile_id', 'hours_since_last_save', 'days_since_last_save', 'has_compiled'],
        ];

        if (isset($byEvent[$eventKey])) {
            return $byEvent[$eventKey];
        }

        return $base;
    }

    private static function normalizeMetadataValue(mixed $value): mixed
    {
        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if (is_string($value)) {
            $v = trim($value);
            if ($v === '') {
                return '';
            }
            $v = preg_replace('/[\r\n\t]+/', ' ', $v) ?? '';
            $v = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email]', $v) ?? $v;
            return substr($v, 0, 255);
        }

        if (is_array($value)) {
            $flat = [];
            foreach ($value as $k => $v) {
                if (count($flat) >= 10) {
                    break;
                }
                $nk = trim((string) $k);
                if ($nk === '' || preg_match('/password|token|secret|email|phone|address|name|title|abstract|institution/i', $nk)) {
                    continue;
                }
                if (is_bool($v) || is_int($v) || is_float($v) || $v === null) {
                    $flat[$nk] = $v;
                    continue;
                }
                if (is_string($v)) {
                    $sv = preg_replace('/[\r\n\t]+/', ' ', trim($v)) ?? '';
                    $sv = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email]', $sv) ?? $sv;
                    $flat[$nk] = substr($sv, 0, 120);
                }
            }
            return empty($flat) ? null : $flat;
        }

        return null;
    }

    private static function countryNameFromCode(string $countryCode): string
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
