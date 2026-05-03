<?php
/**
 * CvDataNormalizer
 *
 * Pure, stateless helpers that clean CV data before the PDF renderer touches it.
 * Goal: prevent layout bugs caused by malformed/empty values such as dangling
 * year separators, blank entries, or stray whitespace. Used by every renderer
 * backend (FPDF today, LaTeX tomorrow) so behavior stays identical.
 *
 * IMPORTANT: This class never mutates inputs in place; it returns new arrays.
 */
class CvDataNormalizer
{
    /**
     * Normalize personal_info: trim strings, drop empty keys.
     */
    public static function normalizePersonalInfo(array $personalInfo): array
    {
        $clean = [];
        foreach ($personalInfo as $key => $value) {
            if (is_scalar($value)) {
                $trimmed = trim((string) $value);
                if ($trimmed !== '') {
                    $clean[$key] = $trimmed;
                }
            } elseif (is_array($value)) {
                // Preserve structured fields untouched (rare).
                $clean[$key] = $value;
            }
        }
        return $clean;
    }

    /**
     * Normalize a list of CV sections. Each section keeps its metadata, and
     * entries get their fields trimmed and empty entries removed.
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
                        $trimmed = trim((string) $value);
                        if ($trimmed !== '') {
                            $cleanData[$field] = $trimmed;
                        }
                    } elseif (is_array($value)) {
                        $cleanData[$field] = $value;
                    }
                }

                // Skip entries that ended up with no usable content.
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
     *
     * Returns:
     *  - "" when both empty
     *  - "2022"            when only one supplied or both equal
     *  - "2020 -- 2022"    when both present and different
     *  - "2022 -- Present" when end is missing AND fallbackEnd is provided
     */
    public static function formatYearRange(?string $start, ?string $end, ?string $fallbackEnd = null): string
    {
        $start = trim((string) $start);
        $end = trim((string) $end);

        if ($start === '' && $end === '') {
            return '';
        }

        if ($start !== '' && $end === '') {
            if ($fallbackEnd !== null && $fallbackEnd !== '') {
                return $start . ' -- ' . $fallbackEnd;
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
}
