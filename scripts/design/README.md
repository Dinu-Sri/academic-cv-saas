# Local CV design previews (production-faithful)

Generate PDFs for template design review using the **same code path as live compile**:

```
Template / DemoCvDataFactory  OR  CVProfile (MySQL)
        ↓
CvDataNormalizer
        ↓
LatexRenderer::buildDocument  (xelatex document)
        ↓
xelatex × 2 passes
        ↓
storage/design-previews/{label}/cv.pdf + cv.tex + meta.json
```

This is **not** a separate design engine. When you change `LatexRenderer.php`, re-run the script; live and local stay in sync.

## Prerequisites

| Requirement | Local (XAMPP) |
|-------------|----------------|
| PHP | `C:\xampp\php\php.exe` |
| MySQL | Preferred (`academic_cv`); **Classic works offline** without MySQL |
| xelatex | On PATH for PDF (TeX Live / MiKTeX). Without it, script still writes production-identical `cv.tex` |
| Optional `.env` | Same as app if non-default DB |

Check xelatex:

```powershell
where.exe xelatex
# or set full path:
# $env:XELATEX_COMPILER="C:\texlive\2024\bin\windows\xelatex.exe"
```

## Classic first (default)

```powershell
cd c:\xampp\htdocs\academic-cv-saas

# Preferred when MySQL is running (loads template style_config from DB)
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --template=classic

# Force offline Classic fixture (no MySQL) — same DemoCvDataFactory entries + LatexRenderer
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --template=classic --offline
```

Outputs:

- `storage/design-previews/classic/cv.pdf` — open this
- `storage/design-previews/classic/cv.tex` — LaTeX source for iteration
- `storage/design-previews/classic/meta.json` — pipeline metadata

## Other commands

```powershell
# List template aliases
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --list

# Real user CV (exact live compile data)
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --profile-id=12

# Named experiment folder
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --template=classic --label=classic-serif-test

# Temporary style overrides (does not write DB)
C:\xampp\php\php.exe scripts\design\preview_cv_template.php --template=classic --style=margins=1in,pageSize=letter
```

## Template ids

| Alias | Id | Name |
|-------|----|------|
| classic | 1 | Classic |
| modern | 2 | Modern |
| detailed | 3 | Detailed |
| classic-faculty / faculty | 4 | Classic Faculty |
| european / eu | 5 | European Formal |
| research-dossier / dossier | 6 | Research Dossier |

## Design workflow

1. Read `docs/design/CV_TEMPLATE_DESIGN_BRIEF.md`
2. Generate classic baseline PDF
3. Edit **only** production renderer / style_config (no parallel template)
4. Re-run script and compare PDF
5. When happy, commit renderer/style changes; live uses the same path

## Notes

- Demo data comes from `DemoCvDataFactory` (same as marketing demos).
- `style_config` is loaded from the `templates` table; overrides are optional and local-only.
- DB-stored `latex_header` / `latex_footer` / `latex_code` are **not** used by production (see `LatexRenderer` contract).
- Rewrite Next.js PDF worker is a separate stack; this script targets **PHP production xelatex**.
