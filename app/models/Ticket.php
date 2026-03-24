<?php
/**
 * Ticket Model — Support tickets, bug reports, feature requests
 */
class Ticket
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    /**
     * Generate a unique ticket number like TKT-20260324-001
     */
    public function generateTicketNumber(): string
    {
        $date = date('Ymd');
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM support_tickets WHERE DATE(created_at) = CURDATE()"
        );
        $stmt->execute();
        $count = (int) $stmt->fetchColumn() + 1;
        return 'TKT-' . $date . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Create a new ticket with the initial message as first reply
     */
    public function create(int $userId, string $type, string $subject, string $message, ?string $attachment = null): int
    {
        $ticketNumber = $this->generateTicketNumber();

        $stmt = $this->db->prepare(
            "INSERT INTO support_tickets (user_id, ticket_number, type, subject, has_unread_user_reply)
             VALUES (?, ?, ?, ?, 1)"
        );
        $stmt->execute([$userId, $ticketNumber, $type, $subject]);
        $ticketId = (int) $this->db->lastInsertId();

        // Add the initial message as the first reply
        $this->addReply($ticketId, $userId, $message, false, $attachment);

        return $ticketId;
    }

    /**
     * Add a reply to a ticket (with optional image attachment)
     */
    public function addReply(int $ticketId, int $userId, string $message, bool $isAdmin, ?string $attachment = null): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO ticket_replies (ticket_id, user_id, is_admin_reply, message, attachment)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$ticketId, $userId, $isAdmin ? 1 : 0, $message, $attachment]);

        // Update unread flags
        if ($isAdmin) {
            $this->db->prepare(
                "UPDATE support_tickets SET has_unread_admin_reply = 1, has_unread_user_reply = 0 WHERE id = ?"
            )->execute([$ticketId]);
        } else {
            $this->db->prepare(
                "UPDATE support_tickets SET has_unread_user_reply = 1, has_unread_admin_reply = 0 WHERE id = ?"
            )->execute([$ticketId]);
        }
    }

    /**
     * Find ticket by ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT t.*, u.full_name, u.username, u.email, u.subscription_plan
             FROM support_tickets t
             JOIN users u ON u.id = t.user_id
             WHERE t.id = ?"
        );
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Get all replies for a ticket
     */
    public function getReplies(int $ticketId): array
    {
        $stmt = $this->db->prepare(
            "SELECT r.*, u.full_name, u.username, u.is_admin
             FROM ticket_replies r
             JOIN users u ON u.id = r.user_id
             WHERE r.ticket_id = ?
             ORDER BY r.created_at ASC"
        );
        $stmt->execute([$ticketId]);
        return $stmt->fetchAll();
    }

    /**
     * Get tickets for a specific user
     */
    public function getByUser(int $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT t.*, 
                    (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count,
                    (SELECT MAX(created_at) FROM ticket_replies WHERE ticket_id = t.id) as last_reply_at
             FROM support_tickets t
             WHERE t.user_id = ?
             ORDER BY t.updated_at DESC"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /**
     * Get all tickets (admin) with optional filters
     */
    public function getAll(string $status = '', string $type = '', string $search = ''): array
    {
        $sql = "SELECT t.*, u.full_name, u.username, u.email, u.subscription_plan,
                    (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count,
                    (SELECT MAX(created_at) FROM ticket_replies WHERE ticket_id = t.id) as last_reply_at
                FROM support_tickets t
                JOIN users u ON u.id = t.user_id
                WHERE 1=1";
        $params = [];

        if ($status !== '') {
            $sql .= " AND t.status = ?";
            $params[] = $status;
        }
        if ($type !== '') {
            $sql .= " AND t.type = ?";
            $params[] = $type;
        }
        if ($search !== '') {
            $sql .= " AND (t.ticket_number LIKE ? OR t.subject LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)";
            $term = '%' . $search . '%';
            $params = array_merge($params, [$term, $term, $term, $term]);
        }

        $sql .= " ORDER BY 
                    CASE WHEN t.status IN ('open','in_progress') AND t.has_unread_user_reply = 1 THEN 0 ELSE 1 END,
                    t.updated_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Update ticket status
     */
    public function updateStatus(int $id, string $status): void
    {
        $stmt = $this->db->prepare("UPDATE support_tickets SET status = ? WHERE id = ?");
        $stmt->execute([$status, $id]);
    }

    /**
     * Mark admin replies as read (user viewing ticket)
     */
    public function markAdminRepliesRead(int $ticketId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE support_tickets SET has_unread_admin_reply = 0 WHERE id = ?"
        );
        $stmt->execute([$ticketId]);
    }

    /**
     * Mark user replies as read (admin viewing ticket)
     */
    public function markUserRepliesRead(int $ticketId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE support_tickets SET has_unread_user_reply = 0 WHERE id = ?"
        );
        $stmt->execute([$ticketId]);
    }

    /**
     * Count unread tickets for a user (tickets with admin replies user hasn't seen)
     */
    public function countUnreadForUser(int $userId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM support_tickets 
             WHERE user_id = ? AND has_unread_admin_reply = 1"
        );
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Count unread tickets for admin (tickets with user replies admin hasn't seen)
     */
    public function countUnreadForAdmin(): int
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM support_tickets WHERE has_unread_user_reply = 1"
        );
        $stmt->execute();
        return (int) $stmt->fetchColumn();
    }

    /**
     * Get ticket stats for admin dashboard
     */
    public function getStats(): array
    {
        $stats = [];
        $stats['total'] = (int) $this->db->query("SELECT COUNT(*) FROM support_tickets")->fetchColumn();
        $stats['open'] = (int) $this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status = 'open'")->fetchColumn();
        $stats['in_progress'] = (int) $this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress'")->fetchColumn();
        $stats['resolved'] = (int) $this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved'")->fetchColumn();
        $stats['closed'] = (int) $this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status = 'closed'")->fetchColumn();
        $stats['unread'] = $this->countUnreadForAdmin();
        return $stats;
    }
}
