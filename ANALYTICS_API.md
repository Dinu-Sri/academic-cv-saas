# CVScholar Analytics API Guide

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
- does NOT store raw typed values
- sensitive values remain masked

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
