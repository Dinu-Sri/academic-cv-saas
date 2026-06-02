<?php
/**
 * MobileCvSession Model
 *
 * Tracks CV drafts started on mobile ("Start on mobile, finish on laptop").
 * The draft CV lives in cv_profiles/cv_sections/cv_entries; this row records
 * the mobile origin, extraction/PDF status, the secure desktop continuation
 * token, and handoff CTA timestamps used for retention automation.
 *
 * The continuation token is an HMAC over user_id|cv_profile_id and never
 * expires (continuation_token_expires_at is kept nullable for future use).
 */
class MobileCvSession
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO mobile_cv_sessions
                (cv_profile_id, user_id, source_device, started_from_mobile,
                 mobile_flow_type, uploaded_cv_file_path, extraction_status,
                 pdf_generation_status, continuation_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['cv_profile_id'] ?? null,
            $data['user_id'],
            $data['source_device'] ?? 'mobile',
            isset($data['started_from_mobile']) ? (int) $data['started_from_mobile'] : 1,
            $data['mobile_flow_type'],
            $data['uploaded_cv_file_path'] ?? null,
            $data['extraction_status'] ?? 'pending',
            $data['pdf_generation_status'] ?? 'pending',
            $data['continuation_token'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM mobile_cv_sessions WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function findByProfile(int $profileId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM mobile_cv_sessions WHERE cv_profile_id = ? ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute([$profileId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function findByToken(string $token): ?array
    {
        if ($token === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT * FROM mobile_cv_sessions WHERE continuation_token = ? LIMIT 1");
        $stmt->execute([$token]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Update arbitrary whitelisted columns for a session row.
     */
    public function update(int $id, array $fields): void
    {
        $allowed = [
            'cv_profile_id', 'extraction_status', 'pdf_generation_status',
            'continuation_token', 'desktop_opened_at', 'emailed_link_at',
            'whatsapp_clicked_at', 'copied_link_at', 'first_downloaded_at',
            'uploaded_cv_file_path',
        ];
        $sets = [];
        $values = [];
        foreach ($fields as $key => $value) {
            if (!in_array($key, $allowed, true)) {
                continue;
            }
            $sets[] = "{$key} = ?";
            $values[] = $value;
        }
        if (empty($sets)) {
            return;
        }
        $values[] = $id;
        $stmt = $this->db->prepare(
            "UPDATE mobile_cv_sessions SET " . implode(', ', $sets) . " WHERE id = ?"
        );
        $stmt->execute($values);
    }

    public function markTimestamp(int $id, string $column): void
    {
        $allowed = [
            'desktop_opened_at', 'emailed_link_at', 'whatsapp_clicked_at',
            'copied_link_at', 'first_downloaded_at',
        ];
        if (!in_array($column, $allowed, true)) {
            return;
        }
        $stmt = $this->db->prepare(
            "UPDATE mobile_cv_sessions SET {$column} = NOW() WHERE id = ?"
        );
        $stmt->execute([$id]);
    }

    /**
     * Issue a non-expiring continuation token bound to user + profile.
     */
    public static function issueToken(int $userId, int $profileId): string
    {
        $secret = defined('JWT_SECRET') ? JWT_SECRET : 'cvscholar';
        return hash_hmac('sha256', $userId . '|' . $profileId, $secret);
    }

    /**
     * Verify a token matches the user + profile binding.
     */
    public static function verifyToken(string $token, int $userId, int $profileId): bool
    {
        if ($token === '') {
            return false;
        }
        $expected = self::issueToken($userId, $profileId);
        return hash_equals($expected, $token);
    }
}
