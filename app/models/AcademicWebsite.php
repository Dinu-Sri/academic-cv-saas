<?php
/**
 * AcademicWebsite Model
 *
 * One public academic website per user. Data is auto-populated at render time
 * from the central profile (users.personal_info + user_entries + verified
 * publications) — this row only stores website configuration: slug, status,
 * template, headline override, and visibility maps.
 *
 * The website is a DRAFT until the user explicitly publishes it.
 */
class AcademicWebsite
{
    private PDO $db;

    /**
     * Slugs that would collide with existing top-level routes. A user-chosen
     * slug may never be one of these.
     */
    private const RESERVED_SLUGS = [
        'admin', 'api', 'archive', 'blog', 'cv', 'dashboard', 'login', 'logout',
        'register', 'pricing', 'plans', 'profile', 'settings', 'support', 's',
        'u', 'website', 'templates', 'payment', 'sitemap', 'robots', 'contact',
        'home', 'mobile-start', 'mobile-cv-ready', 'auth', 'google', 'debug-import',
    ];

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function findByUser(int $userId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM academic_websites WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->decode($row) : null;
    }

    public function findBySlug(string $slug): ?array
    {
        if ($slug === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT * FROM academic_websites WHERE slug = ? LIMIT 1");
        $stmt->execute([$slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->decode($row) : null;
    }

    /**
     * Get the user's website, creating a draft row with sensible defaults if it
     * does not exist yet. Returns [website, bool $created].
     */
    public function ensureForUser(int $userId, array $user): array
    {
        $existing = $this->findByUser($userId);
        if ($existing) {
            return [$existing, false];
        }

        $slug = $this->generateUniqueSlug($user);
        $stmt = $this->db->prepare(
            "INSERT INTO academic_websites
                (user_id, slug, status, template_key, section_visibility, field_visibility)
             VALUES (?, ?, 'draft', 'elegant', ?, ?)"
        );
        $stmt->execute([
            $userId,
            $slug,
            json_encode(self::defaultSectionVisibility()),
            json_encode(self::defaultFieldVisibility()),
        ]);

        return [$this->findByUser($userId), true];
    }

    /**
     * Persist editable settings. Only whitelisted columns are updated.
     */
    public function updateSettings(int $userId, array $fields): void
    {
        $allowed = [
            'slug', 'template_key', 'headline', 'section_visibility',
            'field_visibility', 'source_cv_id',
        ];
        $sets = [];
        $values = [];
        foreach ($fields as $key => $value) {
            if (!in_array($key, $allowed, true)) {
                continue;
            }
            if (in_array($key, ['section_visibility', 'field_visibility'], true) && is_array($value)) {
                $value = json_encode($value);
            }
            $sets[] = "{$key} = ?";
            $values[] = $value;
        }
        if (empty($sets)) {
            return;
        }
        $values[] = $userId;
        $stmt = $this->db->prepare(
            "UPDATE academic_websites SET " . implode(', ', $sets) . " WHERE user_id = ?"
        );
        $stmt->execute($values);
    }

    public function setStatus(int $userId, string $status): void
    {
        $status = $status === 'published' ? 'published' : 'draft';
        if ($status === 'published') {
            $stmt = $this->db->prepare(
                "UPDATE academic_websites SET status = 'published', published_at = NOW() WHERE user_id = ?"
            );
        } else {
            $stmt = $this->db->prepare(
                "UPDATE academic_websites SET status = 'draft' WHERE user_id = ?"
            );
        }
        $stmt->execute([$userId]);
    }

    public function incrementViews(int $websiteId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE academic_websites SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ?"
        );
        $stmt->execute([$websiteId]);
    }

    /**
     * Is a slug available (valid + not reserved + not taken by another user)?
     */
    public function isSlugAvailable(string $slug, int $exceptUserId = 0): bool
    {
        if (!self::isValidSlug($slug) || self::isReserved($slug)) {
            return false;
        }
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM academic_websites WHERE slug = ? AND user_id <> ?"
        );
        $stmt->execute([$slug, $exceptUserId]);
        return (int) $stmt->fetchColumn() === 0;
    }

    public static function isReserved(string $slug): bool
    {
        return in_array(strtolower($slug), self::RESERVED_SLUGS, true);
    }

    /**
     * Validate slug format: 3-150 chars, lowercase letters/digits/hyphens,
     * not starting or ending with a hyphen.
     */
    public static function isValidSlug(string $slug): bool
    {
        return (bool) preg_match('/^[a-z0-9](?:[a-z0-9\-]{1,148}[a-z0-9])$/', $slug);
    }

    /**
     * Normalize an arbitrary string to a slug candidate (does not guarantee
     * uniqueness or validity length).
     */
    public static function slugify(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
        $slug = preg_replace('/[\s\-]+/', '-', $slug);
        return trim((string) $slug, '-');
    }

    public static function defaultSectionVisibility(): array
    {
        return [
            'academic_profile'         => true,
            'research_interests'       => true,
            'education'                => true,
            'experience'               => true,
            'teaching'                 => true,
            'publications'             => true,
            'projects'                 => true,
            'skills'                   => true,
            'awards'                   => true,
            'grants'                   => true,
            'conferences'              => true,
            'supervision'              => true,
            'memberships'              => true,
            'languages'                => true,
            'references'               => false,
            'download_cv'              => true,
            'contact_form'             => true,
        ];
    }

    /**
     * Sensitive personal fields are hidden by default.
     */
    public static function defaultFieldVisibility(): array
    {
        return [
            'show_phone'      => false,
            'show_address'    => false,
            'show_email'      => false,
            'show_references' => false,
        ];
    }

    // -- Internals -----------------------------------------------------------

    private function generateUniqueSlug(array $user): string
    {
        $base = self::slugify((string) ($user['username'] ?? ''));
        if ($base === '') {
            $base = self::slugify((string) ($user['full_name'] ?? ''));
        }
        if (strlen($base) < 3) {
            $base = 'user-' . substr(md5((string) ($user['id'] ?? '') . microtime()), 0, 6);
        }
        $base = substr($base, 0, 140);

        $slug = $base;
        $counter = 1;
        while (!$this->isSlugFree($slug)) {
            $counter++;
            $slug = $base . '-' . $counter;
        }
        return $slug;
    }

    private function isSlugFree(string $slug): bool
    {
        if (self::isReserved($slug)) {
            return false;
        }
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM academic_websites WHERE slug = ?");
        $stmt->execute([$slug]);
        return (int) $stmt->fetchColumn() === 0;
    }

    private function decode(array $row): array
    {
        $row['section_visibility'] = $this->decodeJson($row['section_visibility'] ?? null, self::defaultSectionVisibility());
        $row['field_visibility'] = $this->decodeJson($row['field_visibility'] ?? null, self::defaultFieldVisibility());
        return $row;
    }

    private function decodeJson(?string $value, array $default): array
    {
        if ($value === null || $value === '') {
            return $default;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? array_merge($default, $decoded) : $default;
    }
}
