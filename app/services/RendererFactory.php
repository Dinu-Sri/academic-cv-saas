<?php
/**
 * RendererFactory
 *
 * Single decision point for "which PDF engine renders this profile?".
 *
 * Resolution order (first match wins):
 *   1. Explicit override passed to make() — used by tests and admin tools.
 *   2. User preference  : user_cv_settings.preferred_pdf_engine (Phase 5).
 *   3. Template setting : style_config.engine ("fpdf" | "latex").
 *   4. Feature flag     : feature_flags.pdf_engine_default (Phase 5).
 *   5. Hard default     : "fpdf".
 *
 * Until Phase 5 lands, only #1, #3 and #5 are wired so the live default stays
 * exactly the same for all 45 users.
 *
 * If a non-default engine is requested but its class is unavailable (e.g. the
 * LaTeX-enabled Docker image isn't deployed yet), we silently fall back to
 * FpdfRenderer to preserve uptime. Metrics will record the fallback in Phase 5.
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
     */
    public static function resolveEngine(?int $profileId): string
    {
        if ($profileId !== null) {
            $templateEngine = self::engineFromTemplate($profileId);
            if ($templateEngine !== null) {
                return $templateEngine;
            }
        }
        return self::ENGINE_FPDF;
    }

    private static function engineFromTemplate(int $profileId): ?string
    {
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
            return new LatexRenderer();
        }
        // Default + safe fallback path.
        return new FpdfRenderer();
    }
}
