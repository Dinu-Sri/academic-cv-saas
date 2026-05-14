# CV Import UX Overhaul Plan

## Goal

Make `/profile/import` easy for low-IT-confidence academics to use without guessing what will happen next.

The page should answer three questions immediately:

1. What should I do first?
2. What did the system find?
3. What will be added to my CV if I approve?

The default rule is simple: nothing changes until the user approves it.

## Current Direction

Phase 1 converts the import page from a mixed dashboard into a guided workflow:

1. Import
2. Review
3. Add to CV

The implementation keeps the existing backend routes where possible and focuses on clarity, safer defaults, and removing confusing page content.

## User Problems Being Solved

- Users saw too many unrelated choices at once.
- PDF import, ORCID import, Scholar import, profile apply, publication review, and approved-publication history all appeared on one screen.
- The approved publications table looked actionable, but users could not manage those records there.
- ORCID and Scholar imports could trigger syncing of previously approved publications as a hidden side effect.
- Technical status details made the page feel more complex than the task.

## Phase 1 Behavior

### Source Selection

The page now has one recommended main path:

- Import your old CV PDF

Supporting paths are grouped below it:

- ORCID
- Google Scholar

Each path uses plain wording about what it can bring into the profile.

### Status

All import sources report into one status panel. The normal UI uses user-friendly stages such as:

- Checking the PDF file
- Reading CV pages
- Finding academic sections
- Organizing details for review
- Ready to review

Technical details such as model, token count, and extraction engine are not shown in the normal workflow.

### Review

Imported profile details and CV section entries appear in one review area named "Review Found Information".

The user sees compact counts for:

- Profile details
- CV sections
- CV items

Checked items are added when the user clicks "Add Selected to My CV". The default merge option keeps existing CV content and adds missing or new items. Replace behavior is kept under Advanced options.

### Publications Waiting for Approval

Pending publications are shown as a simple checklist. Users can approve or remove selected publications.

Approved publications are not shown as a long table on the import page anymore. The page only shows a compact count and a "Manage in CV Editor" link.

### Hidden Side Effects Removed

ORCID and Google Scholar imports no longer sync previously approved publications into the CV during source import. Publications are synced when the user explicitly approves selected pending publications.

## Files Involved

- `templates/profile/import.php`: guided import UI, status panel, review checklist, publication checklist.
- `app/controllers/ProfileImportController.php`: compact page data, hidden sync removal, pending publication response counts.
- `app/services/ProfileImportService.php`: approved publication count helper.
- `app/services/AiCvImportService.php`: existing OpenAI full-PDF import and draft apply behavior.

## Acceptance Criteria

- First viewport has one obvious recommended action.
- Page clearly says nothing changes until approval.
- No full approved-publication archive table appears on the import page.
- PDF import shows plain status updates and then a review checklist.
- ORCID import shows reviewable profile/CV data and pending publications without silent CV sync.
- Scholar import shows reviewable profile/publication data without silent CV sync.
- Pending publications can still be approved or removed.
- Approved publication count updates after approval.
- User has a clear path to manage existing publications in the CV editor.

## Verification Checklist

1. Run PHP syntax checks for touched files.
2. Open `/profile/import` locally and verify the simplified layout.
3. Test PDF import through the async worker.
4. Test ORCID import with education, employment, and publications.
5. Test Google Scholar import with new and duplicate publications.
6. Approve pending publications and confirm they sync into the CV.
7. Confirm users with existing approved publications see only a count and manage link.
8. Test mobile width for readable buttons, cards, and review lists.

## Later Phase Ideas

- Dedicated publication manager with actions for hide from CV, delete archive record, and resync.
- Persistent multi-source pending-change queue stored in the database.
- Field-level conflict comparison when multiple sources disagree.
- Confidence and provenance badges if the backend stores reliable metadata.
- Import history and undo for applied imports.
