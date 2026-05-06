# CVScholar Retention Diagnosis and Activation Plan

Date: 2026-05-06
Data window: 2026-01-01 to 2026-05-06
Data source: Analytics API export (users, events, behavior, sessions, funnel)
Admin account excluded from behavior conclusions.

## Executive Summary
- Users are starting CV creation, but many do not reach first successful compile.
- The biggest conversion leak is from editor usage to compile completion.
- Technical reliability issues (editor JavaScript errors) directly hurt trust and completion.
- Return behavior is weak after day 1, so lifecycle nudges are required.

## Key Findings
- Total non-admin users analyzed: 43
- Users with at least 1 CV: 35 (81.4%)
- Users who viewed editor paths (/cv/edit/*): 18
- Users with pdf_compiled event: 4
- Editor to compile conversion: 22.2%
- Returned after day 1: 4 / 43 (9.3%)
- Never returned after day 1: 39 / 43

### Friction Signals
- js_error events: 32
- Main js_error message: Unexpected token '.' in editor.js
- rage_click events: 163
- form_abandon events: 308

### Non-Compiler Segment (High Risk)
- Users who touched editor but never compiled: 14
- In this segment:
- js_error events: 32
- rage_click events: 157
- form_abandon events: 157
- compile button clicks: 46

## Root Cause Hypotheses
1. Reliability regressions in editor break user trust and block core actions.
2. New users can create CV records, but completion guidance to first compile is weak.
3. Editor complexity causes cognitive overload for first-time users.
4. No rapid recovery flow exists when frustration signals are detected.
5. No strong return loop after signup and first draft activity.

## Phase-Wise Plan

## Phase 1: Stabilize Core Reliability (Week 1)
Goal: Remove technical blockers that prevent Add Entry and Compile.

Actions:
- Add automated production check for critical editor script integrity.
- Alert on js_error spikes for /cv/edit/* with path and message grouping.
- Keep versioned JS asset loading enabled to avoid stale CDN files.
- Add fast rollback runbook for editor JavaScript incidents.

Expected outcomes:
- 70%+ reduction in js_error on editor paths.
- 40%+ reduction in rage_click tied to compile and entry actions.

## Phase 2: First-Compile Guided UX (Week 2)
Goal: Improve edit-to-compile conversion for first-time users.

Actions:
- Show a persistent next-step panel after first entry save: Compile your first PDF.
- Keep Compile button sticky and visible while editing.
- Add a compile progress state and clear success confirmation.
- After success, show Download CTA and What to do next guidance.

Expected outcomes:
- Edit-to-compile conversion from 22.2% to at least 35%.
- 20%+ increase in pdf_downloaded after first compile.

## Phase 3: Friction Rescue and Recovery (Week 3)
Goal: Intervene during failure or confusion moments.

Actions:
- Trigger contextual help when user hits rage_click threshold.
- If compile fails twice, show one-click support prompt and troubleshooting hints.
- Add inline hints for most abandoned editor sections.

Expected outcomes:
- 30% reduction in form_abandon on top editor paths.
- 25% reduction in repeated failed compile attempts per session.

## Phase 4: Day-1 and Day-3 Lifecycle Re-Engagement (Week 4)
Goal: Increase return rate and first compile completion after initial session.

Actions:
- Day-1 email for users with cv_created but no pdf_compiled.
- Day-3 follow-up with direct deep link to resume editor.
- Dashboard banner: Finish and Compile your first CV.

Expected outcomes:
- Day-1+ return rate from 9.3% to at least 18%.
- Additional 10-15% of non-compilers converted within 7 days.

## KPI Dashboard (Track Weekly)
- Editor js_error rate per 100 editor page_views
- Rage click rate on /cv/edit/*
- Form abandon rate on /cv/edit/*
- Edit-to-compile conversion
- Compile-to-download conversion
- Day-1 return rate
- 7-day activation rate (registered to first pdf_compiled)

## Implementation Priority
1. Reliability fixes and monitoring (highest impact, immediate)
2. First compile guided journey
3. Friction rescue triggers
4. Lifecycle re-engagement automation

## Notes
- The recent editor syntax bug materially affected behavior signals.
- Re-measure this same dashboard for 14 days after Phase 1 to separate technical recovery from UX uplift.
