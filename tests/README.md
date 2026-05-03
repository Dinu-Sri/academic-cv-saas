# CV Render Regression Harness

Lightweight regression coverage for the CV PDF pipeline.

## Layout

```
tests/
  render_fixtures.php        # Phase 2 — data-layer regression
  test_year_range.php        # focused unit test for formatYearRange
  test_renderer_factory.php  # Phase 3 — RendererInterface + factory smoke test
  pdf_fixtures/              # JSON inputs (one scenario per file)
    long_titles.json
    missing_years.json
    multilingual.json
    empty_entries.json
  baselines/                 # (Phase 4+) approved text/layout snapshots
```

## Running

```powershell
C:\xampp\php\php.exe tests\render_fixtures.php
C:\xampp\php\php.exe tests\test_year_range.php
C:\xampp\php\php.exe tests\test_renderer_factory.php
```

All three must exit 0 before pushing. The factory test skips live-instantiation
assertions when MySQL isn't reachable (e.g. CI without a DB) so it stays useful
in any environment.

## Adding a fixture

1. Drop a new `*.json` file in `pdf_fixtures/` with `name`, `description`, `personal_info`, and `sections`.
2. Add per-fixture assertions in the `switch ($name)` block of `render_fixtures.php`.

## Roadmap

- **Phase 2 (current):** Data-layer regression — exercises `CvDataNormalizer` and `CvDisplayPolicy` only.
- **Phase 3:** When `RendererInterface` lands, the harness will compile each fixture through every backend (FPDF + xelatex) and diff extracted text + page count against `baselines/<fixture>.<engine>.txt`. A reviewer command will refresh baselines.
- **Phase 4+:** Right-aligned-date X-position checks via PDF coordinate inspection to catch layout drift.
