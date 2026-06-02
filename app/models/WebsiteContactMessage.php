<?php
/**
 * WebsiteContactMessage Model
 *
 * Stores contact-form submissions made on a user's public academic website.
 * Each row is also emailed to the website owner (with the visitor's address as
 * Reply-To). IP hashes support rate-limiting without storing raw IPs.
 */
class WebsiteContactMessage
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO website_contact_messages
                (website_id, user_id, visitor_name, visitor_email, subject, message, ip_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['website_id'],
            $data['user_id'],
            $data['visitor_name'],
            $data['visitor_email'],
            $data['subject'] ?? null,
            $data['message'],
            $data['ip_hash'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Count submissions from an IP hash since the given datetime. Used for
     * rate-limiting public contact submissions.
     */
    public function recentCountByIp(string $ipHash, string $sinceDatetime): int
    {
        if ($ipHash === '') {
            return 0;
        }
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM website_contact_messages
             WHERE ip_hash = ? AND created_at >= ?"
        );
        $stmt->execute([$ipHash, $sinceDatetime]);
        return (int) $stmt->fetchColumn();
    }

    public function findByUser(int $userId, int $limit = 100): array
    {
        $limit = max(1, min(500, $limit));
        $stmt = $this->db->prepare(
            "SELECT * FROM website_contact_messages
             WHERE user_id = ? ORDER BY created_at DESC LIMIT {$limit}"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function unreadCount(int $userId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM website_contact_messages WHERE user_id = ? AND is_read = 0"
        );
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function markAllRead(int $userId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE website_contact_messages SET is_read = 1 WHERE user_id = ?"
        );
        $stmt->execute([$userId]);
    }
}
