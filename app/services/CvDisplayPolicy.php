<?php
/**
 * CvDisplayPolicy
 *
 * Centralized rules for "should we render X in the header / contact line?".
 * Reading these from style_config (with safe defaults) lets templates and
 * admins toggle visibility without touching renderer code.
 *
 * Defaults reflect the current production behavior (Scholar hidden, LinkedIn
 * shown, full URLs shortened) so wiring this in is a no-op.
 */
class CvDisplayPolicy
{
    /** Defaults — keep aligned with current production behavior. */
    private const DEFAULTS = [
        'showScholar'   => false, // Google Scholar link in header
        'showLinkedIn'  => true,
        'showScopus'    => true,
        'showOrcid'     => true,
        'showWebsite'   => true,
        'showFullUrl'   => false, // false = shortened display, true = full URL
    ];

    /**
     * Resolve policy flags from a style_config array, falling back to defaults.
     */
    public static function resolve(array $styleConfig): array
    {
        $resolved = self::DEFAULTS;
        foreach ($resolved as $key => $default) {
            if (array_key_exists($key, $styleConfig)) {
                $resolved[$key] = (bool) $styleConfig[$key];
            }
        }
        return $resolved;
    }

    /**
     * Convenience: should the given personal_info field be rendered?
     */
    public static function shouldShow(string $field, array $styleConfig): bool
    {
        $policy = self::resolve($styleConfig);
        return match ($field) {
            'google_scholar', 'scholar', 'scholar_url' => $policy['showScholar'],
            'linkedin', 'linkedin_url'                  => $policy['showLinkedIn'],
            'scopus', 'scopus_url'                      => $policy['showScopus'],
            'orcid', 'orcid_id'                         => $policy['showOrcid'],
            'website', 'personal_website'               => $policy['showWebsite'],
            default                                     => true,
        };
    }
}
