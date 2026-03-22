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
             JOIN template_sections ts ON s.section_key = ts.section_key
             JOIN cv_profiles p ON s.profile_id = p.id AND ts.template_id = p.template_id
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
}
