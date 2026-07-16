<?php
/**
 * CvDataNormalizer
 *
 * Pure, stateless helpers that clean CV data before the PDF renderer touches it.
 * Goal: prevent layout bugs caused by malformed/empty values such as dangling
 * year separators, blank entries, stray HTML, or pathological length.
 *
 * IMPORTANT: This class never mutates inputs in place; it returns new arrays.
 *
 * Edge-case policy (see docs/design/CV_GENERATION_EDGE_CASES_AND_PROTOCOLS.md):
 *  - strip HTML/markdown noise that would show as junk in PDF
 *  - collapse whitespace
 *  - soft-cap extreme field lengths (keep start of text + ellipsis)
 *  - normalize open-ended years (Present / Ongoing)
 */
class CvDataNormalizer
{
    /** Soft max for long narrative fields (description, summary, statement). */
    public const MAX_NARRATIVE_CHARS = 4000;

    /** Soft max for single-line titles / names / venues. */
    public const MAX_TITLE_CHARS = 320;

    /** Soft max for URLs / DOIs stored as text. */
    public const MAX_URL_CHARS = 500;

    /** Soft max for short identifiers (phone, years, etc.). */
    public const MAX_SHORT_CHARS = 80;

    /**
     * Normalize personal_info: clean strings, drop empty keys.
     */
    public static function normalizePersonalInfo(array $personalInfo): array
    {
        $clean = [];
        foreach ($personalInfo as $key => $value) {
            if (is_scalar($value)) {
                $field = (string) $key;
                $normalized = self::normalizeScalarField($field, (string) $value);
                if ($normalized !== '') {
                    $clean[$field] = $normalized;
                }
            } elseif (is_array($value)) {
                $clean[$key] = $value;
            }
        }
        return $clean;
    }

    /**
     * Normalize a list of CV sections. Each section keeps its metadata, and
     * entries get their fields cleaned and empty entries removed.
     */
    public static function normalizeSections(array $sections): array
    {
        $out = [];
        foreach ($sections as $section) {
            $entries = $section['entries'] ?? [];
            $cleanEntries = [];

            foreach ($entries as $entry) {
                $data = $entry['data'] ?? [];
                if (!is_array($data)) {
                    continue;
                }

                $cleanData = [];
                foreach ($data as $field => $value) {
                    if (is_scalar($value)) {
                        $normalized = self::normalizeScalarField((string) $field, (string) $value);
                        if ($normalized !== '') {
                            $cleanData[(string) $field] = $normalized;
                        }
                    } elseif (is_array($value)) {
                        $cleanData[$field] = $value;
                    }
                }

                if (empty($cleanData)) {
                    continue;
                }

                $entry['data'] = $cleanData;
                $cleanEntries[] = $entry;
            }

            $section['entries'] = $cleanEntries;
            $out[] = $section;
        }
        return $out;
    }

    /**
     * Format a year range safely. Avoids producing dangling separators or
     * phantom "Present" rows when both start and end are missing.
     */
    public static function formatYearRange(?string $start, ?string $end, ?string $fallbackEnd = null): string
    {
        $start = self::normalizeYearToken($start);
        $end = self::normalizeYearToken($end);

        if ($start === '' && $end === '') {
            return '';
        }

        if ($start !== '' && $end === '') {
            if ($fallbackEnd !== null && $fallbackEnd !== '') {
                return $start . ' -- ' . self::normalizeYearToken($fallbackEnd);
            }
            return $start;
        }

        if ($start === '' && $end !== '') {
            return $end;
        }

        if (strcasecmp($start, $end) === 0) {
            return $start;
        }

        return $start . ' -- ' . $end;
    }

    /**
     * Clean one scalar field according to field kind.
     */
    public static function normalizeScalarField(string $field, string $value): string
    {
        $value = self::stripHtmlAndNoise($value);
        $value = self::collapseWhitespace($value);
        if ($value === '') {
            return '';
        }

        $fieldLower = strtolower($field);

        if (self::isYearishField($fieldLower)) {
            return self::normalizeYearToken($value);
        }

        if (self::isUrlishField($fieldLower)) {
            return self::softCap($value, self::MAX_URL_CHARS);
        }

        if (self::isNarrativeField($fieldLower)) {
            return self::softCap($value, self::MAX_NARRATIVE_CHARS);
        }

        if (self::isShortField($fieldLower)) {
            return self::softCap($value, self::MAX_SHORT_CHARS);
        }

        // Default: titles, names, venues, orgs.
        return self::softCap($value, self::MAX_TITLE_CHARS);
    }

    public static function stripHtmlAndNoise(string $value): string
    {
        // Decode entities first so &amp; → & (escaper will re-escape for LaTeX).
        if (str_contains($value, '&') || str_contains($value, '&#')) {
            $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        // Strip tags but keep text content.
        if (str_contains($value, '<') && str_contains($value, '>')) {
            $value = strip_tags($value);
        }

        // Common import noise: zero-width chars, BOM.
        $value = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $value) ?? $value;

        // Keep **bold** markers — LatexRenderer::escapeInline converts them to \textbf.
        return $value;
    }

    public static function collapseWhitespace(string $value): string
    {
        // Normalize newlines to \n, collapse runs of spaces/tabs, trim.
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = preg_replace('/[ \t]+/u', ' ', $value) ?? $value;
        // Keep paragraph breaks but cap blank-line runs.
        $value = preg_replace("/\n{3,}/u", "\n\n", $value) ?? $value;
        return trim($value);
    }

    public static function softCap(string $value, int $maxChars): string
    {
        if ($maxChars < 8) {
            return $value;
        }
        $len = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if ($len <= $maxChars) {
            return $value;
        }
        $keep = $maxChars - 1;
        $cut = function_exists('mb_substr') ? mb_substr($value, 0, $keep, 'UTF-8') : substr($value, 0, $keep);
        $cut = rtrim($cut, " \t\n\r.,;:-");
        return $cut . '…';
    }

    public static function normalizeYearToken(?string $value): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }

        $lower = strtolower($value);
        $present = ['present', 'current', 'now', 'today', 'date'];
        if (in_array($lower, $present, true)) {
            return 'Present';
        }
        $ongoing = ['ongoing', 'in progress', 'in-progress', 'continuing'];
        if (in_array($lower, $ongoing, true)) {
            return 'Ongoing';
        }

        // Collapse "2019 - present" style single-field ranges later in formatYearRange.
        return self::collapseWhitespace($value);
    }

    private static function isYearishField(string $field): bool
    {
        return in_array($field, [
            'year', 'year_start', 'year_end', 'start_year', 'end_year',
            'date', 'declaration_date',
        ], true) || str_ends_with($field, '_year');
    }

    private static function isUrlishField(string $field): bool
    {
        return in_array($field, [
            'url', 'website', 'doi', 'google_scholar', 'linkedin', 'orcid',
            'scopus', 'github', 'researchgate', 'personal_website',
        ], true) || str_contains($field, 'url') || str_ends_with($field, '_link');
    }

    private static function isNarrativeField(string $field): bool
    {
        return in_array($field, [
            'description', 'summary', 'details', 'statement', 'bio',
            'abstract', 'notes', 'additional_details',
        ], true);
    }

    private static function isShortField(string $field): bool
    {
        return in_array($field, [
            'phone', 'mobile', 'gpa', 'status', 'level', 'code',
            'volume', 'issue', 'pages', 'credential_id', 'grant_number',
            'patent_number', 'proficiency', 'signature_mode',
        ], true);
    }
}
