# Academic Website Design Brief — Scholar Pages

**Status:** Research complete · Design system defined · Implementation not started  
**Template name:** **Scholar Pages**  
**Template key (target):** `scholar-pages`  
**Legacy key (current production):** `modern-scholar` (will evolve into Scholar Pages)  
**Stack:** Rewrite only — `apps/web` (Next.js). Preview and public render share the same components.  
**Last updated:** 2026-07-16  

---

## 0. Process (same arc as Classic CV)

```
Research (this doc §1–3)
    → Design system + named template (§4–7)
    → Permanent knowledge base (Prisma knowledge)
    → Local rewrite preview (next dev)
    → Ship rewrite.cvscholar.com (web + website-worker if publish path changes)
```

**Do not** design on PHP/XAMPP for academic websites. Live public sites are rewrite multipage snapshots on `{username}.cvscholar.com`.

---

## 1. Research synthesis — what “best” means for academic sites

### 1.1 Purpose (audience jobs)

| Visitor | Primary job | Site must deliver |
|---------|-------------|-------------------|
| Hiring / tenure / search committee | Assess fit quickly | Clear identity, research focus, key pubs, CV path |
| Collaborator / PI peer | Judge research area | Research narrative, projects, recent pubs with links |
| Prospective student | Decide whether to reach out | Research themes, supervision/teaching signal, contact |
| Journalist / public | Understand work in plain language | Home summary, accessible about, contact |
| Self (scholar) | Maintain portable identity | Easy multipage structure, not a CV dump |

Evidence themes from academic practice guides (Rice Graduate Studies, Academic Designer, lab/faculty blog conventions, UC Press author toolkit, Academia.SE consensus):

1. A personal academic site is a **portable professional identity**, not a marketing landing page.  
2. Minimum viable content: **identity + bio + research + publications + CV + contact**.  
3. The homepage should **orient**, not dump the entire CV. Depth lives on dedicated pages.  
4. Photos of the scholar (professional headshot) help recognition; decorative stock imagery does not.  
5. Link out to ORCID, Google Scholar, institutional profile — do not invent metrics.

### 1.2 Multipage vs single-page (decision)

| Factor | Multipage (chosen) | Single long scroll |
|--------|--------------------|--------------------|
| SEO / deep linking | Strong — each topic has a URL | Weak — one URL |
| Academic content volume | Scales (pubs, teaching, CV) | Becomes endless scroll |
| Committee / student mental model | Matches faculty IA conventions | Feels like a brochure |
| Mobile | Needs careful nav (not automatic win) | Scroll is natural but hard to re-find sections |
| Shareability | Share `/publications` or `/research` | Only share whole site |

**Decision:** **Multipage is the product default**, matching user preference and academic IA norms.

Caveats (from multipage mobile UX research):

- Multipage is **worse on mobile if nav is cluttered** — must use a clear header + compact mobile menu.  
- Homepage must still answer “who / what / where / how to go deeper” above the fold.  
- Empty pages must not appear in nav (already true in rewrite `pageHasContent` logic).

Current rewrite already supports multipage keys:  
`home | about | research | publications | teaching | cv | contact`  
Public paths: `/`, `/about`, `/research`, … on the scholar subdomain.

### 1.3 Evidence-based UX constraints (web research)

These findings are durable enough for product rules and the agent knowledge base.

| ID | Finding | Design implication | Sources (type) |
|----|---------|--------------------|----------------|
| **R-01** | Body text line length ~45–75 characters (≤80 for accessibility) improves reading | Cap content column ~36–42rem; avoid full-bleed paragraphs on desktop | Baymard / typographic UX consensus; WCAG guidance on long lines |
| **R-02** | Base body size ≥16px on web; support zoom | `font-size: 1rem` body; no fixed px trapping | Digital accessibility practice (Harvard DAS et al.) |
| **R-03** | Line-height ~1.5× for body text aids tracking | `line-height: 1.55–1.65` body | Inclusive design / readability guidance |
| **R-04** | Users scan; hierarchy must be obvious | Clear H1 once per page; H2 sections; restrained color | NN/g content scanning literature (general) |
| **R-05** | Mobile: prioritize content over chrome | Compact sticky header; hamburger or labeled Menu for ≥5 items | NN/g mobile navigation patterns |
| **R-06** | With few top-level items (≤5–7), visible nav beats buried-only | Desktop: horizontal nav; tablet: may wrap or collapse | NN/g nav item count guidance |
| **R-07** | Hamburger is less discoverable; use labeled control when possible | Mobile menu button text “Menu” + icon | NN/g + third-party hamburger studies (summary) |
| **R-08** | Touch targets need adequate size | Min ~44×44px interactive targets | Platform a11y guidelines (iOS/Android/WCAG targets) |
| **R-09** | Multipage SEO benefits topic pages | Unique title + meta per page (already in `seo.ts`) | Multipage vs one-page industry consensus |
| **R-10** | Credibility cues matter for professional sites | Real name, affiliation, ORCID, institutional email policies, updated content | Academic website practice + general trust UX |
| **R-11** | Contact forms need spam protection without dark patterns | Keep Turnstile/rate limits; clear success/error | Product security + form UX |
| **R-12** | Privacy-safe analytics only | Page-path counters; no visitor identity (already product rule) | Product policy |

### 1.4 What to avoid (anti-patterns)

- Startup dark themes with neon gradients on faculty sites  
- Skill bars, “ninja” badges, confetti animations  
- Auto-playing video hero  
- Nav items for empty sections  
- Duplicating the entire CV on Home  
- Tiny gray body text or low-contrast links  
- Footer-only contact with no dedicated Contact page when form is enabled  
- Horizontal scroll traps on mobile tables (publications)

---

## 2. Information architecture — Scholar Pages

### 2.1 Default page set (multipage)

| Page key | Nav label | Purpose | Primary content |
|----------|-----------|---------|-----------------|
| `home` | Home | Orient visitor in &lt;30s | Name, role, affiliation, 2–4 sentence summary, photo optional, featured highlights, CTAs to Research / Publications / Contact |
| `about` | About | Human narrative | Bio, education, optional photo, selected awards/memberships |
| `research` | Research | Agenda + projects | Research narrative, projects/grants, interests |
| `publications` | Publications | Scholarly output | Reverse-chron list; DOI/URL; venue/year; optional type filter later |
| `teaching` | Teaching | Pedagogy signal | Narrative + courses |
| `cv` | CV | Full structured record | Experience, education, service slices from profile; link to PDF CV when available (future) |
| `contact` | Contact | Reach out | Intro + form and/or email per field visibility |

**Nav order (default):** Home · About · Research · Publications · Teaching · CV · Contact  

**Optional later pages (not v1):** News/Updates, Lab/Team, Software/Code, Media, Blog — only if product expands.

### 2.2 Header (global)

**Desktop / tablet landscape**

```
[Name (brand)]     Home  About  Research  Publications  Teaching  CV  Contact
[optional short headline under name on small brand block]
```

Rules:

- Sticky header optional but preferred on scroll (compact height ≤64px desktop).  
- Active page marked with underline or weight change (not color-only).  
- Name links to Home.  
- Max ~7 primary items; if fewer pages enabled, show only enabled.  
- No dropdowns in v1.

**Tablet portrait / mobile**

```
[Name]                    [Menu]
```

- Opens accessible panel or full-screen sheet with the same links.  
- Focus trap + Esc to close + return focus to Menu button.  
- Current page indicated.  
- Touch targets ≥44px.

### 2.3 Footer (global)

Every page ends with a clear footer:

```
────────────────────────────────────────
Name · Affiliation
ORCID · Scholar · LinkedIn (if visible)
© year Name · Hosted on CVScholar (subtle)
Privacy-safe: no third-party ad trackers
────────────────────────────────────────
```

Rules:

- Footer is secondary; do not hide critical contact only in footer if Contact page exists.  
- Institutional disclaimer optional later.  
- Keep “Powered by CVScholar” subtle (product, not spam).

### 2.4 Home page structure (above the fold → below)

1. **Identity band:** name (H1), headline, affiliation, location (if allowed)  
2. **Summary:** home intro or research summary (short)  
3. **Primary links:** ORCID / Scholar / Email (per visibility)  
4. **Highlights strip:** counts or 3 featured items (pubs/projects) — restrained  
5. **Jump cards:** Research · Publications · Teaching · Contact (only if those pages exist)  
6. **Optional:** one featured publication teaser  

### 2.5 Interior page structure

```
Header
Page title (H1) — matches nav label
Optional lede paragraph (page narrative)
Main content (entries / lists)
Footer
```

Publications: scannable list, year visible, title strong, authors/venue secondary.  
Long lists: no infinite scroll required in v1; paginate later if &gt;50.

---

## 3. Responsive breakpoints

| Name | Width | Layout behavior |
|------|-------|-----------------|
| **Mobile** | &lt;640px | Single column; Menu drawer; hero stacked; cards full width |
| **Tablet** | 640–1023px | Single or soft two-column hero; nav may stay horizontal if ≤5 items else Menu |
| **Desktop** | ≥1024px | Content max-width ~42rem centered OR content + optional aside later; full horizontal nav |
| **Wide** | ≥1280px | Same content measure; more margin — do **not** stretch text to full width (R-01) |

**Content measure:** `max-width: 42rem` for prose; lists may use `48rem`.  
**Page shell:** `max-width: 72rem` for header/footer alignment.

Touch: all nav links and buttons meet min height 44px on mobile.

---

## 4. Design system — Scholar Pages

### 4.1 Personality

| Attribute | Value |
|-----------|--------|
| Tone | Calm, credible, academic — “faculty personal site,” not SaaS marketing |
| Density | Airy but not sparse; scannable lists for publications |
| Color | One accent only; black/near-black text; white/off-white ground |
| Motion | None required; if used, ≤150ms fades only |
| Imagery | Optional headshot; no stock hero collage |

### 4.2 Color tokens

| Token | Role | Suggested value |
|-------|------|-----------------|
| `--sp-ink` | Body text | `#12141a` |
| `--sp-ink-muted` | Secondary | `#3d4450` |
| `--sp-line` | Rules / borders | `#d8dce3` |
| `--sp-surface` | Page bg | `#f7f6f3` (warm paper) or `#fafafa` |
| `--sp-card` | Cards | `#ffffff` |
| `--sp-accent` | Links / active | `#1e3a5f` (academic navy) |
| `--sp-accent-hover` | Link hover | `#152a45` |
| `--sp-focus` | Focus ring | `#2563eb` |

Contrast: body text on surface ≥ WCAG AA. Never use light gray body text.

**Accent variants (user-selectable later):** `academic-navy` (default), `forest`, `burgundy` — all dark enough for text links.

### 4.3 Typography

| Role | Spec |
|------|------|
| UI / body | System stack with academic-friendly fallback: `"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` for prose **or** clean sans for UI chrome |
| Chrome (nav, labels) | `"Source Sans 3", "Segoe UI", system-ui, sans-serif` |
| Body size | 1.0625rem (17px) mobile; 1.125rem (18px) desktop optional |
| H1 | 1.75–2.25rem, weight 650–700 |
| H2 | 1.25–1.4rem, weight 650 |
| Small / meta | 0.875rem, muted ink |
| Line length | Prose ≤ ~70ch |
| Line height body | 1.6 |

**Serif for long academic prose + sans for nav** is a classic faculty-site pairing. If we must ship one family first, prefer **one high-quality sans** for reliability (self-hosted or system) and add serif in v1.1.

### 4.4 Spacing scale

`4, 8, 12, 16, 24, 32, 48, 64` px  
Section vertical rhythm: 48–64px between major blocks.  
Card padding: 16–24px.

### 4.5 Components (v1 inventory)

| Component | Notes |
|-----------|--------|
| `SpShell` | Header + main + footer |
| `SpHeader` | Brand + nav / menu |
| `SpFooter` | Identity + links + product mark |
| `SpHero` | Home identity band |
| `SpPageTitle` | Interior H1 + lede |
| `SpProse` | Narrative HTML/text block |
| `SpEntryList` | Publications / teaching / projects |
| `SpEntryItem` | Title, meta line, optional link |
| `SpStatRow` | Optional counts |
| `SpJumpCards` | Home navigation cards |
| `SpLinkRow` | ORCID / Scholar / email |
| `SpContactPanel` | Form slot + fallback email |
| `SpEmptyState` | Soft message when section empty (should rarely show if nav filters) |

### 4.6 Accessibility checklist

- [ ] One H1 per page  
- [ ] Skip link to main content  
- [ ] Focus visible on all interactive elements  
- [ ] Menu: aria-expanded, aria-controls  
- [ ] Color not sole active-state indicator  
- [ ] Form labels associated; errors announced  
- [ ] Images: meaningful alt on headshot; empty alt if decorative  
- [ ] `prefers-reduced-motion` respected  

---

## 5. Mapping to current rewrite architecture

| Concern | Current | Scholar Pages target |
|---------|---------|----------------------|
| Template key | `modern-scholar` | `scholar-pages` (migrate/alias) |
| Pages | Already multipage keys | Keep; refine home content model |
| Preview | `ModernScholarPreview` | Evolve → `ScholarPagesSite` (shared public/preview) |
| Styles | `.modern-scholar-site` in `globals.css` | Namespaced `.scholar-pages` tokens |
| Public host | `{user}.cvscholar.com` | Unchanged |
| Snapshot publish | website-worker | Same pipeline; new markup in snapshot render |
| SEO | Per-page titles | Keep; improve description templates |
| Contact | Form + Turnstile | Keep in Contact page + optional footer email |
| Analytics | Path counters | Keep |

**Implementation rule:** Preview mode and public mode must use the **same** visual components so “what you edit is what you publish.”

---

## 6. Content rules (product + agent)

1. Never invent publications, grants, titles, or affiliations.  
2. Hide disabled/empty pages from nav.  
3. Honor field visibility (email, location, LinkedIn, ORCID).  
4. Prefer DOI links over bare URLs when both exist.  
5. Home summary max ~600–800 characters recommended (soft).  
6. Contact form copy stays professional; no growth-hacking CTAs.  
7. When agent proposes website changes, use proposal flow — never auto-publish.

---

## 7. Implementation phases (after this brief is approved)

### Phase A — Design system CSS + shell (no IA change)

- Tokenize colors/type/spacing  
- Implement sticky header + footer on all pages  
- Mobile Menu drawer  
- Apply to existing page set  

### Phase B — Home & interior layouts

- Home hero + jump cards  
- Publications list density polish  
- About / Research prose measure  

### Phase C — Template key & knowledge

- Register `scholar-pages` (alias `modern-scholar`)  
- Agent knowledge already seeded from research  
- Update readiness copy if needed  

### Phase D — Optional enhancements

- Featured publication IDs on Home  
- CV PDF download button when compile exists  
- Accent theme picker  
- Print stylesheet for single pages  

**Local loop:** `pnpm --filter @cvscholar/web dev` — not XAMPP.  
**Ship:** rebuild rewrite-web (+ website-worker only if snapshot HTML generation moves server-side).

---

## 8. Sign-off checklist (layout PR gate)

- [ ] Multipage nav works desktop + tablet + mobile  
- [ ] Header and footer on every page  
- [ ] Content measure respects R-01 (no full-bleed prose)  
- [ ] Active page visible without color alone  
- [ ] Empty pages omitted from nav  
- [ ] Preview matches public snapshot render  
- [ ] Contact + Turnstile still work  
- [ ] Keyboard Menu usable  
- [ ] Lighthouse a11y no critical regressions on sample site  
- [ ] Knowledge chunks still accurate after UI rename  

---

## 9. Naming

| Field | Value |
|-------|--------|
| **Marketing / UI name** | Scholar Pages |
| **templateKey** | `scholar-pages` |
| **CSS namespace** | `.scholar-pages` / `--sp-*` |
| **Component prefix** | `Sp` / `ScholarPages*` |
| **Legacy** | `modern-scholar` remains accepted alias until data migrated |

Tagline (internal): *A clear multipage academic website — identity, research, publications, CV, contact.*

---

## 10. Related docs

- `docs/design/CV_TEMPLATE_DESIGN_BRIEF.md` — Classic CV visual system  
- `docs/design/CV_GENERATION_EDGE_CASES_AND_PROTOCOLS.md` — PDF only  
- `apps/web/AGENTS.md` — website product rules  
- Prisma knowledge: `academic_website_guidance`, `cvscholar_product` (website chunks)  

---

## 11. Source bibliography (research basis)

Non-exhaustive; used for principles, not as legal endorsement.

1. Rice University Graduate Studies — *How to Make Your Own Academic Website* (common page set).  
2. The Academic Designer — personal academic website page portfolio guidance.  
3. UC Press — author personal website toolkit (About / Research / Contact).  
4. Academia Stack Exchange & faculty blogs — minimum content and photo norms.  
5. Nielsen Norman Group — mobile navigation patterns; content vs chrome; menu discoverability.  
6. Baymard / typographic UX consensus — optimal line length for reading.  
7. Harvard Digital Accessibility Services & inclusive design toolkits — resize, spacing, contrast.  
8. WCAG 2.x — contrast, target size, structure (normative accessibility).  
9. Industry multipage vs one-page comparisons — SEO and deep-link advantages for content-rich sites.  

Where research conflicts (e.g. marketing sites favoring single-page conversion), **academic multipage IA wins** for CVScholar Scholar Pages.
