<?php
/**
 * CV render fixture harness.
 *
 * Phase 2 scope: data-layer regression coverage.
 * - Loads JSON fixtures from tests/pdf_fixtures/.
 * - Runs them through CvDataNormalizer and CvDisplayPolicy.
 * - Asserts the cleaned output matches expectations encoded below.
 *
 * Future extension: compile each fixture through xelatex and diff extracted
 * text + page count against tests/baselines/<fixture>.xelatex.txt.
 *
 * Usage:
 *   php tests/render_fixtures.php
 *
 * Exit code 0 on success, non-zero on any failure.
 */

require __DIR__ . '/../app/services/CvDataNormalizer.php';
require __DIR__ . '/../app/services/CvDisplayPolicy.php';

$fixtureDir = __DIR__ . '/pdf_fixtures';
$fixtures = glob($fixtureDir . '/*.json');

if (empty($fixtures)) {
    fwrite(STDERR, "No fixtures found in $fixtureDir\n");
    exit(1);
}

$pass = 0;
$fail = 0;
$failures = [];

function check(string $name, bool $cond, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($cond) {
        $pass++;
        echo "  OK   $name\n";
    } else {
        $fail++;
        $failures[] = "$name :: $detail";
        echo "  FAIL $name -- $detail\n";
    }
}

foreach ($fixtures as $path) {
    $fixture = json_decode(file_get_contents($path), true);
    if (!is_array($fixture)) {
        fwrite(STDERR, "Bad fixture: $path\n");
        $fail++;
        continue;
    }
    $name = $fixture['name'] ?? basename($path, '.json');
    echo "\n[$name] " . ($fixture['description'] ?? '') . "\n";

    $pi = CvDataNormalizer::normalizePersonalInfo($fixture['personal_info'] ?? []);
    $sections = CvDataNormalizer::normalizeSections($fixture['sections'] ?? []);

    // Universal assertions: no empty string values in normalized personal_info.
    $emptyKeys = array_filter($pi, fn($v) => is_string($v) && trim($v) === '');
    check("$name: personal_info has no blank values", empty($emptyKeys),
        'leftover keys: ' . implode(',', array_keys($emptyKeys)));

    // Universal assertions: no entries with empty data arrays.
    $blankEntries = 0;
    foreach ($sections as $s) {
        foreach ($s['entries'] as $e) {
            if (empty($e['data'])) $blankEntries++;
        }
    }
    check("$name: no blank entries survive normalization", $blankEntries === 0,
        "found $blankEntries blank entries");

    // Per-fixture assertions.
    switch ($name) {
        case 'missing_years':
            $edu = $sections[0]['entries'];
            // Build year strings as the renderer would.
            $rendered = array_map(
                fn($e) => CvDataNormalizer::formatYearRange(
                    $e['data']['year_start'] ?? '',
                    $e['data']['year_end'] ?? '',
                    null
                ),
                $edu
            );
            check("$name: '2015'+'2020' -> '2015 -- 2020'", $rendered[0] === '2015 -- 2020', "got '{$rendered[0]}'");
            check("$name: '2013'+''   -> '2013'",          $rendered[1] === '2013',          "got '{$rendered[1]}'");
            check("$name: ''+'2012'   -> '2012'",          $rendered[2] === '2012',          "got '{$rendered[2]}'");
            check("$name: ''+''       -> ''",              $rendered[3] === '',              "got '{$rendered[3]}'");
            check("$name: '2021'+'2021' -> '2021'",        $rendered[4] === '2021',          "got '{$rendered[4]}'");
            // None of the rendered strings should contain a dangling ' -- '.
            foreach ($rendered as $idx => $r) {
                check("$name: entry $idx has no dangling separator",
                    !preg_match('/(^|\s)--$|^--\s/', $r), "got '$r'");
            }
            break;

        case 'empty_entries':
            check("$name: only the real publication remains",
                count($sections[0]['entries']) === 1,
                'remaining: ' . count($sections[0]['entries']));
            check("$name: full_name was trimmed",
                ($pi['full_name'] ?? '') === 'Test User',
                "got '" . ($pi['full_name'] ?? '') . "'");
            check("$name: blank phone is dropped", !isset($pi['phone']), 'phone still present');
            check("$name: empty website is dropped", !isset($pi['website']), 'website still present');
            break;

        case 'multilingual':
            check("$name: accented full_name preserved",
                ($pi['full_name'] ?? '') === 'Núria Català-Müller',
                "got '" . ($pi['full_name'] ?? '') . "'");
            check("$name: Catalan section name preserved",
                $sections[0]['display_name'] === 'Experiència Professional',
                "got '{$sections[0]['display_name']}'");
            break;

        case 'long_titles':
            check("$name: long position preserved verbatim",
                str_contains($sections[0]['entries'][0]['data']['position'], 'Cosmological Simulations'),
                'long title was clipped');
            break;
    }

    // Display policy assertions: defaults match production.
    $policyDefault = CvDisplayPolicy::resolve([]);
    check("$name: default policy hides scholar", $policyDefault['showScholar'] === false);
    check("$name: default policy shows linkedin", $policyDefault['showLinkedIn'] === true);

    $policyCustom = CvDisplayPolicy::resolve(['showScholar' => true, 'showLinkedIn' => false]);
    check("$name: policy honors style_config override (scholar)", $policyCustom['showScholar'] === true);
    check("$name: policy honors style_config override (linkedin)", $policyCustom['showLinkedIn'] === false);
}

echo "\n========================================\n";
echo "$pass passed, $fail failed\n";
if ($fail > 0) {
    echo "\nFailures:\n";
    foreach ($failures as $f) echo "  - $f\n";
}
exit($fail === 0 ? 0 : 1);
