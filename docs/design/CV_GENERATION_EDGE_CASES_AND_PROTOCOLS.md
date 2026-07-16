# CV Generation — Edge Cases & Handling Protocols

**Status:** Living protocol for production PDF generation  
**Scope:** All CV templates (Classic first); applies to rewrite (`apps/web/src/lib/latex.ts`) and PHP (`LatexRenderer` + `CvDataNormalizer` + `LatexEscaper`)  
**Last updated:** 2026-07-16  
**Automation:** Edge-case handling is implemented in code and runs on **every** compile (not a separate service). This document is the contract; production renderers enforce it.  

---

## 1. Goals

When generating academic CVs we must remain:

1. **Readable** on screen and B&W print  
2. **Stable** under extreme user data (no overflow past margins, no compile crashes)  
3. **Faithful** to saved content (prefer wrap/soft-truncate display, never silently drop required fields without policy)  
4. **Predictable** — same input → same layout decisions on every production compile

---

## 2. Pipeline stages (where edge cases are handled)

```
User / import / demo data
        │
        ▼
┌───────────────────┐
│ 1. INGEST         │  trim, drop empty, year ranges (CvDataNormalizer)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 2. ESCAPE         │  LaTeX specials, unicode macros (LatexEscaper)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 3. LAYOUT BIND    │  field→title/sub/notes mapping (LatexRenderer)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 4. BREAK CONTROL  │  Needspace, samepage, section/entry keeps
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 5. LINE BREAKING  │  RaggedRight, sloppy, xurl, seqsplit, shortUrl
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 6. COMPILE        │  xelatex ×2, size cap, timeout, structured errors
└───────────────────┘
```

Protocols below name the **stage** and **severity**.

| Severity | Meaning |
|----------|---------|
| **P0** | Compile failure / unreadable PDF / security |
| **P1** | Visible overflow, orphan section heads, broken contact line |
| **P2** | Aesthetic awkwardness (uneven spacing, dense pages) |
| **P3** | Nice-to-have polish |

---

## 3. Edge-case catalogue

### 3.1 Pagination & section continuity

| ID | Edge case | Risk | Current mitigation | Protocol |
|----|-----------|------|--------------------|----------|
| **PG-01** | Section heading alone at bottom of page | Orphan heading | `\Needspace{8\baselineskip}` before section; `\nopagebreak` after rule | **Keep.** Never put heading without enough room for ≥1 entry line. |
| **PG-02** | Entry split mid-block (title on p.N, body on p.N+1) | Hard to scan | `\begin{samepage}` around entry; `\Needspace{5\baselineskip}` | **Prefer keep entry together.** If entry is *very* long (see TX-03), allow soft break *after* title+subtitle only if samepage would leave huge empty region — future: `minkeep` policy. |
| **PG-03** | Declaration / signature block split | Legal/looks broken | `Needspace{8}` + samepage | **Never split** signature block. |
| **PG-04** | Publication list item split mid-citation | Ugly | samepage per item | **Keep citation atomic.** |
| **PG-05** | Large empty region before section | Sparse look | `\raggedbottom` (not flush bottom) | Accept small voids; **do not** stretch inter-entry glue aggressively. |
| **PG-06** | Section spans many pages | Expected for rich CVs | Page numbers `n/N` | **Required** for multi-page; name optional in footer later. |
| **PG-07** | Single entry section near page end | Heading + one line | Needspace before section | Same as PG-01. |

**Protocol summary — pagination**

1. Section head always paired with minimum keep-with-next.  
2. Atomic units: one entry, one publication, declaration block.  
3. Prefer short empty bottom over splitting atomic units.  
4. Always show page numbers on multi-page academic CVs.

---

### 3.2 Extremely long field text

| ID | Edge case | Risk | Current mitigation | Protocol |
|----|-----------|------|--------------------|----------|
| **TX-01** | Very long entry title (degree, course, award) | Overruns date column | `tabularx` X column + `\raggedright` on title | **Wrap title** in left column; date column fixed ~24% width. Do not shrink date font below small. |
| **TX-02** | Very long org / affiliation line | Overflow | `\RaggedRight` + `\sloppy` + emergencystretch | **Wrap.** Italic subtitle may span multiple lines. |
| **TX-03** | Multi-paragraph description 500–5000+ chars | Huge samepage, empty pages | escapeParagraphs; samepage still wraps whole entry | **Cap soft:** if description &gt; N chars (recommend **1200**), allow page break *inside description only* (future). Until then, samepage may force early page break — acceptable P2. |
| **TX-04** | Profile/summary essay length | Same | samepage on summary | Soft cap **800–1000** chars in product UX later; renderer wraps. |
| **TX-05** | Super-long unbreakable token (no spaces) | Margin overflow | `\seqsplit` for tokens &gt; 28 chars (non-URL, non-email) | **Keep seqsplit.** Threshold 28 is intentional. |
| **TX-06** | Many consecutive long entries | Dense pages | parskip modest | Do not auto-reduce font mid-document. |
| **TX-07** | Empty / whitespace-only fields | Blank lines, dangling commas | CvDataNormalizer drops empty; header filters empty contact | **Never emit** empty tagline parts or empty contact bullets. |
| **TX-08** | Year fields malformed (`2019-`, `Present`, `n.d.`) | Ugly ranges | `formatYearRange` | Normalize: empty both → omit; open end → Present/Ongoing per section. |
| **TX-09** | Special LaTeX chars `& % $ # _ { } \ ~ ^` | Compile fail | LatexEscaper | **Always escape** user text; never pass raw into body. |
| **TX-10** | Unicode / Greek symbols | Missing glyphs | Limited unicode→math macros | Prefer fontspec unicode; macros for common greek. Log unknown if compile fails. |
| **TX-11** | HTML / markdown left in fields | Visible junk | Partial bold for `**authors**` in pubs | **Strip HTML** at normalizer (future P1). Markdown only where explicitly supported. |

**Protocol summary — long text**

1. **Wrap &gt; truncate** for titles, orgs, descriptions.  
2. **seqsplit** unbreakable tokens.  
3. **Escape everything** user-authored.  
4. Soft length caps are **product/UX** first; renderer is last line of defense.  
5. Never fail compile because a description is long.

---

### 3.3 Long URLs & identifiers

| ID | Edge case | Risk | Current mitigation | Protocol |
|----|-----------|------|--------------------|----------|
| **URL-01** | Long https URL in publications | Overfull hbox | shortUrl for display; full URL in `\href`; `xurl` + `\nolinkurl` | **Display shortened** (strip scheme/www/trailing /); link target full. |
| **URL-02** | URL with `_ # %` | Compile fail | LatexEscaper::escapeUrl | Always escape URL targets. |
| **URL-03** | Contact-line website very long | Header overflow | shortUrl + small font + allowbreak between bullets | Prefer short display; max ~**60** visible chars optional future. |
| **URL-04** | DOI only vs full URL | Redundancy | Prefer DOI when both present if product chooses; currently both can show | Protocol: **DOI preferred** when both set (future cleanup). |
| **URL-05** | Email as very long local-part | Break | href mailto; allowbreak between contact items | Keep email intact; wrap contact line. |
| **URL-06** | ORCID full URL vs id | Clutter | Display shortened ORCID id when possible | Show `ORCID: 0000-…` not full URL in contact. |
| **URL-07** | Missing scheme (`example.edu/x`) | Broken link | ensureUrl adds https:// | Always normalize before href. |

**Protocol summary — URLs**

1. Full fidelity in hyperlink target.  
2. Short, breakable display text.  
3. Never put raw unescaped URLs in TeX body.

---

### 3.4 Long / extreme names & header

| ID | Edge case | Risk | Current mitigation | Protocol |
|----|-----------|------|--------------------|----------|
| **NM-01** | Extremely long full name | Header overflow | Huge bfseries center; RaggedRight body not header | **Allow multi-line name** (center + wrap). Avoid shrinking below ~14pt. |
| **NM-02** | Name with titles already in field (`Prof. Dr. …`) | Redundant with job title | None | Product guidance: name without role; renderer does not strip. |
| **NM-03** | Empty name | Broken header | Escapes empty | **Fail validation** before compile if name empty (live editor); demo always has name. |
| **NM-04** | Tagline title + affiliation both long | Header bulk | Join with comma only if both non-empty | Keep one line wrap under name. |
| **NM-05** | Many contact items (email, phone, web, ORCID, LinkedIn, Scholar) | Crowded header | Filter empty; mid-dot separators; allowbreak | **Order fixed:** email → phone → web → ORCID → LinkedIn (Scholar policy). Soft max 5 items. |
| **NM-06** | Non-Latin scripts in name | Font coverage | fontspec LM Roman | Prefer fonts with broad Unicode later if market needs (P2). |

---

### 3.5 Section & structure edge cases

| ID | Edge case | Risk | Current mitigation | Protocol |
|----|-----------|------|--------------------|----------|
| **SC-01** | Empty section | Blank heading | Skip empty entries | **Omit section** unless scaffold mode. |
| **SC-02** | All sections empty | Nearly blank PDF | Header only | Allow; warn in UI. |
| **SC-03** | Hidden section (`is_visible=0`) | Leak content | Skip unless academic_profile exception | Respect visibility. |
| **SC-04** | Unknown section_key | Missing layout | Generic entry renderer | Map generically; never crash. |
| **SC-05** | Wrong field keys for section | “Missing” data (e.g. supervision) | Section-specific title maps | **Maintain field maps** per section (supervision→student_name, memberships→org). |
| **SC-06** | References mid-document order | Against classic guidance | orderSectionsForRendering pushes refs/declaration late | **Always** references then declaration near end. |
| **SC-07** | 50+ publications | Very long PDF | Enumerate; samepage each | OK for academic CV; optional “selected” mode later. |
| **SC-08** | Duplicate entries | Noise | None | Dedupe is product/import concern, not renderer. |

---

### 3.6 Dates & ranges

| ID | Edge case | Protocol |
|----|-----------|----------|
| **DT-01** | start only | `2019 –` → prefer `2019 – Present` when end empty and role ongoing semantics |
| **DT-02** | end only | Show end year only or `– 2020` avoided; show `2020` |
| **DT-03** | start &gt; end | Do not auto-swap; show as stored (import should validate) |
| **DT-04** | “Present” / “Ongoing” / “Current” | Preserve canonical casing via normalizer |
| **DT-05** | Supervision open-ended | fallbackEnd `Ongoing` |

---

### 3.7 Print / monochrome

| ID | Edge case | Protocol |
|----|-----------|----------|
| **PR-01** | Gray text vanishes on B&W | Use ≥ **black!85** for secondary text; hierarchy via weight/style not light gray |
| **PR-02** | Colored section heads | Classic primary = black; accents must remain readable in grayscale |
| **PR-03** | Blue hyperlinks | `hidelinks` — print as black |
| **PR-04** | Thin rules | Keep ≥ 0.5–0.6pt |

---

### 3.8 Compile / system

| ID | Edge case | Protocol |
|----|-----------|----------|
| **SY-01** | xelatex missing | Structured error; design mode may emit TeX only |
| **SY-02** | Compile timeout | Kill process; return log tail; keep failed `.tex` for debug |
| **SY-03** | PDF over size cap | Refuse ship; error (current 5MB) |
| **SY-04** | Two-pass refs (LastPage) | Always two passes when page numbers on |
| **SY-05** | Concurrent compiles | Unique temp dirs per job |

---

## 4. Decision protocols (playbooks)

### Protocol A — “Content overflow” (P1)

```
IF overfull hbox / margin bleed reported
  1. Confirm escape + seqsplit + xurl active
  2. Shorten display URL if URL field
  3. Ensure title uses X-column (cventryhead), not fixed parbox
  4. Do NOT reduce global font for one entry
  5. If single token still overflows: seqsplit or allow hyphenation
```

### Protocol B — “Section stranded on page break” (P1)

```
IF section heading is last line of page
  1. Increase Needspace before \cvsection (currently 8 baselines)
  2. Keep \nopagebreak after rule
  3. Never remove Needspace to “save space”
```

### Protocol C — “Entry looks empty but data exists” (P0/P1)

```
IF user reports missing fields
  1. Check section_key-specific field map (SC-05)
  2. Check normalizer dropped empty-looking values
  3. Fix map in LatexRenderer (not demo-only)
  4. Add regression coverage in production compile path / automated tests
```

### Protocol D — “Compile failure on user characters” (P0)

```
IF xelatex fails on input
  1. Save .tex + log (already on failure)
  2. Grep for unescaped specials
  3. Fix LatexEscaper or path that bypassed escape
  4. Never concatenate user strings into command names
```

### Protocol E — “B&W print complaint” (P1)

```
IF secondary text hard to read when printed
  1. Raise color to ≥ black!85 (or full black + italic)
  2. Re-export design PDF and print-smoke
  3. Avoid pure gray below black!80 for body-adjacent text
```

### Protocol F — “Rich CV too long” (P2 product)

```
IF CV exceeds practical length for a purpose
  1. Renderer does not auto-cut publications
  2. Product: selected pubs, hide sections, template choice
  3. Design: dense Detailed template, not silent truncation
```

---

## 5. Already implemented (quick reference)

| Mechanism | Location | Handles |
|-----------|----------|---------|
| Empty field drop | `CvDataNormalizer` | TX-07 |
| Year range format | `CvDataNormalizer::formatYearRange` | DT-* |
| LaTeX escape | `LatexEscaper` | TX-09, URL-02 |
| shortUrl + href | `LatexRenderer` | URL-01, URL-03 |
| seqsplit long tokens | `escapeInline` path | TX-05 |
| Needspace + samepage | section/entry render | PG-01–04 |
| RaggedRight + sloppy + emergencystretch | preamble | TX-01–02 |
| xurl / hyphens | preamble | URL-* |
| Contact filter + allowbreak | `renderContactLine` | NM-05 |
| Page numbers default on | `resolveShowPageNumbers` | PG-06 |
| Section field maps | supervision, memberships, references | SC-05 |
| Output size cap / timeout | `compileTexToPath` | SY-02–03 |
| B&W-darker secondary colors | black!88–95 | PR-01 |

---

## 6. Implemented automation (2026-07-16)

| Work | Edge IDs | Where |
|------|----------|--------|
| Soft-break long descriptions (keep title+sub atomic) | TX-03, PG-02 | `LatexRenderer::renderEntry` |
| HTML/entity strip + whitespace collapse | TX-07, TX-11 | `CvDataNormalizer` |
| Soft field length caps + ellipsis | TX-03–05 | `CvDataNormalizer::softCap` |
| Year token Present/Ongoing normalize | DT-* | `CvDataNormalizer::normalizeYearToken` |
| URL middle-ellipsis display (max ~52) | URL-01, URL-03 | `LatexRenderer::shortUrl` |
| DOI preferred over URL in publications | URL-04 | `renderPublicationsSection` |
| Name font scales with length | NM-01 | `resolveNameFontCommand` |
| Contact soft-max 5; long items may break | NM-05 | contact build + `renderContactLine` |
| Empty name fallback | NM-03 | header name → "Curriculum Vitae" |
| Footer `Surname · n/N` | PG-06 | fancyhdr footer |
| Long profile summary may page-break | TX-04 | academic_profile branch |

### Remaining optional product work

| Priority | Work | Edge IDs |
|----------|------|----------|
| P2 | Fixture suite for visual regression | regression |
| P3 | Selected publications mode | SC-07, Protocol F |

---

## 7. Design-preview test matrix (Classic)

Run offline preview after layout changes; manually inspect or add automated later:

| Fixture idea | What to verify |
|--------------|----------------|
| Baseline rich CV | All sections, refs, declaration |
| `long-name` | Name wraps, no overflow |
| `long-title` | Title wraps beside dates |
| `long-url-pub` | DOI/URL short display, clickable |
| `long-description` | No compile fail; readable paragraphs |
| `unbreakable-token` | seqsplit engages |
| `many-pubs` | Page numbers; no orphan headings |
| `empty-optional` | No empty section heads |
| `special-chars` | `& % $ _` compile clean |
| B&W print | Italics/dates still visible |

Live verification:

```text
https://rewrite.cvscholar.com/api/version   → layout_version classic-layout-v6
Then recompile Classic CV in the app and download the PDF.
```

---

## 8. Ownership rules

| Change type | Where |
|-------------|--------|
| Escaping / special chars | `LatexEscaper` (PHP) / latex helpers (rewrite) |
| Empty/year cleanup | `CvDataNormalizer` (PHP) / `cleanField` (rewrite `latex.ts`) |
| Field→layout mapping | `LatexRenderer` / `apps/web/src/lib/latex.ts` |
| Page/section break policy | renderer macros + Needspace |
| User-facing length limits | Editor / API validation (product) |
| Live design review | rewrite.cvscholar.com compile + download |

**Do not** keep a parallel offline design engine. Edge-case fixes go only through the live production renderers.

---

## 9. Sign-off checklist for layout PRs

- [ ] No new unescaped user string paths  
- [ ] Section-specific maps updated if new fields  
- [ ] Needspace/samepage not removed “to save space”  
- [ ] Recompile Classic on rewrite.cvscholar.com and verify PDF  
- [ ] Spot-check: long title, long URL, supervision, memberships, page numbers, A4  
- [ ] B&W mental check: no light-gray body text  
- [ ] Confirm deploy via `https://rewrite.cvscholar.com/api/version` (`deploy_ok`, `classic_layout_version`)

---

## 10. Related docs

- `docs/design/CV_TEMPLATE_DESIGN_BRIEF.md` — visual system & template briefs  
- `apps/web/src/lib/latex.ts` — rewrite Classic PDF implementation  
- `app/services/LatexRenderer.php` — PHP Classic PDF implementation  

