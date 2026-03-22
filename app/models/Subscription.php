<?php
/**
 * Subscription Model
 */
class Subscription
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function findByUser(int $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
        );
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO subscriptions (user_id, plan, billing_cycle, price_cents, status, starts_at, expires_at)
             VALUES (?, ?, ?, ?, 'active', NOW(), ?)"
        );
        $stmt->execute([
            $data['user_id'],
            $data['plan'],
            $data['billing_cycle'],
            $data['price_cents'],
            $data['expires_at'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function cancel(int $id): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?"
        );
        return $stmt->execute([$id]);
    }

    /**
     * Get plan details (static pricing config)
     */
    public static function getPlans(): array
    {
        return [
            'free' => [
                'name' => 'Free',
                'slug' => 'free',
                'monthly_price' => 0,
                'annual_price' => 0,
                'features' => [
                    'Up to 2 CVs',
                    '3 professional templates',
                    'PDF download',
                    'ORCID & Scholar import',
                    'Google Sign-in',
                ],
                'limits' => [
                    'max_cvs' => 2,
                    'max_templates' => 3,
                ],
            ],
            'pro' => [
                'name' => 'Pro',
                'slug' => 'pro',
                'monthly_price' => 100, // cents
                'annual_price' => 600,  // cents ($0.50/mo × 12)
                'features' => [
                    'Up to 20 CVs',
                    'All templates (current & future)',
                    'Priority PDF generation',
                    'ORCID & Scholar import',
                    'Google Sign-in',
                    'Custom sections',
                    'Priority support',
                ],
                'limits' => [
                    'max_cvs' => 20,
                    'max_templates' => 999,
                ],
            ],
            'enterprise' => [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'monthly_price' => null, // custom
                'annual_price' => null,
                'features' => [
                    'Unlimited CVs',
                    'All templates (current & future)',
                    'Priority PDF generation',
                    'ORCID & Scholar import',
                    'Custom branding',
                    'Member management dashboard',
                    'Bulk account creation',
                    'Dedicated support',
                    'SSO integration',
                ],
                'limits' => [
                    'max_cvs' => 999999,
                    'max_templates' => 999,
                ],
            ],
        ];
    }
}
