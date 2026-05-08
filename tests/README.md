# CV Render Regression Harness

Lightweight regression coverage for the CV PDF pipeline.

## Layout

```
tests/
  render_fixtures.php        # Phase 2 — data-layer regression
  test_year_range.php        # focused unit test for formatYearRange
  test_renderer_factory.php  # RendererInterface + LaTeX-only factory smoke test
  test_latex_renderer.php    # LatexEscaper + LatexRenderer smoke test
  test_phase5_factory.php    # LaTeX-only factory + metrics checks
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
C:\xampp\php\php.exe tests\test_latex_renderer.php
C:\xampp\php\php.exe tests\test_phase5_factory.php
```

All commands must exit 0 before pushing. Renderer tests are written to stay
useful even when MySQL or xelatex is unavailable locally.

## Adding a fixture

1. Drop a new `*.json` file in `pdf_fixtures/` with `name`, `description`, `personal_info`, and `sections`.
2. Add per-fixture assertions in the `switch ($name)` block of `render_fixtures.php`.

## Roadmap

- **Phase 2 (current):** Data-layer regression — exercises `CvDataNormalizer` and `CvDisplayPolicy` only.
- **Phase 3:** `RendererInterface` is now LaTeX-only. Future fixture rendering should target xelatex baselines under `baselines/<fixture>.xelatex.txt`.
- **Phase 4+:** Right-aligned-date X-position checks via PDF coordinate inspection to catch layout drift.
