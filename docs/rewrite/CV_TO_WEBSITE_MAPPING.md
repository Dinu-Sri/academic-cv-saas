# CV → Academic Website Mapping

Single source of truth for how profile/CV data becomes a public Scholar Page.  
Aligned with design prototypes:

| Prototype | Path | Role |
|-----------|------|------|
| Maximum / rich | `Desktop/design-prototypes/academic-website` | Full multipage site |
| Minimum / sparse | `Desktop/design-prototypes/academic-website-minimum` | Floor: Home + Contact |

Real users always fall **between** these extremes. The engine never invents content or shows empty chrome.

---

## 1. Identity fields

| Profile field | Website use | Missing fallback |
|---------------|-------------|------------------|
| `displayName` | H1, nav brand, footer | **Required to publish** |
| `headline` | Role/title under name | **Required to publish** |
| `affiliation` | Kicker / institution | **Required to publish** |
| `bio` / `researchSummary` / home intro | Hero summary | **Required:** at least one non-empty |
| `location` | Details panel / contact | Hide row if empty |
| `email` | Details + contact + mailto | Hide if empty or visibility off |
| `orcidUrl` / `googleScholarUrl` / `linkedinUrl` | Profile links only | Hide each missing link; hide block if none |
| Photo | Portrait (when wired) | **No monogram placeholder** — name once on left; Details strip on right |
| CV document | Download CV action | Hide action if no linked CV / visibility off |

---

## 2. Section → category registry

| Category page | Section keys (CV blocks) |
|---------------|--------------------------|
| **Research** | `research_interests`, `research_experience`, `publications`, `projects`, `grants`, `patents` |
| **Academic Journey** | `academic_appointments`, `experience`, `education`, `teaching`, `supervision`, `certifications`, `skills`, `languages` |
| **Contributions** | `academic_service`, `editorial`, `invited_talks`, `conferences`, `memberships`, `awards` |

Implemented in `apps/web/src/lib/website/section-registry.ts`.  
Blank entries are stripped (`content-strength.cleanPublicEntries`).

---

## 3. Adaptive composition (pages & nav)

Engine: `composeAcademicWebsite` in `composition-engine.ts`.

### Qualification (category becomes its own page)

A category **qualifies** if any of:

1. Anchor module with **≥ 4** entries  
2. Anchor module with **≥ 2** entries **and** narrative ≥ 100 characters  
3. **≥ 2** modules and category score ≥ 3  

Scoring: narrative ≥ 100 → +2; module size; multi-module; featured boost (`content-strength.ts`).

### Merge rules

| Situation | Behaviour |
|-----------|-----------|
| Category does not qualify | Modules → **Home** (`homeModules`); no nav item |
| Contributions thin + Journey qualifies | Contributions modules **merge into Journey** |
| User disables a page | Modules may still show on Home if content exists; no nav item |
| Contact form enabled | `contact` in nav |

### Modes

| Mode | Content pages | Typical nav |
|------|---------------|-------------|
| `sparse` | 0 | Home + Contact |
| `developing` | 1–2 | Home + qualified + Contact |
| `rich` | 3 | Home + Research + Journey + Contributions + Contact |

**Hard rule:** never put a key in navigation without a rendered page that has content.

---

## 4. Home composition

| Block | Source | Fallback |
|-------|--------|----------|
| Hero | Name, role, affiliation, summary | Summary from bio / research / home intro |
| Details (no photo) | Location, email, identity links | Omit empty rows; never repeat name |
| Metrics | Counts with **entries > 0 only** | Derived: publications, projects, teaching, supervision, education, appointments — never fake citations |
| Highlights | Most recent by year: project → publication → award → appointment → education → teaching | Max 3; skip empty slots |
| Merged body | `composition.homeModules` as full section modules | Sparse/thin profiles only |
| Category directory | Qualified `composition.pages` only | Hidden when sparse |

Highlights helper: `apps/web/src/lib/website/home-highlights.ts`.

---

## 5. Publish readiness (minimum to go live)

`assessWebsiteReadiness` in `readiness.ts`.

### Required (block publish if missing)

1. Full name  
2. Academic title / role (`headline`)  
3. Institution (`affiliation`)  
4. Short bio **or** research summary (or website home intro when present in checks)  
5. **At least one public CV body section** (any non-empty website section entry: education, teaching, experience, appointments, publications, projects, etc.)

### Recommended (score only)

- Education, publications, experience  

### Optional

- Teaching, ORCID / Scholar links  

`canPublish` is true only when all **required** items are complete.

---

## 6. Spectrum examples

| Profile | Composition | Home shows |
|---------|-------------|------------|
| Lecturer: education + teaching only | `sparse` | Details panel, derived metrics, highlights (role/edu/teaching), full modules on Home |
| Pubs heavy, little journey | `developing` | Research page + Home highlights |
| Full faculty CV | `rich` | All three category pages |
| Identity only, zero sections | **Cannot publish** | Workspace readiness blocks |

---

## 7. Implementation map

| Concern | Code |
|---------|------|
| Section map | `section-registry.ts` |
| Qualify / merge / nav | `composition-engine.ts`, `content-strength.ts` |
| Model build | `data-builder.ts` |
| Highlights / metrics | `home-highlights.ts` |
| Publish gate | `readiness.ts` → `publish-service.ts`, `snapshot-builder.ts` |
| Public UI | `modern-scholar-preview.tsx` |
| Tests | `tests/website-composition.test.ts`, `tests/website-readiness.test.ts` |

When prototypes change, update this doc in the **same commit** as engine/UI changes.
