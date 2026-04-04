<?php
/**
 * Helper function for flash messages & escaping
 */
function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

function old(string $key, string $default = ''): string
{
    $value = $_SESSION['old_input'][$key] ?? $default;
    unset($_SESSION['old_input'][$key]);
    return e($value);
}

function flash_messages(): string
{
    $html = '';
    if (!empty($_SESSION['flash_success'])) {
        $html .= '<div class="alert alert-success alert-dismissible fade show" role="alert">'
            . $_SESSION['flash_success']
            . '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        unset($_SESSION['flash_success']);
    }
    if (!empty($_SESSION['flash_error'])) {
        $html .= '<div class="alert alert-danger alert-dismissible fade show" role="alert">'
            . $_SESSION['flash_error']
            . '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        unset($_SESSION['flash_error']);
    }
    return $html;
}

/**
 * Get formatted pricing values for templates.
 * Returns: starter_price, pro_monthly, pro_annual, pro_annual_monthly (per-month when billed annually)
 * All values are formatted dollar strings (e.g., "$5.00", "$2")
 */
function getPricingDisplay(): array
{
    static $cached = null;
    if ($cached !== null) return $cached;

    $pricing = Subscription::getPricing();
    $starterCents = (int) $pricing['starter_onetime'];
    $proMonthlyCents = (int) $pricing['pro_monthly'];
    $proAnnualCents = (int) $pricing['pro_annual'];

    // Format: remove trailing zeros for clean display ($5 not $5.00, but $1.58 stays)
    $fmt = function(int $cents): string {
        $dollars = $cents / 100;
        return ($dollars == (int) $dollars) ? '$' . (int) $dollars : '$' . number_format($dollars, 2);
    };

    $cached = [
        'starter_price'       => $fmt($starterCents),
        'pro_monthly'         => $fmt($proMonthlyCents),
        'pro_annual'          => $fmt($proAnnualCents),
        'pro_annual_monthly'  => '$' . number_format($proAnnualCents / 100 / 12, 2),
    ];
    return $cached;
}
