<?php
/**
 * RendererFactory
 *
 * Runtime decision point for PDF compilation.
 *
 * One-shot cutover: production compilation is latex-only. We still read legacy
 * config values (including "fpdf") and normalize them to "latex" so existing
 * rows in users/template/site settings remain non-breaking.
 */
class RendererFactory
{
    public const ENGINE_LATEX = 'latex';

    /**
     * Build a renderer for the given profile.
     *
     * @param int|null    $profileId  Used to look up template/user preferences (optional).
     * @param string|null $override   Force a specific engine, bypassing all lookups.
     */
    public static function make(?int $profileId = null, ?string $override = null): RendererInterface
    {
        $engine = self::normalizeEngine($override ?? self::resolveEngine($profileId));

        return self::instantiate($engine);
    }

    /**
     * Resolve the engine name without instantiating anything. Useful for
     * logging and admin diagnostics.
     *
     * Resolution order still reads historical settings but always normalizes to
     * latex so legacy "fpdf" rows do not break after the cutover.
     */
    public static function resolveEngine(?int $profileId): string
    {
        $settings = self::loadSiteSettings();

        if ($profileId !== null) {
            // 1. User preference
            if (($settings['pdf_engine_user_override'] ?? '0') === '1') {
                $userEngine = self::engineFromUser($profileId);
                if ($userEngine !== null) {
                    return self::normalizeEngine($userEngine);
                }
            }

            // 2. Template setting
            if (($settings['pdf_engine_template_override'] ?? '1') === '1') {
                $templateEngine = self::engineFromTemplate($profileId);
                if ($templateEngine !== null) {
                    return self::normalizeEngine($templateEngine);
                }
            }
        }

        // 3. Site default (legacy-safe; fpdf maps to latex)
        $siteDefault = $settings['pdf_engine_default'] ?? self::ENGINE_LATEX;
        if (is_string($siteDefault) && $siteDefault !== '') {
            return self::normalizeEngine($siteDefault);
        }

        // 4. Hard default
        return self::ENGINE_LATEX;
    }

    /**
     * Legacy compatibility: any historical value is collapsed to latex.
     */
    private static function normalizeEngine(?string $engine): string
    {
        $engine = strtolower(trim((string) $engine));
        if ($engine === 'fpdf' || $engine === 'xelatex' || $engine === self::ENGINE_LATEX) {
            return self::ENGINE_LATEX;
        }
        return self::ENGINE_LATEX;
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
            if (is_string($engine) && $engine !== '') {
                return self::normalizeEngine($engine);
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
            if (is_string($engine) && $engine !== '') {
                return self::normalizeEngine($engine);
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
            return new LatexRenderer();
        }

        // LaTeX-only runtime: provide a structured error object if unavailable.
        return new class implements RendererInterface {
            public function compile(int $profileId): array
            {
                return [
                    'success' => false,
                    'error' => 'LaTeX renderer is not available on this host.',
                    'engine' => 'latex',
                ];
            }

            public function name(): string
            {
                return 'latex';
            }
        };
    }
}
