<?php
/**
 * ProfileController — user profile settings and marketing preferences.
 */
class ProfileController
{
    public function preferences(): void
    {
        Auth::requireLogin();
        $user = Auth::user();
        $userId = (int) $user['id'];

        $prefs = $this->getPreferences($userId);

        $pageTitle = 'Privacy & Marketing Preferences';
        $saved = false;
        ob_start();
        include TEMPLATE_PATH . '/profile/preferences.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/main.php';
    }

    public function savePreferences(): void
    {
        Auth::requireLogin();
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            header('Location: ' . APP_URL . '/profile/preferences?error=invalid_token');
            exit;
        }

        $user = Auth::user();
        $userId = (int) $user['id'];

        $db = Database::getInstance()->getConnection();

        $marketingEmails = !empty($_POST['marketing_emails']) ? 1 : 0;
        $marketingSms    = !empty($_POST['marketing_sms']) ? 1 : 0;
        $productUpdates  = !empty($_POST['product_updates']) ? 1 : 0;

        // Ensure row exists
        $stmt = $db->prepare(
            "INSERT INTO user_marketing_preferences (user_id, marketing_emails, marketing_sms, product_updates)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE marketing_emails = VALUES(marketing_emails), marketing_sms = VALUES(marketing_sms), product_updates = VALUES(product_updates)"
        );
        $stmt->execute([$userId, $marketingEmails, $marketingSms, $productUpdates]);

        // Accept terms/privacy if submitted
        if (!empty($_POST['accept_terms'])) {
            $stmt = $db->prepare(
                "INSERT INTO user_marketing_preferences (user_id, terms_accepted_at)
                 VALUES (?, NOW())
                 ON DUPLICATE KEY UPDATE terms_accepted_at = NOW()"
            );
            $stmt->execute([$userId]);
        }
        if (!empty($_POST['accept_privacy'])) {
            $stmt = $db->prepare(
                "INSERT INTO user_marketing_preferences (user_id, privacy_accepted_at)
                 VALUES (?, NOW())
                 ON DUPLICATE KEY UPDATE privacy_accepted_at = NOW()"
            );
            $stmt->execute([$userId]);
        }

        // Re-render with saved flag
        $prefs = $this->getPreferences($userId);
        $pageTitle = 'Privacy & Marketing Preferences';
        $saved = true;
        ob_start();
        include TEMPLATE_PATH . '/profile/preferences.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/main.php';
    }

    private function getPreferences(int $userId): array
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT * FROM user_marketing_preferences WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: [
            'marketing_emails' => 0,
            'marketing_sms'    => 0,
            'product_updates'  => 1,
            'terms_accepted_at'   => null,
            'privacy_accepted_at' => null,
        ];
    }
}
