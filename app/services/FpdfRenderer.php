<?php
/**
 * FpdfRenderer
 *
 * Thin adapter that exposes the existing LatexService FPDF pipeline through
 * RendererInterface. We deliberately delegate rather than copy the ~1700-line
 * implementation: the live engine for 45 production users must not move during
 * the abstraction step.
 *
 * Phase 4 introduces LatexRenderer alongside this adapter. Phase 5 migrates
 * controllers to RendererFactory. After LatexRenderer is proven, the FPDF code
 * will be physically extracted from LatexService into this class.
 */
class FpdfRenderer implements RendererInterface
{
    private LatexService $service;

    public function __construct(?LatexService $service = null)
    {
        $this->service = $service ?? new LatexService();
    }

    public function compile(int $profileId): array
    {
        $start = microtime(true);
        $result = $this->service->compile($profileId);
        $result['engine'] = 'fpdf';
        $result['duration_ms'] = (int) round((microtime(true) - $start) * 1000);
        return $result;
    }

    public function name(): string
    {
        return 'fpdf';
    }
}
