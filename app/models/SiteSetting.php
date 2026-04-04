<?php
/**
 * SiteSetting Model — key-value store for application settings
 */
class SiteSetting
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    /**
     * Get a single setting value
     */
    public function get(string $key): ?string
    {
        $stmt = $this->db->prepare("SELECT setting_value FROM site_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $result = $stmt->fetchColumn();
        return $result !== false ? $result : null;
    }

    /**
     * Set a single setting value (upsert)
     */
    public function set(string $key, ?string $value): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
        );
        $stmt->execute([$key, $value]);
    }

    /**
     * Get multiple settings at once
     */
    public function getMultiple(array $keys): array
    {
        if (empty($keys)) return [];

        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmt = $this->db->prepare("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($keys);
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['setting_key']] = $row['setting_value'];
        }
        // Fill missing keys with null
        foreach ($keys as $key) {
            if (!isset($result[$key])) {
                $result[$key] = null;
            }
        }
        return $result;
    }

    /**
     * Set multiple settings at once
     */
    public function setMultiple(array $data): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
        );
        foreach ($data as $key => $value) {
            $stmt->execute([$key, $value]);
        }
    }

    /**
     * Get all PayHere configuration settings
     */
    public function getPayHereConfig(): array
    {
        return $this->getMultiple([
            'payhere_merchant_id',
            'payhere_merchant_secret',
            'payhere_app_id',
            'payhere_app_secret',
            'payhere_sandbox',
            'payhere_currency',
        ]);
    }
}
