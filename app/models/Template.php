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
        // Determine is_premium dynamically: a template is premium if the free plan
        // does NOT have access to it via plan_features
        $sql = "SELECT t.*,
                    CASE WHEN pf.is_enabled = 1 THEN 0 ELSE 1 END AS is_premium
                FROM templates t
                LEFT JOIN plan_features pf
                    ON pf.feature_key = CONCAT('template_', REPLACE(t.slug, '-', '_'))
                    AND pf.plan = 'free'
                WHERE t.is_active = 1";
        if (!$includePremium) {
            $sql .= " AND (pf.is_enabled = 1)";
        }
        $sql .= " ORDER BY CASE WHEN pf.is_enabled = 1 THEN 0 ELSE 1 END ASC, t.name ASC";

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
