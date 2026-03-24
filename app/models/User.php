<?php
/**
 * User Model
 */
class User
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function findByUsername(string $username): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (email, username, hashed_password, full_name, title, affiliation) 
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['email'],
            $data['username'],
            Auth::hashPassword($data['password']),
            $data['full_name'] ?? null,
            $data['title'] ?? null,
            $data['affiliation'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        foreach ($data as $key => $value) {
            $fields[] = "{$key} = ?";
            $values[] = $value;
        }
        $values[] = $id;

        $stmt = $this->db->prepare(
            "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?"
        );
        return $stmt->execute($values);
    }

    public function updateLastLogin(int $id): void
    {
        $stmt = $this->db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);
    }

    public function countCVs(int $userId): int
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM cv_profiles WHERE user_id = ?");
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Find user by Google ID
     */
    public function findByGoogleId(string $googleId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE google_id = ?");
        $stmt->execute([$googleId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Create a user from Google OAuth data (no password required)
     */
    public function createFromGoogle(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (email, username, full_name, google_id, avatar_url, auth_provider, hashed_password)
             VALUES (?, ?, ?, ?, ?, 'google', '')"
        );
        $stmt->execute([
            $data['email'],
            $data['username'],
            $data['full_name'] ?? null,
            $data['google_id'],
            $data['avatar_url'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Link Google ID to an existing account
     */
    public function linkGoogleAccount(int $userId, string $googleId, ?string $avatarUrl = null): void
    {
        $sql = "UPDATE users SET google_id = ?, auth_provider = 
               CASE WHEN auth_provider = 'local' THEN 'both' ELSE auth_provider END";
        $params = [$googleId];

        if ($avatarUrl) {
            $sql .= ", avatar_url = ?";
            $params[] = $avatarUrl;
        }

        $sql .= " WHERE id = ?";
        $params[] = $userId;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
    }

    public function getCvSettings(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT cv_settings FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        $settings = $row && $row['cv_settings'] ? json_decode($row['cv_settings'], true) : [];
        return array_merge(self::defaultCvSettings(), $settings);
    }

    public function updateCvSettings(int $userId, array $settings): bool
    {
        $stmt = $this->db->prepare("UPDATE users SET cv_settings = ? WHERE id = ?");
        return $stmt->execute([json_encode($settings), $userId]);
    }

    public static function defaultCvSettings(): array
    {
        return [
            'page_size'        => 'A4',
            'margin_top'       => '1in',
            'margin_bottom'    => '1in',
            'margin_left'      => '1in',
            'margin_right'     => '1in',
            'font_family'      => 'serif',
            'font_size'        => '11',
            'line_spacing'     => 'normal',
            'show_page_numbers'=> true,
            'show_last_updated'=> false,
            'date_format'      => 'F Y',
        ];
    }
}
