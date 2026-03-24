<?php
/**
 * CV Profile Model
 */
class CVProfile
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT p.*, t.name as template_name, t.slug as template_slug 
             FROM cv_profiles p 
             JOIN templates t ON p.template_id = t.id 
             WHERE p.id = ?"
        );
        $stmt->execute([$id]);
        $profile = $stmt->fetch();
        if ($profile && $profile['personal_info']) {
            $profile['personal_info'] = json_decode($profile['personal_info'], true);
        }
        return $profile ?: null;
    }

    public function findByUser(int $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT p.*, t.name as template_name, t.slug as template_slug 
             FROM cv_profiles p 
             JOIN templates t ON p.template_id = t.id 
             WHERE p.user_id = ? 
             ORDER BY p.updated_at DESC"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO cv_profiles (user_id, template_id, name, personal_info) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['user_id'],
            $data['template_id'],
            $data['name'],
            json_encode($data['personal_info'] ?? []),
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        foreach ($data as $key => $value) {
            if ($key === 'personal_info') {
                $value = json_encode($value);
            }
            $fields[] = "{$key} = ?";
            $values[] = $value;
        }
        $values[] = $id;

        $stmt = $this->db->prepare(
            "UPDATE cv_profiles SET " . implode(', ', $fields) . " WHERE id = ?"
        );
        return $stmt->execute($values);
    }

    public function delete(int $id, int $userId): bool
    {
        $stmt = $this->db->prepare("DELETE FROM cv_profiles WHERE id = ? AND user_id = ?");
        return $stmt->execute([$id, $userId]);
    }

    public function belongsToUser(int $id, int $userId): bool
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM cv_profiles WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Get all sections with entries for a CV profile
     */
    public function getSections(int $profileId): array
    {
        $stmt = $this->db->prepare(
            "SELECT s.*, ts.display_name, ts.latex_code, ts.fields_schema, ts.is_repeatable
             FROM cv_sections s
             JOIN cv_profiles p ON s.profile_id = p.id
             JOIN template_sections ts ON s.section_key = ts.section_key AND ts.template_id = p.template_id
             WHERE s.profile_id = ?
             ORDER BY s.section_order ASC"
        );
        $stmt->execute([$profileId]);
        $sections = $stmt->fetchAll();

        // Load entries for each section
        foreach ($sections as &$section) {
            $section['fields_schema'] = json_decode($section['fields_schema'], true);
            $section['entries'] = $this->getEntries($section['id']);
        }

        return $sections;
    }

    public function getEntries(int $sectionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM cv_entries WHERE section_id = ? ORDER BY entry_order ASC"
        );
        $stmt->execute([$sectionId]);
        $entries = $stmt->fetchAll();

        foreach ($entries as &$entry) {
            $entry['data'] = json_decode($entry['data'], true);
        }

        return $entries;
    }

    // ===== Shared Profile (User-level master data) =====

    /**
     * Get user's master entries for a section_key
     */
    public function getUserEntries(int $userId, ?string $sectionKey = null): array
    {
        $sql = "SELECT * FROM user_entries WHERE user_id = ?";
        $params = [$userId];

        if ($sectionKey) {
            $sql .= " AND section_key = ?";
            $params[] = $sectionKey;
        }

        $sql .= " ORDER BY section_key, entry_order ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $entries = $stmt->fetchAll();

        foreach ($entries as &$entry) {
            $entry['data'] = json_decode($entry['data'], true);
        }

        return $entries;
    }

    /**
     * Create a user_entry (master copy) and return its ID
     */
    public function createUserEntry(int $userId, string $sectionKey, array $data, int $order = 0): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO user_entries (user_id, section_key, entry_order, data) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$userId, $sectionKey, $order, json_encode($data)]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Update a user_entry's data
     */
    public function updateUserEntry(int $userEntryId, array $data): void
    {
        $stmt = $this->db->prepare("UPDATE user_entries SET data = ? WHERE id = ?");
        $stmt->execute([json_encode($data), $userEntryId]);
    }

    /**
     * Populate a new CV's sections with user's master entries
     */
    public function populateFromMasterData(int $profileId, int $userId): void
    {
        // Get all cv_sections for this profile
        $stmt = $this->db->prepare("SELECT id, section_key FROM cv_sections WHERE profile_id = ?");
        $stmt->execute([$profileId]);
        $cvSections = $stmt->fetchAll();

        // Build section_key → section_id map
        $sectionMap = [];
        foreach ($cvSections as $s) {
            $sectionMap[$s['section_key']] = $s['id'];
        }

        // Get all user_entries
        $userEntries = $this->getUserEntries($userId);

        foreach ($userEntries as $ue) {
            if (!isset($sectionMap[$ue['section_key']])) continue;

            $sectionId = $sectionMap[$ue['section_key']];
            $stmt = $this->db->prepare(
                "INSERT INTO cv_entries (section_id, user_entry_id, entry_order, data) VALUES (?, ?, ?, ?)"
            );
            $stmt->execute([
                $sectionId,
                $ue['id'],
                $ue['entry_order'],
                json_encode($ue['data'])
            ]);
        }
    }

    /**
     * Duplicate a CV profile with all its sections and entries
     */
    public function duplicate(int $sourceId, int $userId, string $newName): int
    {
        // Get source profile
        $source = $this->findById($sourceId);
        if (!$source) return 0;

        // Create new profile
        $newProfileId = $this->create([
            'user_id'       => $userId,
            'template_id'   => $source['template_id'],
            'name'          => $newName,
            'personal_info' => $source['personal_info'] ?? [],
        ]);

        // Copy sections
        $stmt = $this->db->prepare(
            "SELECT * FROM cv_sections WHERE profile_id = ? ORDER BY section_order"
        );
        $stmt->execute([$sourceId]);
        $sections = $stmt->fetchAll();

        foreach ($sections as $section) {
            $stmtSec = $this->db->prepare(
                "INSERT INTO cv_sections (profile_id, section_key, section_order, is_visible) VALUES (?, ?, ?, ?)"
            );
            $stmtSec->execute([
                $newProfileId,
                $section['section_key'],
                $section['section_order'],
                $section['is_visible']
            ]);
            $newSectionId = (int) $this->db->lastInsertId();

            // Copy entries
            $stmtEntries = $this->db->prepare(
                "SELECT * FROM cv_entries WHERE section_id = ? ORDER BY entry_order"
            );
            $stmtEntries->execute([$section['id']]);
            $entries = $stmtEntries->fetchAll();

            foreach ($entries as $entry) {
                $stmtNew = $this->db->prepare(
                    "INSERT INTO cv_entries (section_id, user_entry_id, entry_order, data) VALUES (?, ?, ?, ?)"
                );
                $stmtNew->execute([
                    $newSectionId,
                    $entry['user_entry_id'],
                    $entry['entry_order'],
                    $entry['data']  // Already JSON from DB
                ]);
            }
        }

        return $newProfileId;
    }
}
