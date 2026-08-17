# Mobile UX — Start on phone, finish on laptop

Rewrite product path for **phone users**: a short, low-chrome flow under `/m` that uploads or starts a CV draft, then hands off to desktop for full editing.

## Goals

- One primary job on phone: get a draft academic CV started  
- No dense AppShell (sidebar, multi-workspace desks) on the mobile path  
- Reuse guest trial, CV import, and compile APIs  
- Desktop remains the power surface (profile, publications, website, billing polish)

## Locked product decisions

| Topic | Choice |
|-------|--------|
| Auth | Guest-first; login when emailing laptop link |
| Gate | Hard redirect power routes on phone unless escape cookie |
| Scope | Upload + short manual form + ready/handoff |
| Tablet | Treated as desktop (no forced `/m`) |
| Escape | “Use full site” sets `cvscholar_mobile_mode=full` |

## User flow

```text
Phone hits /profile|/cv|/website|…
        → redirect /m
/m Start → Upload PDF  OR  Manual form
        → import/apply (upload) or personal save (manual)
        → compile Classic
/m/ready → Continue on laptop | Email | WhatsApp | Copy
Desktop  → /profile?from=mobile (full AppShell)
```

## Routes

| Path | Screen |
|------|--------|
| `/m` | Start (two choices) |
| `/m/upload` | PDF upload → import → compile |
| `/m/manual` | Short form → save personal → compile |
| `/m/ready` | Draft ready + handoff CTAs |

## Detection & gate

- **Server (middleware):** phone-class User-Agent + power path → `302 /m`  
  - Power paths: `/profile`, `/cv`, `/website`, `/publications`, `/settings`, `/support`, `/billing`, `/admin`  
  - Cookie `cvscholar_mobile_mode=full` disables force  
- **Client:** `MobileViewportGate` redirects narrow viewports on power paths (safety net)  
- **Feature flag:** `CVSCHOLAR_MOBILE_FLOW_ENABLED` (`1` default, `0` off)

Phone UA heuristics live in `apps/web/src/lib/mobile/constants.ts` (excludes typical tablets).

## Implementation map

| Area | Path |
|------|------|
| Constants / gate helpers | `apps/web/src/lib/mobile/constants.ts` |
| Preference cookie (client) | `apps/web/src/lib/mobile/preference.ts` |
| Compile helper | `apps/web/src/lib/mobile/flow.ts` |
| UI screens | `apps/web/src/components/mobile/*` |
| Pages | `apps/web/src/app/m/**` |
| Handoff email API | `apps/web/src/app/api/mobile/handoff-email/route.ts` |
| Middleware redirect | `apps/web/src/middleware.ts` |
| AppShell skip chrome on `/m` | `apps/web/src/components/app-shell.tsx` |

## Handoff

- **Continue on laptop:** `/profile?from=mobile` (same browser guest cookie or signed-in session)  
- **Email:** requires login; Resend via `RESEND_API_KEY` + `EMAIL_FROM`  
- **WhatsApp / Copy:** share absolute app URL  

## Analytics

Journey events (first-party):

- `mobile_start_viewed`  
- `mobile_upload_started` / `mobile_upload_completed`  
- `mobile_manual_submitted`  
- `mobile_ready_viewed`  
- `mobile_handoff_*` (continue, email, whatsapp, copy)

Meta (when enabled): `ViewContent` (`MobileStart`), custom `MobileDraftReady`. Never send CV content.

## Env

```text
CVSCHOLAR_MOBILE_FLOW_ENABLED=1
```

Optional; defaults to on. Set `0` in Portainer to disable redirects and leave full site as-is on phones.

## Out of scope (v1)

- Full mobile profile editor / website builder  
- DOC/DOCX import (rewrite import is PDF-only)  
- Prisma `MobileCvSession` table (optional later for admin funnels)

## QA checklist

- [ ] iPhone UA on `/profile` → `/m`  
- [ ] “Use full site” unlocks `/profile` without redirect  
- [ ] Guest upload → ready without account  
- [ ] Guest email handoff prompts login  
- [ ] Logged-in email handoff sends Resend message  
- [ ] Tablet / desktop not forced to `/m`  
- [ ] Scholar public sites unaffected  
