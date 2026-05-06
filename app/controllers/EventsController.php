<?php
/**
 * Events Controller - Client-side event logging via API.
 * Uses EventLogger as the single pipeline (local MySQL + PostHog forwarding + context enrichment).
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

        // EventLogger is the single source of truth for local + PostHog writes.
        EventLogger::log($eventKey, (array) $metadata);

        http_response_code(200);
        echo json_encode(['success' => true]);
    }
}
