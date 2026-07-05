# CVScholar Current Feature Inventory

This inventory supports Phase 0 of the rewrite. It records what the current PHP/MySQL production app does today so the Next.js/PostgreSQL rewrite does not accidentally drop working features.

Sources reviewed:

- `public/index.php` route table.
- `app/controllers/*.php`.
- `app/models/*.php`.
- migrations `001` through `048`.
- `AGENTS.md` production rules.

## Inventory Rules

- Treat this as a living document.
- Update it before removing, replacing, or migrating any feature.
- Mark features as one of:
  - `Must preserve`: required for production continuity.
  - `Rebuild first`: important for rewrite MVP.
  - `Defer`: can remain in old app/read-only archive until after launch.
  - `Retire/rethink`: intentionally not carried forward without explicit decision.

## Product Areas

| Area | Current implementation | Rewrite priority | Notes |
|---|---|---:|---|
| Marketing site | `MarketingController`, marketing templates, pricing/contact/legal pages | Rebuild first | New app shell can reduce landing-page emphasis, but public SEO pages still matter. |
| Blog/SEO | `BlogController`, `SitemapController`, content files | Defer | Keep current SEO content available during rewrite; migrate later if needed. |
| Auth | `AuthController`, `Auth.php`, Google OAuth | Must preserve | Better Auth rewrite must support email/password or reset path plus Google. |
| Dashboard | `DashboardController`, `templates/dashboard/index.php` | Rebuild first | New app shell home should replace current CV list dashboard. |
| CV creation/editor | `CVController`, `CVProfile`, editor JS/CSS | Must preserve | Core workflow; map into Academic Profile + Build CV screens. |
| CV templates | `TemplateController`, `Template`, six templates | Must preserve | Port templates to controlled Tectonic template packages one by one. |
| LaTeX rendering | `LatexRenderer`, `RendererFactory`, metrics | Must preserve | Rewrite uses queued Tectonic worker; current renderer remains until cutover. |
| PDF download/preview | `CVController@preview/download/compile` | Must preserve | Move to queued PDF jobs and `file_assets`. |
| Central archive/profile | `ArchiveController`, `user_entries`, publications | Must preserve | This becomes the structured academic profile editor. |
| Imports | `ProfileImportController`, ORCID, Scholar, AI CV PDF import | Rebuild after core profile | Important growth feature, but not before stable profile/PDF flow. |
| DOI lookup | `CVController@doiLookup` | Defer | Rebuild as publication helper after profile/publications MVP. |
| CV sharing | `ShareController`, `/s/{slug}` | Must preserve | Preserve slugs or redirect. |
| Academic websites | `WebsiteController`, `PublicWebsiteController`, `AcademicWebsite` | Must preserve | Rewrite MVP should keep `/u/{slug}` before wildcard subdomains. |
| Website contact messages | `WebsiteContactMessage` | Must preserve | Add stronger spam/rate controls in rewrite. |
| Single/multi-page websites | migration `047`, website templates | Must preserve | Include in rewrite website settings. |
| Settings/profile preferences | `SettingsController`, `ProfileController` | Rebuild first | Split into account, privacy, profile preferences. |
| Billing/plans | `PlanController`, `PaymentController`, PayHere, subscriptions | Must preserve | Provider decision needed before checkout cutover. |
| Credits | `Credit`, credit ledger, admin grants | Must preserve | Move to workspace wallet + immutable ledger. |
| Support tickets | `TicketController`, tickets/attachments | Defer but preserve data | Can remain in old app/admin archive until rewrite support module exists. |
| Admin dashboard | `AdminController` | Rebuild before production cutover | Required to operate jobs, users, billing, templates. |
| Feature flags | `Feature`, `features`, `plan_features` | Rebuild as config/seed data | Avoid blind migration of config values. |
| Site settings | `SiteSetting`, admin settings | Rebuild carefully | Separate env/config/admin settings; do not migrate secrets blindly. |
| Emails | `EmailService`, SMTP settings, admin email tools | Rebuild after auth/core | Blueprint prefers Resend. |
| Cron jobs | `docker-entrypoint.sh`, `cron/*` | Must account for | Replace with workers/scheduled jobs in rewrite. |
| Mobile CV flow | `MobileController`, `MobileCvSession` | Defer but preserve data | Decide whether to keep continuation tokens. |
| Behavior analytics | `BehaviorController`, behavior tracking JS | Defer | Future events should go to PostHog; migrate only essential history. |
| User events | `EventsController`, `user_events` | Defer | Can become `usage_events`/PostHog events. |
| Analytics API | `AnalyticsController` | Defer/admin | Rebuild only if still needed. |
| Debug import tools | `DebugImportController` | Retire/rethink | Do not expose in rewrite unless behind strict admin/dev gating. |

## Current Route Groups

### Public Marketing and SEO

- `/`
- `/pricing`
- `/contact`
- `/privacy`
- `/terms`
- `/refund-policy`
- `/cookie-policy`
- `/demo/template/{id}`
- `/blog`
- `/blog/category/{category}`
- `/blog/tag/{tag}`
- `/blog/{slug}`
- `/sitemap.xml`
- `/robots.txt`
- `/llms.txt`

Rewrite notes:

- Keep public SEO routes live during rebuild.
- The blueprint prefers app-first UX, but SEO/legal pages remain necessary.
- `/pricing` must align with credit/subscription model.

### Authentication

- `/login`
- `/register`
- `/logout`
- `/auth/google`
- `/auth/google/callback`

Rewrite notes:

- Replace page-based login/register with modal Better Auth flows.
- Preserve Google OAuth.
- Decide password hash migration/reset strategy.

### Dashboard and CV Workflows

- `/dashboard`
- `/cv/create`
- `/cv/store`
- `/cv/edit/{id}`
- `/cv/update/{id}`
- `/cv/delete/{id}`
- `/cv/duplicate/{id}`
- `/cv/preview/{id}`
- `/cv/preview-data/{id}`
- `/cv/download/{id}`
- `/cv/compile/{id}`
- `/cv/{id}/section/add`
- `/cv/{id}/section/update`
- `/cv/{id}/section/delete`
- `/cv/{id}/section/reorder`
- `/cv/{id}/sections/reorder`
- `/cv/{id}/settings`
- `/api/cv/autosave`
- `/api/cv/{id}/latex`
- `/api/doi/lookup`

Rewrite notes:

- Split into Academic Profile and Build CV.
- Move compile to queue: request -> job -> worker -> R2 -> file asset.
- Normal users should never see raw logs/LaTeX unless explicit advanced/admin path.

### Templates

- `/templates`
- `/templates/preview/{id}`
- `/templates/demo/{id}`

Rewrite notes:

- Preserve six current CV templates.
- Convert template metadata to registry.
- Port rendering packages one at a time.

### Profile Import and Archive

- `/profile/import`
- `/profile/import/orcid`
- `/profile/import/scholar`
- `/profile/import/cv-pdf/start`
- `/profile/import/cv-pdf/status`
- `/profile/import/cv-pdf`
- `/profile/import/cv-draft/apply`
- `/profile/import/approve`
- `/profile/import/reject`
- `/profile/import/apply`
- `/profile/import/pending`
- `/archive`
- `/archive/personal`
- `/archive/entry/update`
- `/archive/publication/update`
- `/archive/publication/delete`
- `/archive/section/clear`
- `/archive/reset`
- `/profile/preferences`
- `/profile/consent`

Rewrite notes:

- `/archive` concept becomes the Academic Profile editor.
- Imports should write to draft profile changes with approval.
- Keep consent/preferences as privacy settings.

### Academic Website

- `/website`
- `/website/settings`
- `/website/publish`
- `/website/unpublish`
- `/website/preview`
- `/website/messages`
- `/u/{slug}`
- `/u/{slug}/publications`
- `/u/{slug}/teaching`
- `/u/{slug}/contact`
- `/u/{slug}/cv`
- POST `/u/{slug}/contact`

Rewrite notes:

- Preserve `/u/{slug}` compatibility.
- Add subdomains only after wildcard DNS/routing is tested.
- Keep draft/published behavior.
- Port section/field visibility.
- Add stronger spam controls.

### Mobile CV Flow

- `/mobile-start`
- `/mobile-start/upload`
- `/mobile-start/manual`
- `/mobile-cv-ready/{id}`
- `/mobile-cv-ready/{id}/email`
- `/mobile-cv-ready/{id}/track`

Rewrite notes:

- Defer until profile/CV/PDF flow is stable.
- Preserve existing session data if active users rely on it.

### Billing, Payments, Credits

- `/plans`
- `/plans/checkout/{plan}`
- `/api/payment/hash`
- `/api/payment/status`
- `/payment/notify`
- `/payment/success`
- `/payment/cancel`
- admin payment approval/refund routes.

Rewrite notes:

- Preserve PayHere payment history.
- Decide checkout provider before implementation.
- Credit ledger is core and must reconcile.

### Support

- `/support`
- `/support/store`
- `/support/view`
- `/support/reply`
- `/api/support/unread`
- `/support/attachment`
- admin ticket routes.

Rewrite notes:

- Data should be preserved.
- Full support UI can be deferred if the current app remains available read-only for support history.

### Admin

- `/admin`
- `/admin/retention`
- `/admin/users`
- `/admin/users/cvs`
- `/admin/users/cv/preview/{id}`
- `/admin/users/cv/pdf/{id}`
- `/admin/users/cv/compile`
- `/admin/users/credits/grant`
- `/admin/users/delete`
- `/admin/users/update-plan`
- `/admin/users/toggle-status`
- `/admin/features`
- `/admin/features/update`
- `/admin/settings`
- `/admin/settings/update`
- `/admin/settings/generate-analytics-key`
- `/admin/payments`
- `/admin/payments/refund`
- `/admin/payments/approve`
- `/admin/emails`
- `/admin/emails/test`
- `/admin/emails/campaign`
- `/admin/crons`
- `/admin/crons/toggle`
- `/admin/whatsapp`
- `/admin/behavior`
- `/admin/behavior/export`
- `/admin/tickets`
- `/admin/tickets/view`
- `/admin/tickets/reply`
- `/admin/tickets/status`

Rewrite notes:

- Admin is not optional before final production cutover.
- Queue/job admin becomes more important with workers.
- Sensitive actions need audit logs.

## Current Data Objects

Core models:

- `User`
- `CVProfile`
- `Template`
- `AcademicWebsite`
- `WebsiteContactMessage`
- `Credit`
- `Subscription`
- `Feature`
- `MobileCvSession`
- `Ticket`
- `SiteSetting`

Important tables/features from migrations:

- users
- templates
- template_sections
- cv_profiles
- cv_sections
- cv_entries
- user_entries
- publications
- payments
- subscriptions
- credit_transactions
- sync_logs
- cv_shares
- features
- plan_features
- support tickets and attachments
- user events
- SMTP/email settings
- cron jobs
- WhatsApp support settings
- behavior tracking
- analytics API/rate limits
- pdf_render_events
- CV/profile settings
- mobile_cv_sessions
- academic_websites
- website_contact_messages
- website site mode/nav config
- marketing preferences

## Rewrite MVP Scope Recommendation

Minimum production-capable rewrite scope:

1. Auth and workspace ownership.
2. Academic Profile editor.
3. CV Builder with at least the top current templates.
4. Queued PDF generation and file downloads.
5. Academic Website draft/publish with `/u/{slug}`.
6. Credits/subscription migration and safe plan gating.
7. Admin user/job/billing visibility.

Explicitly defer:

- Blog migration.
- Mobile CV handoff.
- ORCID/Scholar imports.
- AI CV import.
- Support ticket UI.
- Advanced analytics API.
- Custom domains.
- Institution workspaces beyond schema readiness.

## Parity Checklist Before Cutover

- A migrated user can log in.
- Profile basics and all supported sections appear.
- Publications appear and can be edited.
- Existing CV documents appear.
- A migrated CV can generate a PDF.
- Generated PDF is stored as a file asset.
- Existing public CV share slug works or redirects.
- Existing academic website slug works.
- Website contact form works.
- Credit balance matches.
- Active plan access matches.
- Admin can view user, jobs, payments, credits.
- Failed PDF job can be inspected and retried.
