# CVScholar — Academic CV Template Design Brief

**Status:** Classic production design is **live in main system** via `LatexRenderer` + edge-case automation + template style defaults (migration `049_classic_cv_production_design.sql`).  
**Last updated:** 2026-07-16  
**Stack constraint:** PHP production PDF = `LatexRenderer` + `xelatex` (Latin Modern). No parallel design engines.  
**Agent knowledge:** Permanent chunks in `academic_cv_guidance` / `cvscholar_product` (Prisma migration `202607160003_classic_cv_knowledge`).

---

## 1. Purpose

Improve visual quality of CVScholar’s six academic CV templates while remaining **credible to faculty search committees, postdoc panels, and P&T readers**. “Modern” means refined typography and hierarchy—not corporate resume gimmicks.

### Success criteria

| Criterion | Definition |
|-----------|------------|
| Credibility | Looks like a document a serious academic would submit |
| Scannability | Section heads and entry titles readable in &lt; 10s skim |
| Fidelity | Local design PDF ≡ live compile (same renderer + data path) |
| Consistency | Shared layout system; templates are variants, not unrelated themes |
| Density | Multi-page OK; avoid sparse “one page marketing” layouts |
| Accessibility of print | Works in B&W print; no reliance on color alone |

---

## 2. Research synthesis (what “respected” means)

Sources consulted: Penn Career Services faculty CVs, MIT CAPD samples, Cornell Grad School, Oxford Careers, Dr. Karen Kelsky (*The Professor Is In*), PMC high-quality CV guide (academic medicine), NIH/NSF biosketch norms (for contrast), Wordvice academic CV format notes, LaTeX academic CV ecosystems (Awesome-CV / research-cv).

### Universal committee-friendly rules

1. **Single column** body (never dual skill-bar columns for faculty CVs).
2. **Reverse chronological** within each section.
3. **Dates on the right**, role/title/degree on the left (dates must not dominate left margin).
4. **~1″ margins** (US faculty); EU can be slightly tighter but still ≥ 0.7″.
5. **11–12 pt body**; name larger only at header (14–16 pt).
6. **One type family** for body; limited weight hierarchy (regular / bold / italic).
7. **Italics reserved** for journal/book titles and org subtitles—not for decoration.
8. **Name + page numbers** on multi-page documents.
9. **No photos, skill meters, icons, or rainbow accents** on the default academic set.
10. **Empty sections omitted** (except explicit scaffold modes).

### Regional notes

| Market | Bias |
|--------|------|
| **US faculty / postdoc** | Airier, 12 pt, 1″ margins, bold section heads, long CVs OK |
| **UK / Europe** | Often denser; still formal; country-specific personal data rules (photos: do **not** force on US templates) |
| **Grant biosketch** | Separate product (page-capped, funder schema)—not a full CV template |

### References (priority reading)

1. [Penn – CVs for Faculty Job Applications](https://careerservices.upenn.edu/application-materials-for-the-faculty-job-search/cvs-for-faculty-job-applications/) (+ sample PDFs)
2. [Dr. Karen’s Rules of the Academic CV](https://theprofessorisin.com/2016/08/19/dr-karens-rules-of-the-academic-cv/)
3. [MIT CAPD – Curricula vitae](https://capd.mit.edu/resources/cvs/)
4. [Cornell – Resumes and CVs](https://gradschool.cornell.edu/career-and-professional-development/pathways-to-success/prepare-for-your-career/take-action/resumes-and-cvs/)
5. [Oxford Careers – CVs](https://www.careers.ox.ac.uk/cvs)
6. [PMC – High-quality curriculum vitae](https://pmc.ncbi.nlm.nih.gov/articles/PMC8678947/)
7. [Wordvice – Academic CV examples/format](https://wordvice.com/blog/academic-cv-examples-format/)
8. [Awesome-PhD-CV / research-cv (LaTeX)](https://github.com/LimHyungTae/Awesome-PhD-CV)

---

## 3. Production data flow (must not change for previews)

```
┌─────────────────────┐     ┌──────────────────────┐
│ templates           │     │ cv_profiles +         │
│ style_config JSON   │     │ sections + entries    │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          ▼                            ▼
   Template::findById          CVProfile::getSections
          │                            │
          └────────────┬───────────────┘
                       ▼
              CvDataNormalizer
           (trim, drop empty fields)
                       ▼
         LatexRenderer::buildDocument
           (escape via LatexEscaper)
                       ▼
              xelatex (2 passes)
                       ▼
                 PDF bytes
```

| Piece | Role |
|-------|------|
| `templates.style_config` | margins, pageSize, display flags (`CvDisplayPolicy`), colors |
| `DemoCvDataFactory` | Marketing / design demo payload per `template_id` |
| `CvDataNormalizer` | Same cleaning as live |
| `LatexEscaper` | All user strings |
| `CvDisplayPolicy` | ORCID / LinkedIn / website / Scholar visibility |
| `LatexRenderer` | **Only** production layout builder for free+pro CV PDFs |

**Not used in production PDF:** DB `latex_header`, `latex_footer`, `latex_code` fragments.

**Live rewrite path:** `apps/web/src/lib/latex.ts` + pdf-worker on `rewrite.cvscholar.com` (verify `/api/version`). PHP `LatexRenderer` remains the legacy PHP stack path.

---

## 4. Shared design system (all six templates)

### 4.1 Grid & page

| Token | Default (Classic baseline) | Notes |
|-------|----------------------------|--------|
| Page | A4 (`a4paper`) | Letter optional via `pageSize` |
| Margins | 1 in (~2.54 cm) | Classic Faculty may match; Modern may go 0.75 in |
| Body size | 11 pt | Detailed may use 10–11 pt |
| Body font | Latin Modern Roman | XeLaTeX `fontspec` |
| Text measure | Full text width, single column | No sidebars |
| Vertical rhythm | Section gap ~0.85 em; entry parskip modest | Avoid large empty voids |

### 4.2 Type hierarchy

| Element | Spec |
|---------|------|
| Name | Centered, 16–18 pt bold (Classic starts design work) |
| Tagline (title, affiliation) | Centered, normalsize, no leading commas |
| Contact line | Centered, small, mid-dot separators, muted gray |
| Section title | Left, large bold, **sentence case or title case—not full shouty ALL CAPS** unless template variant requires; thin rule under |
| Entry title | Bold left |
| Entry dates | Small, right-aligned, muted |
| Entry org | Italic, muted |
| Entry body | Roman, ragged-right, emergency stretch for long URLs |
| Publications | Consistent citation style per entry fields; journal titles italic when present |

### 4.3 Color

| Token | Classic | Principle |
|-------|---------|-----------|
| Primary (heads/rules) | Near black `#000000` | Print-safe; colored heads only on explicit variants |
| Rules | Cool gray ~78% | Subtle separation |
| Muted text | black!55–70 | Dates, contact |
| Links | hidelinks | No blue URL circus in print |

### 4.4 Section order (rendering)

Production already reorders special sections (declarations, references, publications, etc.). Design must **respect `orderSectionsForRendering`** and template section visibility—not invent a second order for demos.

Typical academic order (content priority):

1. Header (name / identity)
2. Profile / summary (if present)
3. Education
4. Appointments / experience
5. Publications (often weighted early for research roles)
6. Research interests / projects
7. Teaching
8. Grants / awards
9. Service / memberships
10. Skills / languages
11. References / declaration (late)

Templates may **reweight** via section order in DB, not by hardcoding exclusive layouts.

### 4.5 Entry patterns

```
[Title / Degree / Role]                    [Dates]
[Organization / Institution — Location]
[Description or bullets / thesis line]
```

Publications:

```
Authors (Year). Title. Venue. DOI/URL
```

Keep field mapping driven by existing section schemas (`fields_schema` / entry `data` keys)—design work is **presentation**, not new data models unless a field is already stored.

---

## 5. Template-by-template briefs

### 5.1 Classic — id=1 (START HERE)

| | |
|--|--|
| **Market** | Default free academic CV; US-friendly faculty/postdoc baseline |
| **References** | Penn samples, Dr. Karen, MIT handbook |
| **Personality** | Quiet authority; timeless; no brand color dependence |
| **Layout** | Centered header; left sections; rule under heads; `\cventryhead` two-column title/date |
| **Typography** | LM Roman 11 pt; name larger; black primary |
| **Margins** | 1 in |
| **Differentiator** | The “safe submit anywhere” look |
| **Avoid** | Sidebars, colored bands, two-tone skill blocks |
| **Current code** | Primary look of `LatexRenderer::buildDocument` |
| **Design goals (v2)** | Tighten vertical rhythm; refine name block; improve pub list hanging; ensure page header/footer name+page elegance; optional small-caps section labels (test vs bold) |

**Live verification:** redeploy rewrite stack → open `/api/version` → recompile a Classic CV on `rewrite.cvscholar.com`.

---

### 5.2 Modern — id=2

| | |
|--|--|
| **Market** | Scholars who want cleaner contemporary feel without leaving academia |
| **References** | LaTeX Awesome-CV (restrained), MIT samples with cleaner spacing |
| **Personality** | Crisp, open, slightly more geometric |
| **Layout** | Same single column; slightly tighter margins (0.75 in seed); stronger visual hierarchy on name |
| **Typography** | Sans for heads optional (LM Sans); body still highly readable—prefer **serif body + sans heads** only if tested in print |
| **Color** | One restrained accent (seed historically `#0077B5`) for rules/heads only |
| **Differentiator** | More “2020s academic lab” than “1990s Word” |
| **Avoid** | LinkedIn-style timeline graphics |
| **Design goals** | Accent rule weight; contact chips vs mid-dots A/B; section head tracking |

---

### 5.3 Detailed — id=3

| | |
|--|--|
| **Market** | Long dossiers, humanities/social science, many pubs |
| **References** | Full faculty CVs; PMC structure for dense content |
| **Personality** | Compact, information-dense, still orderly |
| **Layout** | Slightly reduced font (10–11 pt) and margins (~0.9 in seed) |
| **Typography** | Traditional serif; minimal ornament |
| **Color** | Deep academic red/maroon accent optional (`#660000` seed)—use sparingly |
| **Differentiator** | Best packing of long publication lists |
| **Avoid** | Expanding whitespace that pushes CV to needless pages |
| **Design goals** | Publication hanging indent; subheads inside Publications (Articles / Books); multi-line date handling |

---

### 5.4 Classic Faculty — id=4 (Pro)

| | |
|--|--|
| **Market** | Tenure-track / senior faculty applications |
| **References** | Penn senior samples; Dr. Karen full faculty order |
| **Personality** | Formal, complete, promotion-ready |
| **Layout** | Classic base + slightly stronger header (possible “Curriculum Vitae” subtitle) |
| **Typography** | Same family as Classic for brand continuity |
| **Section bias** | Appointments, grants, teaching, service clearly labeled |
| **Differentiator** | Faculty-shaped section emphasis and polish, not a different “skin” only |
| **Design goals** | Optional CV subtitle; appointment vs employment labels; grant amount/funder line design |

---

### 5.5 European Formal — id=5 (Pro)

| | |
|--|--|
| **Market** | Europe / international formal applications |
| **References** | Oxford Careers clarity norms; continental formal CVs |
| **Personality** | Dense, precise, institutional |
| **Layout** | Slightly tighter; still single column |
| **Typography** | Serif formal (Garamond-like feel via TeX Gyre / LM); careful hyphenation |
| **Differentiator** | European formality without US “wide open” spacing |
| **Avoid** | Forcing photo/DOB fields in global default (opt-in only if product later supports) |
| **Design goals** | Compact contact block; language of section titles (Education vs Academic qualifications) |

---

### 5.6 Research Dossier — id=6 (Pro)

| | |
|--|--|
| **Market** | Research-heavy roles, institutes, grant-adjacent full CVs |
| **References** | STEM Penn samples; research-first ordering |
| **Personality** | Evidence-forward: pubs, grants, projects early |
| **Layout** | Classic engine with research-weighted section order in DB |
| **Typography** | Highly readable serif; strong pub/grant entry types |
| **Differentiator** | Research artifacts dominate first pages |
| **Design goals** | “Selected publications” vs full list styling; grant PI/co-PI line; DOI presentation |

---

## 6. Explicit non-goals (all templates)

- Industry resume templates with photo left rail  
- ATS keyword stuffing aesthetics  
- Animated or web-only CSS layouts for PDF  
- Separate offline HTML renderer that diverges from LaTeX  
- Changing section **data models** as part of pure visual redesign (unless a real gap is found)  
- NIH/NSF SciENcv export as phase-1 of this redesign  

---

## 7. Classic v1 → v2 checklist (implementation gate)

Before shipping Classic changes:

- [ ] Change production renderer only (`apps/web/src/lib/latex.ts` for rewrite; `LatexRenderer.php` for PHP)
- [ ] Redeploy rewrite **web + pdf-worker**; confirm `/api/version` → `classic-layout-v6.1`
- [ ] Compile a real Classic CV on `rewrite.cvscholar.com` and download PDF
- [ ] Smoke: empty optional sections omitted; long URLs wrap; multi-page footers `Surname · n/N`
- [ ] Black & white print check

### Classic v2 target metrics (subjective but explicit)

| Metric | Target |
|--------|--------|
| Name block | Balanced, no orphan tagline commas |
| Section heads | Clear rule; consistent gap above/below |
| Entries | Title/date alignment stable for long titles |
| Publications | Dense but not cramped; years scannable |
| Pages | Demo scholar stays readable in 2–4 pages |

---

## 8. Production tooling

| Path | Purpose |
|------|---------|
| `apps/web/src/lib/latex.ts` | Rewrite Classic PDF builder (live on rewrite.cvscholar.com) |
| `apps/pdf-worker` | Queued Classic PDF compile |
| `/api/version` | Rewrite deploy probe (`layout_version`) |
| `app/services/LatexRenderer.php` | PHP stack Classic PDF (if PHP stack still deployed) |
| `/version.php` | PHP deploy probe |

---

## 9. Implementation order

1. **Classic** visual refinement + local sign-off  
2. **Classic Faculty** (share Classic DNA)  
3. **Research Dossier** (section order + research entry polish)  
4. **Modern** (accent + hierarchy)  
5. **European Formal** (density + formality)  
6. **Detailed** (packing + long-list typography)  

Do **not** implement Modern before Classic is signed off—shared macros in `LatexRenderer` will cascade.

---

## 10. Sign-off

| Role | Approves |
|------|----------|
| Product | Template set matches market positioning |
| Design | Classic baseline PDF meets §7 |
| Engineering | Local preview ≡ live `LatexRenderer` path |

When Classic is approved, open an implementation ticket that only edits production renderer/style_config and re-runs design scripts—no side renderer.

---

## 11. Edge cases & generation protocols

Long text, URLs, page breaks, empty sections, B&W print, and compile failures are catalogued with handling protocols in:

**`docs/design/CV_GENERATION_EDGE_CASES_AND_PROTOCOLS.md`**

Any layout PR that touches overflow or pagination should update that document when a new edge case is discovered.
