# Meta Ads Tracking — CVScholar

Production reference for Meta Pixel + Conversions API (CAPI). Use this when configuring Events Manager, Ads Manager campaigns, and Portainer env vars.

**Privacy rule (non-negotiable):** never send CV field values, PDF content, bios, publication titles, AI chat text, or support message bodies to Meta. Paths, product action labels, plan keys, and hashed contact identifiers only.

---

## Stack

| Layer | Role |
|-------|------|
| **Browser Pixel** | PageView, ViewContent, client conversion mirror |
| **Conversions API** | Server truth for signup, checkout, purchase |
| **Dedup** | Shared `event_id` on browser + CAPI for the same conversion |
| **First-party journey** | Product analytics only — **do not** mirror every click to Meta |

---

## Environment variables

Set in Portainer on the rewrite web service (`docker-compose.rewrite.yml`). Never commit secrets.

| Variable | Required | Notes |
|----------|----------|-------|
| `META_TRACKING_ENABLED` | Yes for live ads | `1` on production when ready; `0` disables all Meta traffic |
| `NEXT_PUBLIC_META_PIXEL_ID` | Yes | Pixel / Dataset ID (public, browser) |
| `META_CAPI_PIXEL_ID` | Recommended | Same as pixel if single dataset; falls back to public id |
| `META_CAPI_ACCESS_TOKEN` | Yes for CAPI | Events Manager → Settings → Generate access token |
| `META_CAPI_TEST_EVENT_CODE` | Staging only | Events Manager “Test events” code |
| `META_ADVANCED_MATCHING_ENABLED` | Optional | `1` (default when tracking on) sends hashed email + external_id when marketing cookie allows |

Catalog prices (already used for billing UI) feed Purchase `value`:

- `CVSCHOLAR_BILLING_PDF_PASS_USD` (default `5`)
- `CVSCHOLAR_BILLING_SCHOLAR_ANNUAL_USD` (default `36`)

**Currency for Meta:** always **`USD`** (catalog), even if PayHere uses another display currency.

---

## Funnel (optimize for these)

```text
PageView
  → ViewContent (pricing / home / blog)
  → CompleteRegistration          ← growth campaigns
  → StartTrial (post free signup) ← engagement / free activation
  → InitiateCheckout
  → Purchase (+ Subscribe if Scholar Annual)  ← sales campaigns
```

### Primary optimization map

| Campaign goal | Optimize for | Soft / money value |
|---------------|--------------|--------------------|
| Awareness / traffic | Landing ViewContent, LP views | 0 |
| Free user growth | **CompleteRegistration** | `value: 2` USD |
| Free activation | **StartTrial** | `value: 3` USD |
| Sales | **Purchase** | PDF Pass / Scholar Annual catalog USD |
| Annual retention signal | **Subscribe** (with Purchase on annual) | same annual USD |

---

## Event catalog

### Standard events

| Event | When | Key properties | Browser | CAPI |
|-------|------|----------------|---------|------|
| `PageView` | App pages (not scholar public sites) | — | Yes | No |
| `ViewContent` | `/`, `/pricing`, `/billing`, blog posts | `content_name`, `content_category`; pricing also `content_ids` | Yes | No |
| `CompleteRegistration` | New account (email or Google) | `status: true`, `content_name: "AccountCreated"`, `value: 2`, `currency: "USD"` | Yes | Yes |
| `StartTrial` | Once after free signup | `content_name: "FreePlan"`, `value: 3`, `currency: "USD"` | Yes | Yes |
| `InitiateCheckout` | Checkout started for a paid plan | `content_ids`, `content_type: "product"`, `content_name`, `value`, `currency: "USD"`, `num_items: 1` | Yes | Yes |
| `Purchase` | Payment granted (`applyCompletedPayment`, not retry) | **`value` + `currency` required**; `content_ids`, `content_type`, `content_name`, `num_items: 1` | Prefer | **Authority** |
| `Subscribe` | Same as Purchase when plan is `scholar_annual` | `value`, `currency`, optional `predicted_ltv` | Prefer | Yes |
| `Contact` | Support ticket created (optional) | `content_name: "SupportTicket"` | Optional | Optional |

### Custom events (audiences / secondary)

| Event | When | Notes |
|-------|------|--------|
| `CvGenerated` | First successful CV compile (logged-in) | Once per user preferred |
| `WebsitePublished` | Website publish completed | Once per publish OK |
| `CvShareCreated` | CV share link created | Light engagement |
| `InviteRedeemed` | Invite free plan grant | `value: 0` — **never** use as Purchase |

### `event_id` conventions (dedup)

| Event | `event_id` |
|-------|------------|
| CompleteRegistration | `reg_{userId}` |
| StartTrial | `trial_{userId}` |
| InitiateCheckout | billing `orderId` |
| Purchase | billing `orderId` |
| Subscribe | `{orderId}_subscribe` |
| InviteRedeemed | `invite_{invitationId}` or token hash |

Webhook retries: if payment already completed, **do not** re-send Purchase.

---

## Advanced Matching (EMQ)

When `META_ADVANCED_MATCHING_ENABLED` is on and the user’s **marketing cookie consent** is true:

| Field | Rule |
|-------|------|
| `em` | SHA-256 of normalized email |
| `external_id` | SHA-256 of user id |
| `fbp` / `fbc` | From cookies; **never hash** |
| IP + user agent | CAPI only |

---

## Surfaces

| Host | Meta Pixel |
|------|------------|
| Main product (`cvscholar.com` / rewrite app URL) | On when enabled |
| Scholar sites (`username.cvscholar.com`, custom domains) | **Always off** |

---

## Campaign recipes

| Objective | Optimize | Audience seeds | Exclude |
|-----------|----------|----------------|---------|
| Awareness | Reach / ThruPlay / ViewContent | Broad + LAL engagers | Recent purchasers |
| Traffic | Landing page views | Interest + LAL | Active paid |
| Engagement | CompleteRegistration, StartTrial | 7–30d visitors | — |
| Sales | **Purchase** | InitiateCheckout abandoners; registered non-buyers; LAL purchasers | Active paid / purchasers |
| Retarget | Pricing ViewContent without Purchase | 7–14d | Purchasers |

---

## Ops checklist (go-live)

1. Create Meta Business Manager + Events Manager Dataset (Pixel).
2. Generate CAPI access token; copy Pixel ID.
3. Set env vars in Portainer; redeploy rewrite web.
4. Open Events Manager → Test events (use `META_CAPI_TEST_EVENT_CODE` on staging).
5. Verify: PageView, ViewContent, CompleteRegistration, InitiateCheckout, Purchase.
6. Confirm Purchase fires **once** per order after simulate/webhook.
7. Turn off test event code on production.
8. In Ads Manager, set primary conversion = Purchase for sales; CompleteRegistration for growth.
9. Build custom audiences from events; exclude purchasers from cold acquisition.

---

## Code map

| Area | Path |
|------|------|
| Config / CAPI / browser helpers | `apps/web/src/lib/meta/*` |
| Base Pixel component | `apps/web/src/components/meta-pixel.tsx` |
| Layout (main app only) | `apps/web/src/app/layout.tsx` |
| Signup hook (server) | `apps/web/src/lib/auth.ts` databaseHooks |
| Signup mirror (browser) | `apps/web/src/components/app-shell.tsx` |
| Checkout / purchase | `apps/web/src/lib/billing/service.ts` |
| Client checkout mirror | `apps/web/src/components/billing-workspace.tsx` |
| Invite grant | `apps/web/src/app/api/invite/[token]/route.ts` |

---

## What not to track

- Profile field keystrokes / CV content  
- Admin cockpit actions  
- Scholar public-site visitor browsing  
- Free invite / admin grants as `Purchase` revenue  

---

## Related

- Product journey analytics: `apps/web/src/lib/journey.ts` (first-party only)  
- Agent instructions: `AGENTS.md`  
- Meta docs: [Standard events](https://developers.facebook.com/docs/meta-pixel/reference), [CAPI](https://developers.facebook.com/docs/marketing-api/conversions-api), [Dedup](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
