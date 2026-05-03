<?php
/**
 * FallbackRenderer
 *
 * Decorator that wraps a primary renderer (typically LatexRenderer) and
 * transparently retries with FpdfRenderer on any structured failure.
 *
 * Why not let callers try/catch?
 *   - Renderer contract guarantees no exceptions, only success=false. Each
 *     controller would otherwise need identical fallback boilerplate.
 *   - Centralizing the fallback here gives us one place to record metrics
 *     (Phase 5 hooks) and to enforce circuit-breaker behavior if the primary
 *     engine starts failing too often.
 *
 * Behavior:
 *   - If primary returns success=true, that result is returned verbatim
 *     (already tagged with engine and duration_ms).
 *   - If primary returns success=false, FpdfRenderer is invoked. The final
 *     result includes:
 *       engine          = "fpdf"
 *       primary_engine  = name of the primary that failed
 *       fallback        = true
 *       primary_error   = the error string from the primary attempt
 *     so logs and admin UIs can distinguish a "clean" FPDF render from a
 *     fallback caused by a LaTeX failure.
 */
class FallbackRenderer implements RendererInterface
{
    private RendererInterface $primary;
    private ?FpdfRenderer $secondary;

    public function __construct(RendererInterface $primary, ?FpdfRenderer $secondary = null)
    {
        $this->primary = $primary;
        $this->secondary = $secondary;
    }

    public function name(): string
    {
        return $this->primary->name();
    }

    public function compile(int $profileId): array
    {
        $result = $this->primary->compile($profileId);
        if (($result['success'] ?? false) === true) {
            return $result;
        }

        $primaryName = $this->primary->name();
        $primaryError = $result['error'] ?? 'unknown error';

        // Avoid recursion: never wrap fpdf in a fallback to fpdf.
        if ($primaryName === 'fpdf') {
            return $result;
        }

        $fallback = $this->secondary ?? new FpdfRenderer();
        $fbResult = $fallback->compile($profileId);
        $fbResult['primary_engine'] = $primaryName;
        $fbResult['primary_error']  = $primaryError;
        $fbResult['fallback']       = true;

        // Best-effort log so ops can see when fallbacks happen without needing
        // an admin UI yet. Uses error_log to avoid pulling in a logger here.
        error_log(sprintf(
            'RendererFallback: primary=%s failed (%s); served via fpdf for profile %d',
            $primaryName,
            substr($primaryError, 0, 200),
            $profileId
        ));

        return $fbResult;
    }
}
