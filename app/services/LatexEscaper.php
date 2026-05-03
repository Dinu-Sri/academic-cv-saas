<?php
/**
 * LatexEscaper
 *
 * Pure escaper for arbitrary user input that will land inside a LaTeX
 * document. Kept separate from LatexRenderer so it can be unit-tested without
 * any filesystem or process dependency.
 *
 * Reference for the special-character set:
 *   https://en.wikibooks.org/wiki/LaTeX/Special_Characters
 */
class LatexEscaper
{
    /** Special characters that need escaping in regular text. */
    private const REPLACEMENTS = [
        '\\' => '\\textbackslash{}',
        '&'  => '\\&',
        '%'  => '\\%',
        '$'  => '\\$',
        '#'  => '\\#',
        '_'  => '\\_',
        '{'  => '\\{',
        '}'  => '\\}',
        '~'  => '\\textasciitilde{}',
        '^'  => '\\textasciicircum{}',
    ];

    /**
     * Escape a single string for safe inclusion in LaTeX text.
     *
     * IMPORTANT: backslash MUST be replaced first, otherwise subsequent
     * substitutions (which themselves emit backslashes) get re-escaped.
     */
    public static function escape(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $out = str_replace('\\', "\x00BACKSLASH\x00", $value);
        foreach (self::REPLACEMENTS as $from => $to) {
            if ($from === '\\') continue;
            $out = str_replace($from, $to, $out);
        }
        $out = str_replace("\x00BACKSLASH\x00", self::REPLACEMENTS['\\'], $out);

        // Preserve user line breaks as LaTeX paragraph breaks.
        $out = preg_replace("/\r\n|\r|\n/", " \\\\\\\\\n", $out);

        return $out;
    }

    /**
     * Escape every scalar value in an associative array.
     */
    public static function escapeArray(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            if (is_string($v)) {
                $out[$k] = self::escape($v);
            } elseif (is_scalar($v)) {
                $out[$k] = self::escape((string) $v);
            } else {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    /**
     * Escape a URL while keeping it usable inside \href{}{}. URLs use a small
     * subset of LaTeX-special chars (`#`, `%`, `&`, `_`, `~`) that must be
     * escaped; everything else is left as-is so the link still resolves.
     */
    public static function escapeUrl(string $url): string
    {
        $url = str_replace(["\r", "\n", '{', '}'], ['', '', '%7B', '%7D'], $url);
        return '\\detokenize{' . $url . '}';
    }
}
