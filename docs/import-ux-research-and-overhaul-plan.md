# CV Import UX Research and Overhaul Plan

## 1) Why this document exists

The import experience is now technically functional, but it is still cognitively heavy for many academic users with low IT confidence.

This document maps:

- Current behavior in the system (as-is)
- Target user journeys (to-be)
- Decision rules for merging multi-source data (CV PDF, ORCID, Google Scholar)
- Explicit approval checkpoints before data is committed
- AI-based mapping and normalization strategy for low-quality raw text
- Validation, safety, and rollout plan before next deployment


## 2) Scope

In scope:

- Import screen UX, copy, and interaction model
- Data extraction and draft review UX
- Publication approval UX
- Profile and CV section merge/overwrite policy
- AI mapping pipeline from raw text to schema-safe draft
- Event tracking and conversion metrics

Out of scope:

- Final visual design polish beyond flow clarity
- Full backend rewrite in one release


## 3) Current system map (as-is)

### 3.1 Entry points and API routes

- Import page route: `/profile/import`
- CV PDF import: `POST /profile/import/cv-pdf`
- CV draft apply: `POST /profile/import/cv-draft/apply`
- ORCID import: `POST /profile/import/orcid`
- Scholar import: `POST /profile/import/scholar`
- Profile apply: `POST /profile/import/apply`
- Publications approve/reject: `POST /profile/import/approve`, `POST /profile/import/reject`

### 3.2 Current data behavior by source

CV PDF:

- Upload PDF -> render pages with `pdftoppm` -> send page images to OpenAI full-page mapping
- Validate mapped data against the canonical template-section registry
- User sees selectable draft entries
- Nothing is applied until user clicks "Add Draft to My CV"

ORCID:

- Imports profile + works + education + employment
- Publications are saved as pending review
- Education and employment are currently added directly to CV
- User profile can be applied via "Apply to My Profile"

Google Scholar:

- Imports profile + publications
- Publications are saved as pending review
- Profile can be applied via "Apply to My Profile"

### 3.3 Current UX gaps

1. Three import cards are visible at once, but users are not told a recommended order.
2. ORCID flow auto-writes some CV sections immediately, while PDF flow requires explicit approval. This is inconsistent.
3. No unified "review all changes" queue across sources.
4. Multi-source collision handling is implicit (dedupe only), not understandable to user.
5. Returning users with partially edited CV are not offered a clear merge strategy.
6. Field confidence and provenance are hidden (user cannot see where each value came from).


## 4) Research assumptions and user segments

Primary users:

- First-time academic user (low technical confidence)
- Returning user with partially completed CV
- Publication-heavy user with ORCID + Scholar overlap

Assumptions to validate:

- Users prefer guided sequence over free-form tool selection.
- Users trust import more when they can preview "what will change" before apply.
- Users need plain-language terms: "review", "keep", "replace", "skip".


## 5) Target UX principles

1. One clear next action at every step.
2. Never write to CV silently without explicit user approval.
3. Show source and confidence for each imported value.
4. Keep users safe by default: "review first, then apply".
5. Minimize clicks with smart defaults, but make changes reversible.


## 6) Proposed end-to-end journey model

## 6.1 Journey A: First-time user, PDF only

Steps:

1. User sees "Start here" card with short explanation and expected outcome.
2. Upload PDF and extract draft.
3. System shows sectioned draft with quality badges (High/Medium/Low confidence).
4. User approves all or deselects individual items.
5. User clicks "Apply reviewed draft".
6. System shows success summary and "Open CV Editor".

Required UX components:

- "What happens next" helper text before upload
- Per-entry source label (OpenAI full-PDF import / ORCID / Scholar)
- Post-apply summary: entries added, skipped, failed validation


## 6.2 Journey B: First-time user, ORCID only

Steps:

1. User enters ORCID ID.
2. System imports profile + publications + affiliations into a pending change queue.
3. User reviews grouped changes:
   - Profile fields
   - Education/experience entries
   - Publications
4. User approves selected changes.
5. System applies approved changes only.

Important change from current behavior:

- Education/employment should not auto-apply immediately. They should enter pending review first.


## 6.3 Journey C: First-time user, Google Scholar only

Steps mirror ORCID flow, but scope is profile/publications only.

Required behavior:

- Publication dedupe and collision resolution shown before apply
- Clear note: Scholar may not contain full profile details


## 6.4 Journey D: Multi-source user in same session (PDF + ORCID + Scholar)

Steps:

1. User imports any source.
2. User can add additional sources before applying.
3. System builds one unified pending queue.
4. Duplicates are clustered as one candidate with alternate source options.
5. User approves final merged record.

Merge rule baseline:

- Publication identity key priority: DOI > title+year+first-author > normalized title fuzzy match.
- Profile fields: show side-by-side values if conflicts exist.
- User chooses preferred value, with "recommended" preselected.


## 6.5 Journey E: Returning user with partially edited CV

Entry decision step (mandatory):

Before applying imported data, show:

- Keep existing values (only fill missing)
- Merge and update missing/older items (recommended)
- Replace selected sections
- Full reset and re-import (advanced)

Default policy:

- "Fill missing + add new entries" with no destructive overwrite.


## 7) Approval and consent model

Apply changes only through explicit approvals:

1. Draft-level approval: import to pending queue
2. Section-level approval: approve profile/education/experience/publications separately
3. Item-level approval: checkbox per entry for edge cases
4. Final confirmation: "Apply N approved changes"

UX wording examples:

- "Nothing will be changed until you click Apply"
- "You can review and undo from import history"


## 8) Data conflict and merge policy

## 8.1 Canonical source priority (default)

- ORCID for affiliation/employment timeline
- Scholar for citation metrics and publication counts
- PDF for narrative sections (summary, project descriptions, teaching details)

## 8.2 Field-level conflict strategy

- If existing CV value is non-empty and user selected "fill missing": keep existing
- If imported value is newer (year-based) and confidence high: suggest replace
- If confidence low: flag for user review, never auto-overwrite

## 8.3 Provenance tracking per field

Store metadata with each candidate value:

- `source` (pdf/orcid/google_scholar)
- `source_record_id` (if available)
- `confidence` (0-1)
- `normalization_notes` (optional)


## 9) AI mapping and normalization architecture

## 9.1 Problem

Full-page PDF extraction can return ambiguous section boundaries or mixed layout order. Direct mapping to section fields is unreliable unless the model receives the canonical section schema and examples.

## 9.2 Proposed AI pipeline

Stage 1: Full-page visual extraction

- Render PDF pages to images
- Send page images to OpenAI with layout and section-preservation rules

Stage 2: Schema-guided structuring

- Send the canonical registry with strict schema for all supported section fields
- Include section definitions and short examples in prompt
- Require provenance and confidence on each item

Stage 3: Deterministic post-validation

- Enforce allowed fields per section
- Type checks (year/date/url/email)
- Length and required-field checks
- Drop invalid items with reasons

Stage 4: Merge-ready draft

- Return candidates grouped by section with confidence
- Return review hints for low-confidence entries

## 9.3 Prompt contract (high-level)

Must include:

- System schema (allowed sections/fields)
- Rules: never invent facts, preserve chronology, keep separate entries separate
- Tone/format guidance for each section
- Output must be strict JSON, no markdown

Should include:

- 1 to 2 positive examples per complex section
- Invalid example and correction rule (for model steering)


## 10) Intelligent assist features (optional but high impact)

Feature: "Fill missing details with AI"

- Appears only when a section has sparse data
- Uses already-approved profile/publication context
- Generates draft suggestions, never auto-applies

Feature: "Improve wording"

- Converts rough extracted text to concise academic style
- Preserves facts only, no new claims
- Requires one-click accept/reject per suggestion


## 11) Validation and safety pipeline

Pre-apply validation checks:

1. Schema conformance (field allowlist)
2. Duplicate detection in target CV section
3. Mandatory field checks by section
4. Suspicious mapping detector (empty required facts, mixed sections, implausible dates)

Apply transaction rules:

- Apply approved entries only
- Keep append-only import log for audit/revert
- Return user-friendly summary: added, merged, skipped, failed


## 12) UX content and information architecture updates

## 12.1 Top-of-page guidance block

Add a compact "How this works" panel:

1. Import from one or more sources
2. Review suggested changes
3. Apply approved changes to your CV

## 12.2 Source cards rewrite

Each source card should answer three questions in one glance:

- What data this source brings
- How accurate it usually is
- What user must do after import

## 12.3 Unified "Pending Changes" workspace

Replace scattered result blocks with one review area containing tabs:

- Profile
- CV Sections
- Publications
- Conflicts


## 13) Analytics and success metrics

Core funnel:

1. Import page viewed
2. Source import started
3. Source import completed
4. Pending changes reviewed
5. Changes applied
6. CV compile started

Quality metrics:

- Apply rate per import source
- Manual edit rate within 30 minutes of apply
- Revert/remove rate after apply
- Time-to-first-successful-CV-compile
- Import abandonment rate


## 14) Implementation plan (phased)

Phase 1: UX consistency and safety

- Stop auto-apply for ORCID education/employment
- Introduce pending queue for all sources
- Add clear guidance block and source card microcopy

Phase 2: Unified review model

- Build single pending changes workspace
- Add section and item-level approvals
- Add explicit merge strategy selector for returning users

Phase 3: AI mapping upgrade

- Add schema-rich prompt templates and examples
- Return confidence + provenance
- Add deterministic validator with reject reasons

Phase 4: Intelligent assist and optimization

- Add "fill missing with AI" and wording assist
- Instrument quality metrics and optimize funnel


## 15) Acceptance criteria before next deploy

Minimum must-have:

1. No import source writes CV data without explicit user approval.
2. Returning users can choose merge strategy before apply.
3. Conflict UI exists for multi-source collisions.
4. System shows a final "what changed" summary after apply.
5. Import UX copy is understandable for non-technical academics.


## 16) Open research questions

1. Should we default to one recommended source order (ORCID -> Scholar -> PDF), or let users choose freely?
2. What confidence threshold should trigger mandatory review?
3. Do users prefer one global Apply button or per-section Apply buttons?
4. How much automation is acceptable before trust drops?


## 17) Immediate next actions

1. Validate this journey model with 5 to 8 real users (rapid interviews + clickable prototype).
2. Convert approved flows into UI wireframes and API contracts.
3. Implement Phase 1 only, then measure drop-off and apply-rate uplift before moving to Phase 2.


## 18) Implementation status (this iteration)

Implemented now:

1. Approval-first behavior for ORCID and Scholar profile/section data:
   - ORCID education/employment no longer auto-write into CV.
   - ORCID/Scholar now return review draft payloads for explicit user apply.
2. Merge strategy control added to draft apply UX:
   - Safe merge default: keep existing values, fill missing, add new.
   - Replace mode: replace selected sections with reviewed imported entries.
3. Import page guidance updated for non-technical users:
   - Added concise "How this works" block and explicit no-auto-change messaging.
4. Section summary headings clarified to avoid false assumptions:
   - "Found (Pending Your Review)" instead of "Added to CV".

Pending for next iteration:

1. Unified pending changes workspace (single review queue across all sources).
2. Field-level conflict resolution UI with source comparison.
3. Confidence/provenance badges per candidate value.
4. Import history with undo/revert.
