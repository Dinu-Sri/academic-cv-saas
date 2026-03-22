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
        $sql = "SELECT * FROM templates WHERE is_active = 1";
        if (!$includePremium) {
            $sql .= " AND is_premium = 0";
        }
        $sql .= " ORDER BY is_premium ASC, name ASC";

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
        if ($plan === 'enterprise' || $plan === 'pro') {
            return $this->getAll(true);
        }
        return $this->getAll(false);
    }
}
