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
     * Get plan details with dynamic pricing from site_settings
     */
    public static function getPlans(): array
    {
        $pricing = self::getPricing();

        return [
            'free' => [
                'name' => 'Free',
                'slug' => 'free',
                'monthly_price' => 0,
                'annual_price' => 0,
                'onetime_price' => null,
                'duration_days' => null,
                'features' => [
                    'Up to 2 CVs',
                    '3 professional templates',
                    'PDF download',
                    'ORCID & Scholar import',
                    'Google Sign-in',
                    'Upload old CV & auto-fill (Coming Soon)',
                ],
                'limits' => [
                    'max_cvs' => 2,
                    'max_templates' => 3,
                ],
            ],
            'starter' => [
                'name' => 'Starter',
                'slug' => 'starter',
                'monthly_price' => null,
                'annual_price' => null,
                'onetime_price' => (int) $pricing['starter_onetime'],
                'duration_days' => 30,
                'features' => [
                    'Unlimited CVs',
                    'All 6 templates (current & future)',
                    'All 18+ academic sections',
                    'Priority PDF generation',
                    'ORCID & Scholar import',
                    'Google Sign-in',
                    'Custom sections',
                    'Priority support',
                    'Upload old CV & auto-fill (Coming Soon)',
                ],
                'limits' => [
                    'max_cvs' => 999999,
                    'max_templates' => 999,
                ],
            ],
            'pro' => [
                'name' => 'Pro',
                'slug' => 'pro',
                'monthly_price' => (int) $pricing['pro_monthly'],
                'annual_price' => (int) $pricing['pro_annual'],
                'onetime_price' => null,
                'duration_days' => null,
                'features' => [
                    'Unlimited CVs',
                    'All 6 templates (current & future)',
                    'All 18+ academic sections',
                    'Priority PDF generation',
                    'ORCID & Scholar import',
                    'Google Sign-in',
                    'Custom sections',
                    'Priority support',
                    'Upload old CV & auto-fill (Coming Soon)',
                ],
                'limits' => [
                    'max_cvs' => 999999,
                    'max_templates' => 999,
                ],
            ],
            'enterprise' => [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'monthly_price' => null, // custom
                'annual_price' => null,
                'onetime_price' => null,
                'duration_days' => null,
                'features' => [
                    'Unlimited CVs',
                    'All 6 templates (current & future)',
                    'All 18+ academic sections',
                    'Priority PDF generation',
                    'ORCID & Scholar import',
                    'Custom branding',
                    'Member management dashboard',
                    'Bulk account creation',
                    'Dedicated support',
                    'SSO integration',
                    'Upload old CV & auto-fill (Coming Soon)',
                ],
                'limits' => [
                    'max_cvs' => 999999,
                    'max_templates' => 999,
                ],
            ],
        ];
    }

    /**
     * Get pricing from site_settings (with fallback defaults)
     */
    public static function getPricing(): array
    {
        static $cached = null;
        if ($cached !== null) return $cached;

        try {
            $settings = new SiteSetting();
            $values = $settings->getMultiple([
                'pricing_starter_onetime',
                'pricing_pro_monthly',
                'pricing_pro_annual',
            ]);
            $cached = [
                'starter_onetime' => $values['pricing_starter_onetime'] ?? '500',
                'pro_monthly'     => $values['pricing_pro_monthly'] ?? '200',
                'pro_annual'      => $values['pricing_pro_annual'] ?? '1900',
            ];
        } catch (\Throwable $e) {
            // Fallback if site_settings table doesn't exist yet
            $cached = [
                'starter_onetime' => '500',
                'pro_monthly'     => '200',
                'pro_annual'      => '1900',
            ];
        }
        return $cached;
    }
}
