# CVScholar Rewrite Data Migration Map

Source: `CVScholar_Rewrite_UI_UX_Technical_Blueprint.pdf`, current MySQL schema, and migrations through `048_user_marketing_preferences.sql`.

This document maps the current PHP/MySQL production data model to the proposed Next.js/PostgreSQL workspace model. It is a planning artifact only; it does not change production behavior.

## Migration Principles

- Migrate from a production database backup first, never directly from live production.
- Keep all legacy IDs in metadata or dedicated mapping fields until the rewrite has proven parity.
- Make import scripts idempotent. Re-running a migration must update or skip existing records, not duplicate them.
- Validate JSON before import and record failures per row.
- Preserve user access, paid plans, credits, generated PDFs, public links, and website slugs.
- Do not delete or mutate current MySQL production data during rewrite migration.
- Do not expose private files directly after moving them to object storage.

## Target Ownership Model

The current app is mostly `user_id` scoped. The rewrite should be `workspace_id` scoped.

For each current user:

1. Create or upsert `users`.
2. Create one individual `workspaces` row.
3. Create one owner `workspace_members` row.
4. Create one primary `academic_profiles` row.
5. Attach migrated CVs, websites, publications, files, billing, and credits through the workspace/profile.

Recommended metadata:

- Store `legacyUserId` on the new user or profile metadata.
- Store `legacyUsername` and `legacyEmail` for traceability.
- Store `legacySource: "php_mysql"` on imported records.

## Table Mapping Summary

| Current MySQL | Target PostgreSQL | Migration approach |
|---|---|---|
| `users` | `users`, `workspaces`, `workspace_members`, `academic_profiles`, `credit_wallets` | Split identity, ownership, profile, and credit balance. |
| `users.personal_info` | `academic_profiles` fields plus profile metadata | Parse JSON and normalize supported personal fields. |
| `user_entries` | typed profile tables and/or `profile_sections` | Map by `section_key`; preserve unknown fields in JSON. |
| `publications` | `publications` | Preserve source, DOI, URL, verification, inclusion. |
| `templates` | `cv_templates` | Convert active template registry; production LaTeX fragments are legacy metadata only. |
| `template_sections` | template package metadata / profile schema metadata | Preserve section schema for migration and editor compatibility. |
| `cv_profiles` | `cv_documents`, `file_assets`, profile settings | Map each CV profile to a CV document config. |
| `cv_sections` | `cv_documents.settingsJson` or CV section inclusion records | Preserve section visibility/order. |
| `cv_entries` | CV-specific overrides or profile section links | Prefer canonical profile data; preserve CV-specific overrides. |
| `cv_shares` | share/link metadata on `cv_documents` or `public_links` | Preserve slugs and view counts. |
| `academic_websites` | `academic_websites`, `website_publish_jobs`, snapshots later | Preserve slug, status, template, visibility, site mode. |
| `website_contact_messages` | `website_contact_messages` or `contact_messages` | Preserve messages and read state; keep private. |
| `payments` | `payments`/provider events, `credit_transactions`, `subscriptions` | Preserve PayHere history and gateway response JSON. |
| `subscriptions` | `subscriptions` | Map user subscription to workspace subscription. |
| `credit_transactions` | `credit_transactions`, `credit_wallets` | Preserve ledger and reconcile balance. |
| `pdf_render_events` | `pdf_render_jobs` and/or `usage_events` | Historical metrics can become usage events; not all are jobs. |
| `features`, `plan_features` | plan/template/feature access config | Convert to seed config, not per-user data. |
| `site_settings` | env/config/admin settings | Review manually; do not blindly migrate secrets/config. |
| `mobile_cv_sessions` | import/handoff sessions or `usage_events` | Preserve if mobile flow remains in rewrite. |
| support/admin/analytics tables | admin/support/usage equivalents | Migrate only if required for continuity/reporting. |

## Detailed Mapping

### Users

Current fields:

- `id`
- `email`
- `username`
- `hashed_password`
- `full_name`
- `title`
- `affiliation`
- `personal_info`
- `is_active`
- `is_admin`
- `subscription_plan`
- `subscription_expires_at`
- `credit_balance`
- `google_scholar_id`
- `orcid_id`
- device/login fields
- timestamps

Target:

- `users`
  - email
  - name/display name
  - image/avatar if available
  - status
  - legacy metadata
- `workspaces`
  - one individual workspace per migrated user
  - owner user id
  - plan/status
- `workspace_members`
  - role `owner`
- `academic_profiles`
  - display name
  - title
  - affiliation
  - personal links
  - bio
  - visibility
- `credit_wallets`
  - balance from `users.credit_balance`

Password/auth decision:

- Current `hashed_password` format must be inspected before auth migration.
- If Better Auth cannot reuse the hash safely, force password reset/magic-link login on first rewrite login.
- Google identities should map by email and any existing Google OAuth metadata.

Risks:

- Duplicate or invalid emails.
- Users with stale session plan data.
- Missing/invalid `personal_info` JSON.
- Password hash incompatibility.

### Personal Profile JSON

Current source:

- `users.personal_info`
- `cv_profiles.personal_info`

Target:

- `academic_profiles` columns for common fields.
- JSON metadata for fields without first-class target columns.

Recommended precedence:

1. `users.personal_info` as central/master source.
2. Fallback to newest/default `cv_profiles.personal_info`.
3. Fallback to `users.full_name`, `users.title`, `users.affiliation`, `users.email`.

Fields to normalize:

- full name
- title
- affiliation
- email
- phone
- location/address
- website
- LinkedIn
- ORCID
- Google Scholar
- avatar URL

### User Entries and Profile Sections

Current source:

- `user_entries.user_id`
- `user_entries.section_key`
- `user_entries.entry_order`
- `user_entries.data`

Target:

- typed tables where the blueprint defines them:
  - `educations`
  - `experiences`
  - `projects`
  - `publications`
  - awards/grants/conferences/supervision/memberships/languages as typed tables or `profile_sections`
- flexible fallback:
  - `profile_sections`

Known section keys from the current app:

- `academic_profile`
- `research_interests`
- `education`
- `experience`
- `teaching`
- `publications`
- `projects`
- `skills`
- `awards`
- `grants`
- `conferences`
- `supervision`
- `memberships`
- `languages`
- `references`

Mapping rule:

- Keep the original `section_key`.
- Preserve `entry_order`.
- Preserve the full original `data` JSON in `metadata.legacyData`.
- Promote commonly used fields to typed columns.

Risks:

- Flexible JSON keys may vary by template.
- Some fields may use older names.
- Some entries may exist only in `cv_entries` and not in `user_entries`.

### Publications

Current source:

- `publications`

Target:

- `publications`

Field mapping:

- `title` -> `title`
- `authors` -> `authors`
- `year` -> `year`
- `venue` -> `venue`
- `doi` -> `doi`
- `url` -> `url`
- `citation_count` -> metadata or metrics field
- `source` -> `source`
- `external_id` -> `externalId`
- `is_verified` -> `verified`
- `is_included` -> `isVisible` or inclusion settings
- `created_at`, `updated_at` -> timestamps

Risk:

- Duplicates may exist between manual, ORCID, Google Scholar, and imported CV data.
- Deduplicate by DOI first, then normalized title/year.

### CV Templates

Current source:

- `templates`
- `template_sections`
- migrations `002`, `013`, `015`, `038`, `043`

Target:

- `cv_templates`
- repository template packages
- template registry package

Important current rule:

- The production renderer is `app/services/LatexRenderer.php`.
- DB fields `latex_header`, `latex_footer`, and `latex_code` are not used by the production renderer.

Migration approach:

- Migrate template identity, slug, plan access, active state, preview image, and style metadata.
- Do not treat DB LaTeX fragments as source of truth.
- Port templates one by one into controlled Tectonic template packages.

Current template set:

- Classic
- Modern
- Detailed
- Classic Faculty
- European Formal
- Research Dossier

Risk:

- Template IDs may be referenced by `cv_profiles`; preserve mapping from old ID to new template ID.

### CV Profiles and CV Data

Current source:

- `cv_profiles`
- `cv_sections`
- `cv_entries`
- `user_entries`
- `publications`

Target:

- `cv_documents`
- `cv_document_settings` or `settingsJson`
- `pdf_render_jobs`
- `file_assets`

Mapping:

- `cv_profiles.id` -> `cv_documents.metadata.legacyCvProfileId`
- `cv_profiles.name` -> `cv_documents.title`
- `template_id` -> mapped `templateId`
- `is_default` -> default flag or metadata
- `personal_info` -> CV-specific override metadata
- `last_compiled_at` -> latest render metadata
- `pdf_path` -> `file_assets` if file exists
- `cv_sections.is_visible`, `section_order` -> `settingsJson.sectionVisibility/sectionOrder`
- `cv_entries` -> CV-specific overrides where they differ from canonical profile entries

Risk:

- Current app has both master entries and CV-specific entries.
- Migration should not collapse CV-specific customization without preserving it.

### Generated PDFs and Files

Current source:

- `cv_profiles.pdf_path`
- `storage/generated`
- `storage/uploads`
- `mobile_cv_sessions.uploaded_cv_file_path`
- possible support ticket attachments

Target:

- `file_assets`
- R2 object storage

Mapping:

- Upload existing files to R2.
- Store original local path in metadata.
- Store mime type, size, visibility, owner type/id.
- For missing local files, create a migration warning but continue.

Access rule:

- Private files require signed URLs.
- Public website downloads are public only if the user enabled them.

### PDF Render Metrics

Current source:

- `pdf_render_events`

Target:

- `pdf_render_jobs` for actual job records after rewrite.
- `usage_events` for historical metrics if useful.

Mapping:

- Historical `pdf_render_events` can be summarized, not necessarily imported row-for-row.
- Keep detailed history only if admin analytics need it.

### Academic Websites

Current source:

- `academic_websites`
- `website_contact_messages`
- migration `047_website_multipage.sql`

Target:

- `academic_websites`
- `website_publish_jobs`
- `website_published_snapshots` later
- `contact_messages`

Field mapping:

- `user_id` -> workspace/profile owner
- `slug` -> `slug`; later `subdomain`
- `status` -> `draft`/`published`
- `template_key` -> website template ID/key
- `headline` -> headline
- `section_visibility` -> section visibility JSON
- `field_visibility` -> private field visibility JSON
- `source_cv_id` -> mapped CV document ID
- `site_mode` -> single/multi mode
- `nav_config` -> nav config JSON
- `view_count`, `last_viewed_at`, `published_at` -> analytics/status

Compatibility:

- Keep `/u/{slug}` during migration.
- Add subdomains only after DNS, reserved names, and abuse protections exist.

Reserved names:

- Preserve and expand current reserved slugs list:
  - admin
  - api
  - app
  - www
  - mail
  - support
  - billing
  - login
  - dashboard
  - cvscholar
  - current route names

### Contact Messages

Current source:

- `website_contact_messages`

Target:

- `contact_messages` or website-scoped contact table.

Mapping:

- Preserve visitor name, email, subject, message, read state, created timestamp.
- Preserve IP hash only as private metadata if still useful.

Security:

- Do not expose visitor emails in public pages.
- Add Turnstile/rate limiting in rewrite before public launch.

### Credits

Current source:

- `users.credit_balance`
- `credit_transactions`

Target:

- `credit_wallets`
- `credit_transactions`

Mapping:

- Create one wallet per workspace.
- Set `balance` from current `users.credit_balance`.
- Import all current transactions with `legacyCreditTransactionId`.
- Reconcile:
  - `wallet.balance` should equal current balance.
  - ledger sum may not equal current balance if previous migrations changed balances; record discrepancy.

Risk:

- Migration `041` reset some plans and balances during initial credit grant. Verify against production before final import.

### Subscriptions and Payments

Current source:

- `users.subscription_plan`
- `users.subscription_expires_at`
- `subscriptions`
- `payments`

Target:

- `subscriptions`
- provider payment events or payment history table
- `usage_events`

Mapping:

- Prefer active row from `subscriptions`.
- Use `users.subscription_plan` as fallback.
- Preserve `payments.gateway_response` as JSON metadata.
- Preserve `transaction_id`.
- Preserve `payment_method` such as PayHere.
- Map current plans to new plans:
  - `free` -> Free
  - `starter` -> Starter or Pro depending final pricing
  - `pro` -> Pro
  - `enterprise` -> Institution/Enterprise

Risk:

- PayHere recurring state may not map cleanly to a new billing provider.
- Do not cut over billing until provider behavior is confirmed.

### Feature and Plan Access

Current source:

- `features`
- `plan_features`
- site settings

Target:

- plan config seed data.
- feature flags/config.

Mapping:

- Convert feature definitions to seed config.
- Do not import all config blindly as mutable production state.
- Review settings manually.

### Mobile CV Sessions

Current source:

- `mobile_cv_sessions`

Target:

- import sessions/handoff sessions if mobile flow remains.
- `usage_events` for historical funnel analytics.

Mapping:

- Preserve user, CV profile mapping, uploaded file mapping, statuses, continuation token if still valid, and timestamps.

Risk:

- Continuation tokens should be reviewed before migration. Consider expiring legacy tokens or issuing new ones.

### Support, Admin, Analytics, and Emails

Current sources include:

- support tickets and attachments.
- behavior tracking/events.
- email retention/reminder related tables if present.
- admin feature/settings tables.

Target:

- admin/support tables.
- `usage_events`.
- PostHog for future events.
- Sentry/structured logs for future errors.

Mapping:

- Decide whether historical support tickets must migrate. If not, keep old app/database read-only for admin reference.
- Product analytics can usually be summarized rather than migrated row-for-row.
- Retention email history should migrate only if needed for compliance or user experience.

## File Migration Plan

Current local storage:

- `storage/generated`
- `storage/uploads`
- `storage/temp`
- `storage/logs`
- `storage/analytics_exports`
- `storage/demos`

Target R2 buckets:

- `cvscholar-private`
- `cvscholar-public`
- `cvscholar-temp`
- `cvscholar-logs`

Rules:

- Generated private CV PDFs -> private bucket unless explicitly public.
- Public website assets -> public bucket.
- Temp build artifacts -> temp bucket with lifecycle deletion.
- Logs -> private logs bucket or Sentry/structured log sink.
- Analytics exports should be reviewed before migration; likely admin-only private assets.

## Migration Script Order

1. Preflight:
   - connect to MySQL backup.
   - connect to PostgreSQL staging.
   - verify schema versions.
   - verify file roots.
2. Users/workspaces/members.
3. Profiles and personal info.
4. User entries/profile sections.
5. Publications.
6. Templates and template ID mapping.
7. CV documents, section settings, CV-specific entries.
8. Files/PDF assets.
9. Academic websites.
10. Website contact messages.
11. Credits and ledger.
12. Subscriptions and payments.
13. Shares/public links.
14. Mobile/import/support/analytics optional data.
15. Reconciliation report.

## Reconciliation Checks

Counts:

- users.
- active users.
- CV profiles.
- user entries by section.
- publications.
- active templates.
- generated PDFs with existing files.
- academic websites by status.
- contact messages.
- credit transactions.
- payments/subscriptions.

Integrity:

- every workspace has an owner.
- every academic profile has a workspace.
- every CV document has a profile and template.
- every website has a profile.
- every file asset has an owner.
- every credit wallet balance matches expected balance.
- every public slug is unique.

Manual review:

- duplicate emails.
- duplicate slugs.
- malformed JSON.
- missing PDFs.
- unsupported section keys.
- payment records without transaction ID.
- users with active subscription but expired `subscription_expires_at`.

## Cutover Strategy

Recommended path:

1. Run full migration on staging backup.
2. Fix migration errors.
3. Run beta with selected users.
4. Freeze writes or implement short maintenance window.
5. Run final production backup.
6. Run final migration.
7. Verify critical counts and sample users.
8. Switch traffic.
9. Keep PHP app/database available for rollback/reference.

Rollback:

- DNS/app route returns to PHP app.
- No destructive changes to old MySQL production database.
- New PostgreSQL data remains for debugging and retry.

## Open Decisions

- Can Better Auth reuse current password hashes, or do all users need reset/magic-link login?
- Keep PayHere only, or add another billing provider?
- Use `/u/{slug}` only for website MVP, or launch wildcard subdomains immediately?
- Which historical analytics/support data must migrate versus remain archived?
- Which current CV templates are ported first to Tectonic?
- Should current generated PDFs be migrated to R2 immediately or lazily on first access?
- Should legacy continuation tokens remain valid?
