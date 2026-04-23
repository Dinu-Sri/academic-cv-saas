<?php
/**
 * BehaviorController
 * Accepts batched user behavior timeline events.
 */
class BehaviorController
{
    private function requestToken(array $jsonBody): string
    {
        return (string) (
            $_POST[CSRF_TOKEN_NAME]
            ?? $_POST['csrf_token']
            ?? ($jsonBody[CSRF_TOKEN_NAME] ?? null)
            ?? ($jsonBody['csrf_token'] ?? null)
            ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')
            ?? ''
        );
    }

    public function track(): void
    {
        Auth::requireLogin();
        header('Content-Type: application/json');

        $raw = file_get_contents('php://input');
        $body = json_decode($raw ?: '', true);
        if (!is_array($body)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
            return;
        }

        if (!Auth::verifyToken($this->requestToken($body))) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid token.']);
            return;
        }

        $settings = new SiteSetting();
        if (($settings->get('behavior_tracking_enabled') ?? '0') !== '1') {
            echo json_encode(['success' => true, 'ignored' => true, 'count' => 0]);
            return;
        }

        $events = $body['events'] ?? [];
        if (!is_array($events)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Events must be an array.']);
            return;
        }

        if (count($events) > 50) {
            $events = array_slice($events, 0, 50);
        }

        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($body['session_id'] ?? ''));
        if ($sessionId === '' || strlen($sessionId) < 8) {
            $sessionId = bin2hex(random_bytes(12));
        }
        $sessionId = substr($sessionId, 0, 64);

        try {
            $service = new BehaviorTrackingService();
            $count = $service->ingestBatch((int) Auth::id(), $sessionId, $events, [
                'path' => (string) ($body['path'] ?? ($_SERVER['REQUEST_URI'] ?? '/')),
            ]);
            echo json_encode(['success' => true, 'count' => $count]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Tracking failed.']);
        }
    }
}
