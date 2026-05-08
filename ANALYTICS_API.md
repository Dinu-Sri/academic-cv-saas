 CVScholar Analytics API Guide

This guide explains how to access analytics exports, download data to your local machine, and use the data to improve buyer personas, UX journeys, retention, and revenue.

## 1) What this API is for

Use this API to export behavioral and business datasets so you can:
- Build accurate buyer personas from real user behavior
- Find drop-off points and churn signals
- Identify what users try before paying
- Improve onboarding and CV builder UX
- Decide what offer to show at each stage
- Build data-backed retention campaigns

## 2) Access and Authentication

The API uses one admin-generated key.

1. Go to Admin -> Settings -> Analytics API Access
2. Click Generate New API Key
3. Copy the key immediately (shown once)
4. Send the key in request header:

```bash
X-Api-Key: YOUR_KEY
```

You can also use:

```bash
Authorization: Bearer YOUR_KEY
```

## 3) Rate Limit

Rate limiting is configurable in Admin -> Settings:
- Setting: API Rate Limit (requests per hour)
- Default: 240 requests/hour
- If you get 429 errors, increase this value in settings

429 response includes usage details and retry hint.

## 4) Base URL and Endpoint

Base URL:

```text
https://your-domain.com/api/analytics
```

Endpoint format:

```text
GET /api/analytics/{dataset}
```

Datasets:
- users
- events
- behavior
- sessions
- subscriptions
- funnel
- full

Formats:
- json (default)
- csv
- zip

Common query params:
- from=YYYY-MM-DD
- to=YYYY-MM-DD
- user_id=123
- page=1
- limit=1000 (max 5000)

Extra filters:
- event_key=... (for events)
- event_type=... (for behavior)

## 5) Download examples

### JSON export

```bash
curl -H "X-Api-Key: YOUR_KEY" \
  "https://your-domain.com/api/analytics/behavior?from=2026-01-01&to=2026-01-31&limit=2000" \
  -o behavior_jan.json
```

### CSV export

```bash
curl -H "X-Api-Key: YOUR_KEY" \
  "https://your-domain.com/api/analytics/events?format=csv&from=2026-01-01&to=2026-01-31" \
  -o user_events_jan.csv
```

### ZIP export (single dataset)

```bash
curl -H "X-Api-Key: YOUR_KEY" \
  "https://your-domain.com/api/analytics/behavior?format=zip&from=2026-01-01&to=2026-01-31" \
  -o behavior_bundle.zip
```

### ZIP export (full package)

```bash
curl -H "X-Api-Key: YOUR_KEY" \
  "https://your-domain.com/api/analytics/full?format=zip&from=2026-01-01&to=2026-01-31" \
  -o full_analytics_bundle.zip
```

## 6) What to download (recommended cadence)

Daily:
- behavior (event-level behavior)
- sessions (session-level summaries)

Weekly:
- events (business/system event timeline)
- funnel (conversion stages)

Monthly:
- users (cohorts, activity, plan mix)
- subscriptions (revenue, payment outcomes)
- full zip snapshot for long-term analysis

## 7) Event tracking scope

Current behavior tracking includes:
- page_view
- page_leave
- click
- scroll_depth
- rage_click
- js_error
- unhandled_rejection
- focus
- field_focus
- field_fill
- field_blur
- form_start
- form_submit
- form_abandon
- pricing_view
- pricing_click_plan

Field-level tracking is privacy-safe:
- tracks field name/type and fill length
- tracks derived buckets (`value_length_bucket`) and non-empty flag
- does NOT store raw typed values
- sensitive values remain masked

Draft progress tracking (pre-compile) includes:
- `cv_draft_progress` on section save
- `cv_draft_progress_milestone` at 25/50/75/100% section completion
- section completion is computed from schema field coverage, not raw content

Lifecycle reliability tracking includes:
- `validation_error_shown` and `validation_error_fixed` around compile-time required-field checks
- `autosave_failed` and `autosave_succeeded` for save recovery visibility
- `draft_stalled_24h` from hourly cron when a draft has save activity but no compile for 24h+

Product interaction tracking includes modal, popup, and non-navigation events that are not visible from pageviews alone:
- Template browsing and selection: `template_gallery_viewed`, `template_detail_viewed`, `template_card_clicked`, `template_locked_badge_shown`, `template_preview_opened`, `template_preview_loaded`, `template_preview_closed`, `template_preview_failed`, `template_selected`
- Paywall and plan refresh: `paywall_shown`, `paywall_shown_post_payment`, `upgrade_cta_clicked`, `plan_refresh_attempted`, `plan_refresh_succeeded`, `plan_refresh_failed`
- Payment popup and success: `payment_popup_started`, `payment_popup_completed`, `payment_popup_dismissed`, `payment_popup_failed`, `payment_hash_failed`, `payment_success_page_viewed`, `post_payment_cta_clicked`, `post_payment_plan_confirmed`, `post_payment_plan_timeout`
- Import review flow: `publication_toggled`, `publications_select_all_clicked`, `import_apply_clicked`, `import_apply_succeeded`, `import_apply_failed`, `import_apply_duplicate_clicked`
- Support modal flow: `support_form_started`, `support_form_field_completed`, `support_ticket_submit_clicked`, `support_ticket_succeeded`, `support_ticket_failed`, `support_confirmation_viewed`
- CV creation funnel: `cv_creation_flow_started`, `cv_creation_step_completed`, `cv_creation_completed`, `cv_creation_abandoned`

These events use derived metadata only: IDs, plan slugs, counts, booleans, length fields, timing, and controlled error labels. They must not include raw CV names, support message text, publication titles/authors, personal profile text, ORCID URLs, Scholar IDs, or institution names.

## 8) Business questions and expected analyses

### Buyer Persona
Use users + behavior + events:
- Segment by plan, CV count, and activity recency
- Compare high-conversion vs low-conversion behavior patterns
- Find feature usage differences by segment

### Exit / Churn diagnosis
Use behavior + sessions + funnel:
- High form_abandon pages
- Frequent rage_click/js_error clusters
- Step where funnel conversion drops sharply

### Retention opportunities
Use events + behavior:
- Users viewing pricing repeatedly without checkout
- Users creating CV but never downloading
- Users with deep field_fill activity but no compile/download

### Offer timing strategy
Use funnel + behavior:
- Show discount/support prompt after repeated pricing_click_plan without payment
- Trigger proactive help after rage_click + form_abandon on checkout/editor pages

### UX journey improvements
Use behavior + sessions:
- Identify confusing fields by repeated field_focus + low form_submit
- Identify dead-end pages by high page_leave and low next-step actions
- Prioritize fixes for top rage_click selectors

## 9) Expectations for data quality and operations

Operational expectations:
- Keep behavior tracking enabled for stable trend analysis
- Use sampling carefully (100% preferred for early-stage diagnosis)
- Keep retention window aligned with your analysis horizon
- Review 429 errors and tune API rate limit accordingly

Data expectations:
- Behavior data is directional and actionable, not perfect click replay
- Field-level telemetry should guide UX decisions, not collect PII
- Combine behavioral signals with business outcomes for persona confidence

## 10) Security notes

- Treat API key as secret
- Rotate key periodically from admin settings
- Store exports securely (contains user emails and behavioral metadata)
- Share only aggregated reports externally

## 11) Recorded Learnings (Production Snapshot)

Snapshot date: 2026-04-24
Source: https://cvscholar.com via Analytics API

### Data volume observed
- users: 25
- events: 26
- behavior: 185
- sessions: 5
- subscriptions: 0

### Current user mix and usage
- plan split: free=15, pro=10
- users with at least 1 CV: 21 (84%)
- users with 0 CVs: 4 (16%)
- recent 30-day signups: 19

### Funnel state at snapshot
- registered: 25
- first_cv_created: 21 (84% from registered)
- pricing_viewed: 0
- checkout_started: 0
- payment_completed: 0

Interpretation:
- Top-of-funnel and CV creation are healthy for this sample.
- Monetization tracking is currently incomplete/too early in this dataset.

### Behavior signal quality
- dominant behavior types: page_leave, click, page_view, scroll_depth
- frustration events (rage_click/js_error/unhandled_rejection/form_abandon): currently near zero
- observed path activity is admin-heavy at snapshot time, so this sample is operationally biased.

Interpretation:
- Use this snapshot mainly as baseline; avoid overfitting product decisions to this admin-skewed window.
- Wait for broader end-user traffic window before strong persona conclusions.

### Data integrity learnings
- subscriptions dataset returned empty while users include pro plans.
- this indicates subscriptions table data and user plan state are not fully synchronized for all users.

Action recommendation:
- treat `users.subscription_plan` as source of truth for current plan state.
- backfill `subscriptions` records or add a reconciliation job to improve revenue lifecycle reporting.

### Operational learnings for future analysis
- always download and archive `full` ZIP weekly for historical baselines.
- when `behavior` is small (<1000 events), aggregate over longer date ranges before persona modeling.
- track these KPI thresholds before advanced persona segmentation:
  - >= 1000 behavior events
  - >= 100 checkout_started events
  - >= 30 payment_completed events

### Local archive path used in this run
- storage/temp/live_analytics/full_export.zip

