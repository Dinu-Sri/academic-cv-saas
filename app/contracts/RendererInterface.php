<?php
/**
 * RendererInterface
 *
 * Contract every PDF renderer backend must satisfy. The compile() result shape
 * is the de-facto contract used by controllers (success, pdf_path or error).
 *
 * Backend:
 *  - LatexRenderer — production xelatex backend.
 *
 * New backends MUST keep the same return shape so callers never branch on engine.
 */
interface RendererInterface
{
    /**
     * Compile a CV profile to a PDF on disk.
     *
     * @param int $profileId
     * @return array{
     *     success: bool,
     *     pdf_path?: string,
     *     error?: string,
     *     engine?: string,
     *     duration_ms?: int
     * }
     */
    public function compile(int $profileId): array;

    /**
    * Short identifier for logging / metrics (e.g. "latex", "xelatex").
     */
    public function name(): string;
}
