<?php
/**
 * Events Controller - Client-side event logging via API
 * Forwards events to PostHog (if enabled) and logs locally to user_events
 */
class EventsController
{
    /**
     * Log a client-side event (e.g., UI interactions, nudge impressions)
     * POST /api/events/log
     * Body: { "event_key": "...", "metadata": {...} }
     */
    public function log(): void
    {
        Auth::requireLogin();
        
        header('Content-Type: application/json');
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $eventKey = trim($input['event_key'] ?? '');
        $metadata = $input['metadata'] ?? [];

        if (empty($eventKey)) {
            http_response_code(400);
            echo json_encode(['error' => 'event_key is required']);
            return;
        }

        // Validate event_key format (alphanumeric + underscore only)
        if (!preg_match('/^[a-z0-9_]+$/', $eventKey)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid event_key format']);
            return;
        }

        // Log locally to MySQL (always, as fallback)
        EventLogger::log($eventKey, (array) $metadata);

        // Forward to PostHog if enabled
        if (POSTHOG_ENABLED) {
            self::forwardToPostHog(Auth::id(), $eventKey, (array) $metadata);
        }

        http_response_code(200);
        echo json_encode(['success' => true]);
    }

    /**
     * Forward event to PostHog API
     * Non-blocking — failures don't break the request
     */
    private static function forwardToPostHog(int $userId, string $eventKey, array $metadata): void
    {
        try {
            $payload = [
                'api_key' => POSTHOG_API_KEY,
                'event' => $eventKey,
                'properties' => array_merge($metadata, [
                    'distinct_id' => (string)$userId,
                    'app_name' => APP_NAME,
                    'app_env' => APP_ENV,
                ]),
                'timestamp' => date('c'),
            ];

            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => 'Content-Type: application/json',
                    'content' => json_encode($payload),
                    'timeout' => 5
                ]
            ]);

            @file_get_contents(POSTHOG_API_URL . '/capture/', false, $context);
        } catch (\Throwable $e) {
            // PostHog forwarding must never block user flows or raise errors
            // Silently fail; local event still logged via EventLogger
        }
    }
}
