<?php
/**
 * Feature Model — manages feature flags and plan-feature mappings
 */
class Feature
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    /**
     * Get all features ordered by sort_order
     */
    public function getAll(): array
    {
        $stmt = $this->db->query("SELECT * FROM features ORDER BY sort_order, id");
        return $stmt->fetchAll();
    }

    /**
     * Get all features grouped by category
     */
    public function getAllGrouped(): array
    {
        $features = $this->getAll();
        $grouped = [];
        foreach ($features as $f) {
            $grouped[$f['category']][] = $f;
        }
        return $grouped;
    }

    /**
     * Get the full plan-features matrix: all plans × all features
     */
    public function getMatrix(): array
    {
        $stmt = $this->db->query(
            "SELECT pf.plan, pf.feature_key, pf.is_enabled, pf.config_value
             FROM plan_features pf
             ORDER BY pf.plan, pf.feature_key"
        );
        $rows = $stmt->fetchAll();

        $matrix = [];
        foreach ($rows as $row) {
            $matrix[$row['plan']][$row['feature_key']] = [
                'is_enabled' => (bool) $row['is_enabled'],
                'config_value' => $row['config_value'],
            ];
        }
        return $matrix;
    }

    /**
     * Check if a plan has a specific feature enabled
     */
    public function planHasFeature(string $plan, string $featureKey): bool
    {
        $stmt = $this->db->prepare(
            "SELECT is_enabled FROM plan_features WHERE plan = ? AND feature_key = ?"
        );
        $stmt->execute([$plan, $featureKey]);
        $row = $stmt->fetch();
        return $row ? (bool) $row['is_enabled'] : false;
    }

    /**
     * Get config value for a plan feature (e.g., max_cvs = "2")
     */
    public function getPlanFeatureValue(string $plan, string $featureKey): ?string
    {
        $stmt = $this->db->prepare(
            "SELECT config_value FROM plan_features WHERE plan = ? AND feature_key = ? AND is_enabled = 1"
        );
        $stmt->execute([$plan, $featureKey]);
        $row = $stmt->fetch();
        return $row ? $row['config_value'] : null;
    }

    /**
     * Update a plan-feature toggle
     */
    public function updatePlanFeature(string $plan, string $featureKey, bool $enabled, ?string $configValue = null): bool
    {
        $stmt = $this->db->prepare(
            "INSERT INTO plan_features (plan, feature_key, is_enabled, config_value)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), config_value = VALUES(config_value)"
        );
        return $stmt->execute([$plan, $featureKey, $enabled ? 1 : 0, $configValue]);
    }

    /**
     * Add a new feature
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO features (feature_key, feature_name, description, category, value_type, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['feature_key'],
            $data['feature_name'],
            $data['description'] ?? null,
            $data['category'] ?? 'general',
            $data['value_type'] ?? 'boolean',
            $data['sort_order'] ?? 0,
        ]);
        return (int) $this->db->lastInsertId();
    }
}
