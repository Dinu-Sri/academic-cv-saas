<?php
/**
 * Template Model
 */
class Template
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM templates WHERE id = ? AND is_active = 1");
        $stmt->execute([$id]);
        $template = $stmt->fetch();
        if ($template && $template['style_config']) {
            $template['style_config'] = json_decode($template['style_config'], true);
        }
        return $template ?: null;
    }

    public function findBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM templates WHERE slug = ? AND is_active = 1");
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    public function getAll(bool $includePremium = true): array
    {
        $sql = "SELECT t.*, 0 AS is_premium FROM templates t WHERE t.is_active = 1 ORDER BY t.name ASC";

        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }

    public function getSections(int $templateId): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM template_sections WHERE template_id = ? ORDER BY section_order ASC"
        );
        $stmt->execute([$templateId]);
        $sections = $stmt->fetchAll();

        foreach ($sections as &$section) {
            $section['fields_schema'] = json_decode($section['fields_schema'], true);
        }

        return $sections;
    }

    public function getAvailableForUser(string $plan): array
    {
        $stmt = $this->db->query("SELECT t.*, 1 AS has_access, 0 AS is_premium FROM templates t WHERE t.is_active = 1 ORDER BY t.name ASC");
        return $stmt->fetchAll();
    }
}
