# CVScholar Academic Website Design and Development Plan

Status: Implemented in the Next.js rewrite on 2026-07-17
Target: Next.js rewrite in `apps/web` only
Legacy PHP: Out of scope

## 1. Product Direction

The website should feel like a living academic profile, not a CV copied into web pages and not a generic SaaS template. It should communicate authority, curiosity, and clarity while remaining useful for early-career, teaching-focused, research-focused, and senior academic users.

The central architecture rule is:

> Navigation represents broad academic stories. Individual CV sections are content modules inside those stories.

This prevents empty or weak pages when a user has not completed every profile section.

## 2. Public Information Architecture

### Primary navigation

1. Home
2. Research
3. Academic Journey
4. Contributions

### Utility actions

- Contact is a compact header action and a full route when the contact form is enabled.
- Download CV is a persistent button, not a primary content page.
- External identities such as ORCID, Google Scholar, LinkedIn, and institutional profiles appear as verified profile links.

Only Home is mandatory. The other three primary pages are generated after content-strength evaluation. A page that cannot provide a useful reading experience is omitted and its useful modules are merged into another page or Home.

Stable public routes:

- `/`
- `/research`
- `/journey`
- `/contributions`
- `/contact`

Labels may be editable later, but route names should remain stable for SEO and shared links.

## 3. Section-to-Page Mapping

### Research

Purpose: Explain what the academic investigates, creates, and publishes.

Primary modules:

- Research interests
- Research experience
- Publications
- Projects
- Grants
- Patents

Supporting modules:

- Selected conference outputs when they represent research dissemination
- Research-related awards
- Relevant technical skills

Recommended page sequence:

1. Short research position or narrative
2. Research themes
3. Featured work
4. Current projects and grants
5. Publication archive
6. Patents or other outputs

The publication archive is a rich module with filtering, year grouping, type labels, DOI/external links, and accessible citation formatting. It should not be rendered as a wall of identical cards.

### Academic Journey

Purpose: Show how the academic developed, teaches, mentors, and works.

Primary modules:

- Academic appointments
- Professional experience
- Education
- Teaching
- Supervision

Supporting modules:

- Certifications
- Skills
- Languages
- Teaching-related awards

Recommended page sequence:

1. Current role and short career summary
2. Career timeline
3. Teaching and learning approach
4. Courses or teaching experience
5. Supervision and mentorship
6. Education and professional development

This grouping makes teaching valuable without requiring a dedicated Teaching page. A user with one teaching entry can still present it naturally within a substantial career page.

### Contributions

Purpose: Show academic citizenship, visibility, leadership, and recognition beyond core research and teaching.

Primary modules:

- Academic service
- Editorial work
- Invited talks
- Conferences
- Professional memberships
- Awards and recognition

Supporting modules:

- Leadership items from professional experience
- Community or institutional projects

Recommended page sequence:

1. Contribution statement or selected impact
2. Academic and professional service
3. Editorial and reviewing work
4. Invited talks and conferences
5. Memberships
6. Awards and recognition

### Content excluded from public composition

- References are private by default and are never auto-published.
- Declaration is CV-specific and is not a website module.
- Phone, personal email, and precise location remain hidden unless explicitly enabled.
- Empty sections, zero metrics, and placeholder copy are never rendered publicly.

## 4. Adaptive Composition Rules

### Content strength

The composition engine evaluates modules before generating navigation.

Suggested scoring:

- Meaningful page narrative of at least 100 characters: 2 points
- One valid structured entry: 1 point
- Three or more valid entries in a module: 2 points
- At least one user-featured item: 1 point
- A second distinct populated module: 1 point

A category receives its own page when either condition is true:

- It scores at least 3 points and contains at least two distinct modules.
- It contains one substantial anchor module with at least four entries, such as a publication archive, plus enough metadata to create a complete page experience.

The values must be centralized configuration, not scattered component conditions, so they can be tuned from real usage data.

### Merge rules

- Weak Research content becomes a `Selected work` or `Research interests` block on Home.
- Weak Academic Journey content becomes a `Background` block on Home.
- Weak Contributions content merges into Academic Journey under `Contributions and recognition`.
- If Academic Journey is also weak, useful Contribution items become a concise Home block.
- Contact appears as a standalone route only when the form or sufficient public contact methods are enabled. Otherwise, profile links and CV access remain in the footer/header.
- A user may hide a generated page. Its modules are re-evaluated for placement elsewhere instead of disappearing silently.

### Profile modes

Sparse profile:

- Home
- Contact utility when enabled
- All useful content is composed into a polished single-page experience.

Developing profile:

- Home
- One or two qualifying category pages
- Contact utility and Download CV

Rich profile:

- Home
- Research
- Academic Journey
- Contributions
- Contact utility and Download CV

The public site must never show disabled navigation, empty page shells, empty section headings, `0 publications`, or setup guidance intended for the owner.

## 5. Home Page Composition

Home is a curated overview, not a duplicate of every page.

### Required shell

- Identity: name, academic title, affiliation, optional portrait
- One concise positioning statement
- Primary actions: Explore work and Download CV
- Public scholarly identity links

### Adaptive body modules

Select three to five modules based on available content and user curation:

- Research themes
- Featured publications or projects
- Current appointment and career snapshot
- Teaching and supervision snapshot
- Selected contribution or award
- Credible activity summary using only non-zero metrics
- Contact invitation

Selection priority:

1. User-featured content
2. Current and recent entries
3. Entries with complete metadata and links
4. Diverse modules rather than repeated content from one section

Home cards link into the exact destination section, not only the top of a page.

## 6. Visual Design System

Working direction: `Quiet Authority`.

The design combines an editorial journal, a university monograph, and a contemporary research portfolio. It should feel distinctive through typography, spacing, composition, and data presentation rather than decorative noise.

### Typography

- Display and editorial headings: Newsreader
- Interface, navigation, labels, and metadata: IBM Plex Sans
- Publication identifiers or compact data: IBM Plex Mono, used sparingly

Large headings use tight line lengths and confident scale. Body text remains comfortable for long academic reading. Avoid all-caps except for very short metadata labels.

### Color

- Paper: `#F4F0E8`
- Surface: `#FBF9F4`
- Ink: `#172126`
- Mineral blue: `#315E6B`
- Oxidized copper accent: `#A65E3B`
- Muted sage: `#8A9A86`
- Rule/border: `#D8D2C6`

Color accents identify content types and interaction states. They do not become large decorative gradients. A high-quality dark theme may follow later, but the initial identity is warm editorial light.

### Layout language

- Asymmetric hero with a narrow identity rail and a larger editorial statement
- Generous whitespace with strong vertical rhythm
- Thin rules, margin labels, citation numbers, and timeline markers as recurring visual motifs
- Variable content layouts: featured editorial blocks, compact citation rows, timelines, and grouped archives
- Maximum reading width around 70 characters for narrative text
- Wide page grid with intentional offsets on desktop and a simple single column on mobile

### Imagery

- One optional, well-cropped profile portrait
- Optional project or publication imagery only when supplied by the user
- Initials or typographic monogram fallback when no portrait exists
- No generic university buildings, stock laboratories, or decorative AI imagery

### Motion

- One restrained page-entry sequence for hero and key modules
- Gentle reveal for timelines and archive groups
- No continuous animation, parallax, or motion that interferes with reading
- Full support for `prefers-reduced-motion`

## 7. Component System

Core public components:

- `AcademicSiteShell`
- `IdentityHero`
- `AdaptiveNavigation`
- `ResearchThemeGrid`
- `FeaturedWorkEditorial`
- `PublicationArchive`
- `CareerTimeline`
- `TeachingAndMentorship`
- `ContributionLedger`
- `RecognitionStrip`
- `AcademicIdentityLinks`
- `ContactPanel`
- `CvDownloadAction`
- `EmptyPortraitMonogram`

Every module receives normalized content and a display variant. Components must not directly decide whether a page exists.

## 8. Composition Architecture

Introduce a pure domain layer under `apps/web/src/lib/website`:

- `section-registry.ts`: maps profile section keys to categories, roles, labels, and renderers.
- `content-strength.ts`: validates and scores narratives and entries.
- `composition-engine.ts`: assembles pages, applies merge rules, and generates navigation.
- `composition-types.ts`: defines category, module, page, anchor, and reason metadata.

Expected flow:

```text
Profile and section entries
        |
        v
Normalize and validate
        |
        v
Score modules and categories
        |
        v
Apply page qualification and merge rules
        |
        v
Apply user visibility, order, and featured overrides
        |
        v
Build preview or immutable publish snapshot
        |
        v
Render public pages and navigation
```

The engine should return reason metadata such as `qualified`, `merged_into_home`, `merged_into_journey`, `hidden_by_user`, and `empty`. This supports owner-facing explanations and reliable tests.

Published websites must continue to render from a publish snapshot. Profile edits may update the draft preview, but should not silently alter the live website before republishing.

## 9. Website Builder UX

The builder should mirror the public information architecture.

### Main builder areas

1. Overview
2. Pages and content
3. Style
4. Privacy and contact
5. Preview and publish

### Page editor behavior

- Show generated page cards with a content-strength label: Strong, Developing, or Merged.
- Explain where merged content will appear.
- Allow reordering modules within a qualifying page.
- Allow featuring entries without duplicating profile data.
- Allow a short page narrative for each broad category.
- Allow hiding a module or page with an immediate preview of the result.
- Prevent users from publishing a manually enabled empty page.
- Offer useful profile completion prompts inside the builder, never on the public site.

The default experience should require very few decisions: choose identity details, review generated pages, select featured work, choose style, and publish.

## 10. Edge Cases

### Content and structure

- A user has only education and one project: compose a strong Home; do not generate three weak pages.
- A user has 100 publications but no narrative: Research qualifies through the archive anchor and receives an automatically generated neutral introduction heading, not invented prose.
- A teaching-focused user has courses, supervision, and certifications but no publications: Academic Journey qualifies and becomes the prominent first category after Home.
- A senior researcher has no teaching data: Research and Contributions qualify; Academic Journey may show appointments and education or remain merged.
- The same entry could fit two categories: assign one canonical home and allow only a linked feature reference elsewhere.
- Archived, invalid, or nearly blank entries do not contribute to scores.
- Entries with unknown dates appear in an `Earlier or undated` group and do not break sorting.
- Very long titles, names, affiliations, and URLs wrap without changing layout width.
- Non-Latin names and multilingual content must render correctly; do not assume ASCII content in user data.

### Privacy and safety

- Never infer permission to expose email, phone, references, or precise location.
- Sanitize narratives and external URLs.
- Add contact-form rate limiting, spam protection, and safe confirmation states.
- External links indicate that they open outside the site and use safe target attributes.

### UX, accessibility, and devices

- Navigation adapts when there are one, two, or three generated category pages.
- Keyboard focus, skip links, landmarks, heading order, and form errors meet WCAG 2.2 AA.
- Color is never the only indicator of publication type or status.
- Small screens prioritize identity, current work, publications, contact, and CV access.
- Print styles produce a clean profile summary without menus, animations, or contact controls.
- Reduced motion and increased text size must not hide or overlap content.

### SEO and sharing

- Generate page-specific titles, descriptions, canonical URLs, Open Graph data, and structured person/scholarly output data.
- Exclude weak/hidden routes from navigation and sitemap.
- Return a real 404 for unqualified routes instead of a visually empty page.
- Preserve stable anchors for modules and entries.
- Add rewrite-era redirects from superseded public routes after the new route set is finalized.

## 11. Development Phases

### Phase 1: Domain and tests

- Add composition types, section registry, scoring, and merge rules.
- Create fixtures for sparse, developing, research-heavy, teaching-heavy, and senior profiles.
- Unit-test every qualification and merge path.
- Replace narrow page-level content checks with the composition result.

Acceptance: No fixture produces an empty public page or dead navigation item.

### Phase 2: Preview model and routing

- Expand the website preview model to include all supported rewrite profile sections.
- Generate routes and navigation from composed pages.
- Add stable anchors and exact cross-page links.
- Preserve immutable published snapshots.

Acceptance: Preview and published rendering use the same composition contract.

### Phase 3: Public visual system

- Build design tokens and the `Quiet Authority` component library.
- Implement responsive Home and the three category layouts.
- Build publication archive, timeline, contribution ledger, and identity link patterns.
- Add accessibility, reduced-motion, and print behavior from the start.

Acceptance: All profile fixtures look deliberate at mobile, tablet, laptop, and wide desktop sizes.

### Phase 4: Builder redesign

- Replace individual-page toggles with generated category cards and merge explanations.
- Add featured-item curation, module ordering, narratives, privacy, and style controls.
- Add side-by-side or full-window responsive preview modes.
- Keep auto-save states explicit and recoverable.

Acceptance: A new user can reach a credible preview without understanding CVScholar's section schema.

### Phase 5: Publishing and discovery

- Finalize metadata, sitemap, robots behavior, structured data, analytics events, and redirects.
- Harden contact handling and privacy controls.
- Add publish-readiness checks based on public composition rather than raw section counts.

Acceptance: Publish blocks only genuine public-site problems and explains each fix clearly.

### Phase 6: Quality and rollout

- Add visual regression coverage for all fixtures and breakpoints.
- Test keyboard, screen reader landmarks, contrast, long content, no portrait, broken external links, and contact abuse cases.
- Release behind the existing website feature flags.
- Compare page engagement, CV downloads, contact conversions, and builder abandonment before broad rollout.

Acceptance: No regression in authentication, profile editing, publish snapshots, contact inbox, analytics, or CV download permissions.

## 12. Verification Matrix

Minimum automated coverage:

- Composition engine unit tests
- Route qualification and 404 tests
- Snapshot consistency tests
- Privacy-field tests
- Builder API validation tests
- Public-page component tests
- Accessibility checks
- Mobile and desktop visual regression tests
- SEO metadata and sitemap tests
- Contact security and rate-limit tests

Minimum manual review profiles:

- Sparse postgraduate profile
- Early-career researcher
- Teaching-focused lecturer
- Publication-heavy researcher
- Senior professor with service and editorial work
- Profile without portrait or public email
- Profile with long multilingual content

## 13. Production Impact Checklist

Expected for this redesign:

- Environment variables: none for core composition; review only if contact protection changes.
- Database migration: likely needed only for new curation or appearance fields that cannot remain in existing website configuration JSON.
- Dependencies: avoid adding a UI framework; font delivery and any archive/search dependency require review.
- Container rebuild and Portainer redeploy: required for production code changes.
- Cache clear: review after public template and route changes.
- Queue, cron, and worker changes: not expected.

No database change should be created until the composition model and builder controls are finalized.
