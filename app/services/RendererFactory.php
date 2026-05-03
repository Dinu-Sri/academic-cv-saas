<?php
/**
 * RendererFactory
 *
 * Single decision point for "which PDF engine renders this profile?".
 *
 * Resolution order (first match wins):
 *   1. Explicit override passed to make() — used by tests and admin tools.
 *   2. User preference  : users.cv_settings.preferred_pdf_engine
 *      (gated by site_settings.pdf_engine_user_override = '1')
 *   3. Template setting : templates.style_config.engine
 *      (gated by site_settings.pdf_engine_template_override = '1')
 *   4. Site default     : site_settings.pdf_engine_default
 *   5. Hard default     : "fpdf"
 *
 * Circuit breaker: any non-FPDF engine with >2% failure rate in the last hour
 * (with >=10 samples) is downgraded to "fpdf" automatically. Protects users
 * without requiring a manual flag flip.
 *
 * If a non-default engine is requested but its class is unavailable (e.g. the
 * LaTeX-enabled Docker image isn't deployed yet), we silently fall back to
 * FpdfRenderer to preserve uptime.
 */
class RendererFactory
{
    public const ENGINE_FPDF = 'fpdf';
    public const ENGINE_LATEX = 'latex';

    /**
     * Build a renderer for the given profile.
     *
     * @param int|null    $profileId  Used to look up template/user preferences (optional).
     * @param string|null $override   Force a specific engine, bypassing all lookups.
     */
    public static function make(?int $profileId = null, ?string $override = null): RendererInterface
    {
        $engine = $override ?? self::resolveEngine($profileId);

        return self::instantiate($engine);
    }

    /**
     * Resolve the engine name without instantiating anything. Useful for
     * logging and admin diagnostics.
     *
     * Resolution order (first match wins):
     *   1. User preference   : users.cv_settings.preferred_pdf_engine
     *      (only when site_settings.pdf_engine_user_override = '1')
     *   2. Template setting  : templates.style_config.engine
     *      (only when site_settings.pdf_engine_template_override = '1')
     *   3. Site default      : site_settings.pdf_engine_default
     *   4. Hard default      : "fpdf"
     *
     * Circuit breaker: if recent failure rate for a non-FPDF engine exceeds
     * 2% in the last hour (>=10 samples), force-return fpdf. This protects
     * users while ops investigates without needing a manual flag flip.
     */
    public static function resolveEngine(?int $profileId): string
    {
        $settings = self::loadSiteSettings();

        if ($profileId !== null) {
            // 1. User preference
            if (($settings['pdf_engine_user_override'] ?? '0') === '1') {
                $userEngine = self::engineFromUser($profileId);
                if ($userEngine !== null) {
                    return self::circuitBreak($userEngine);
                }
            }

            // 2. Template setting
            if (($settings['pdf_engine_template_override'] ?? '1') === '1') {
                $templateEngine = self::engineFromTemplate($profileId);
                if ($templateEngine !== null) {
                    return self::circuitBreak($templateEngine);
                }
            }
        }

        // 3. Site default
        $siteDefault = $settings['pdf_engine_default'] ?? self::ENGINE_FPDF;
        if ($siteDefault === self::ENGINE_FPDF || $siteDefault === self::ENGINE_LATEX) {
            return self::circuitBreak($siteDefault);
        }

        // 4. Hard default
        return self::ENGINE_FPDF;
    }

    /**
     * Trip back to FPDF if the requested engine has been failing too often.
     * No-op for fpdf itself.
     */
    private static function circuitBreak(string $engine): string
    {
        if ($engine === self::ENGINE_FPDF) {
            return $engine;
        }
        if (class_exists('PdfRenderMetrics')) {
            $rate = PdfRenderMetrics::recentFailureRate($engine, 60);
            if ($rate > 0.02) {
                error_log("RendererFactory: circuit breaker tripped for {$engine} (rate=" . round($rate, 3) . "); falling back to fpdf");
                return self::ENGINE_FPDF;
            }
        }
        return $engine;
    }

    /**
     * Load engine-related site_settings rows. Returns an associative map.
     * Returns an empty array on any DB error so default behavior survives.
     *
     * Cached for the life of the request so repeat factory calls don't
     * re-query. Pre-flight socket probe avoids triggering the Database
     * singleton's hard die() when MySQL is unreachable (e.g. local CLI tests).
     */
    private static ?array $cachedSettings = null;

    private static function loadSiteSettings(): array
    {
        if (self::$cachedSettings !== null) {
            return self::$cachedSettings;
        }

        // Quick socket probe. If MySQL isn't reachable, return empty rather
        // than letting the Database singleton's die() abort the request.
        if (!self::isDatabaseReachable()) {
            return self::$cachedSettings = [];
        }

        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->query(
                "SELECT setting_key, setting_value
                   FROM site_settings
                  WHERE setting_key IN
                        ('pdf_engine_default', 'pdf_engine_template_override', 'pdf_engine_user_override')"
            );
            $out = [];
            foreach ($stmt->fetchAll() ?: [] as $row) {
                $out[$row['setting_key']] = $row['setting_value'];
            }
            return self::$cachedSettings = $out;
        } catch (\Throwable $e) {
            return self::$cachedSettings = [];
        }
    }

    private static function isDatabaseReachable(): bool
    {
        static $reachable = null;
        if ($reachable !== null) {
            return $reachable;
        }
        $fp = @fsockopen(DB_HOST, (int) DB_PORT, $errno, $errstr, 0.5);
        if ($fp) {
            fclose($fp);
            return $reachable = true;
        }
        return $reachable = false;
    }

    private static function engineFromUser(int $profileId): ?string
    {
        if (!self::isDatabaseReachable()) {
            return null;
        }
        try {
            $cvModel = new CVProfile();
            $profile = $cvModel->findById($profileId);
            if (!$profile || empty($profile['user_id'])) {
                return null;
            }
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare("SELECT cv_settings FROM users WHERE id = ?");
            $stmt->execute([(int) $profile['user_id']]);
            $row = $stmt->fetch();
            if (!$row || empty($row['cv_settings'])) {
                return null;
            }
            $settings = json_decode((string) $row['cv_settings'], true);
            if (!is_array($settings)) {
                return null;
            }
            $engine = $settings['preferred_pdf_engine'] ?? null;
            if ($engine === self::ENGINE_FPDF || $engine === self::ENGINE_LATEX) {
                return $engine;
            }
        } catch (\Throwable $e) {
            error_log('RendererFactory: user-preference lookup failed: ' . $e->getMessage());
        }
        return null;
    }

    private static function engineFromTemplate(int $profileId): ?string
    {
        if (!self::isDatabaseReachable()) {
            return null;
        }
        try {
            $cvModel = new CVProfile();
            $profile = $cvModel->findById($profileId);
            if (!$profile || empty($profile['template_id'])) {
                return null;
            }

            $templateModel = new Template();
            $template = $templateModel->findById((int) $profile['template_id']);
            if (!$template) {
                return null;
            }

            $config = $template['style_config'] ?? [];
            if (!is_array($config)) {
                return null;
            }

            $engine = $config['engine'] ?? null;
            if ($engine === self::ENGINE_FPDF || $engine === self::ENGINE_LATEX) {
                return $engine;
            }
        } catch (\Throwable $e) {
            // Never let engine resolution break PDF generation.
            error_log('RendererFactory: engine resolution failed: ' . $e->getMessage());
        }
        return null;
    }

    private static function instantiate(string $engine): RendererInterface
    {
        if ($engine === self::ENGINE_LATEX && class_exists('LatexRenderer')) {
            // Wrap in FallbackRenderer so any failure in xelatex (missing
            // binary, compile error, timeout) transparently degrades to FPDF
            // for the end user. Production safety net for the 45 live users.
            return new FallbackRenderer(new LatexRenderer());
        }
        // Default + safe fallback path.
        return new FpdfRenderer();
    }
}
