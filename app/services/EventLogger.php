<?php
/**
 * EventLogger
 * Stores lightweight user behavior events for retention analytics.
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
        try {
            $db = Database::getInstance()->getConnection();
            $ipHash = self::getClientIpHash();
            $payload = empty($metadata) ? null : json_encode($metadata, JSON_UNESCAPED_SLASHES);

            $stmt = $db->prepare(
                "INSERT INTO user_events (user_id, event_key, metadata, ip_hash) VALUES (?, ?, ?, ?)"
            );
            $stmt->execute([$userId, $eventKey, $payload, $ipHash]);
        } catch (\Throwable $e) {
            // Tracking must never block core user flows.
        }
    }

    private static function getClientIpHash(): ?string
    {
        $ip = '';

        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $ip = trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($parts[0] ?? '');
        } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            $ip = trim((string) $_SERVER['REMOTE_ADDR']);
        }

        if ($ip === '') {
            return null;
        }

        return hash('sha256', $ip . '|' . JWT_SECRET);
    }
}
