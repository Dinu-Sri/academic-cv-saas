# CVScholar Pro Template System Specification

## Purpose

This document defines **three premium academic CV templates** for CVScholar that feel credible for strong applicants in the **USA, UK, Europe, and international academic systems**, while still fitting CVScholar's current rendering model.

It is written specifically for your platform, based on:
- the current CVScholar template architecture, section model, and FPDF-based rendering approach,
- the current sample output you shared,
- common academic CV expectations seen in major university guidance.

This is **not** a generic design brief. It is an implementation-ready product specification for your SaaS.

---

## 1. Key Decision: Should CVScholar Keep the Classic LaTeX-Style Font?

**Yes — keep the classic Computer Modern / LaTeX-style serif as the default academic voice.**

### Recommendation
- Use **CMUSerif** as the primary body font for the two most serious academic templates:
  - **Classic Faculty CV**
  - **Research Dossier / Promotion CV**
- Use **CMUSans** for the more administrative / European template where a cleaner tabular feel is helpful.
- Do **not** use decorative, trendy, startup-style, or over-stylized fonts in academic CVs.

### Why this is the right choice
1. It already matches your rendering engine and current font stack.
2. It gives a scholarly, institutional, familiar academic feel.
3. It is safer for long publication lists than more fashionable fonts.
4. It avoids the visual mistake of making an academic CV look like a marketing resume.
5. It is easier to keep consistent across long documents, dense lists, and mixed formatting.

### Final font policy
- **Default academic serif**: `CMUSerif`
- **Default academic sans**: `CMUSans`
- **Mono**: reserve `CMUMono` only for rare technical identifiers, URLs, ORCID, grant codes, patent numbers, or software repositories if ever needed.

### Important note
Your system is **not actually generating LaTeX PDFs**; it is using **FPDF with Computer Modern Unicode fonts**. So the goal is **not “LaTeX imitation as a gimmick”**. The goal is to preserve the **discipline, restraint, hierarchy, and seriousness** that strong LaTeX academic CVs often have.

---

## 2. What is wrong with the current design direction?

Your current sample is already clean, but it still behaves like a basic academic CV rather than a top-tier one.

### Main issues in the current output
1. **Centered masthead consumes too much premium space**.
2. **Hierarchy is too flat** after the header.
3. **Section treatment is acceptable but not distinctive**.
4. **The publications section becomes a long undifferentiated block**.
5. **Generic “Work Experience” is too broad** for academia.
6. **The design does not yet reflect region-specific academic norms**.
7. **The first page is not optimized to surface the strongest academic signals early**.

### Product conclusion
Do not make the new templates more decorative.
Make them more:
- institutional,
- rank-aware,
- audience-aware,
- publication-aware,
- and region-aware.

---

## 3. Global Design Principles for All New Premium Templates

These rules apply to all three templates unless a template section explicitly overrides them.

### 3.1 Core visual philosophy
All premium academic CVs should feel:
- formal,
- calm,
- precise,
- highly readable,
- and immediately credible in faculty, fellowship, grant, or research hiring contexts.

Avoid:
- sidebars,
- bright blocks of color,
- icon-heavy headers,
- oversized graphic accents,
- timelines,
- progress bars,
- skill charts,
- profile photos by default,
- resume-style branding tricks.

### 3.2 Page architecture
CVScholar should support a stronger document architecture than the current free templates.

#### Required global improvements
Add support for these style controls in `style_config`:

```json
{
  "pageSize": "A4",
  "primaryColor": "#123456",
  "secondaryColor": "#666666",
  "fontFamily": "cmuserif",
  "fontSize": "10.5pt",
  "margins": "0.85in",
  "headerLayout": "left_masthead",
  "sectionHeaderStyle": "smallcaps_rule",
  "entryTitleWeight": "bold",
  "dateAlignment": "right_column",
  "dateColumnWidth": "23mm",
  "showPageNumbers": true,
  "showLastUpdated": true,
  "publicationStyle": "grouped",
  "showReferencesByDefault": false,
  "allowPhoto": false,
  "allowPersonalData": false,
  "showFullStreetAddress": false,
  "publicationNumbering": "by_group",
  "nameStyle": "titlecase",
  "nameSize": "20pt",
  "sectionTitleSize": "11.5pt",
  "bodyLeading": 1.18,
  "entrySpacing": 3.5,
  "sectionSpacing": 7,
  "subsectionSpacing": 4,
  "ruleWeight": 0.25,
  "linkStyle": "plain_text"
}
```

### 3.3 Region-aware page size
This matters more than many builders realize.

#### Recommendation
- **USA / North America preset**: `Letter`
- **UK / Europe / International preset**: `A4`
- Keep A4 as the platform default if needed, but add an export option or template-level paper setting.

### 3.4 Universal information hierarchy
Every strong academic CV should make the following easy to find:
1. identity,
2. current appointment,
3. research area,
4. education / appointments,
5. publications,
6. grants / teaching / supervision / service,
7. references only when needed.

### 3.5 Universal ordering rules
- Reverse chronological order almost everywhere.
- Dates aligned in a dedicated right-side date column.
- Same date style throughout the document.
- Same punctuation style throughout the document.
- Same capitalization logic throughout the document.
- Empty sections must not render.
- Thin sections should not be visually over-promoted.

### 3.6 Universal content rules
- No full mailing address by default in US/global academic mode.
- Show **city, country** or **department, institution** instead.
- No “References available upon request.”
- Show referees only when requested or regionally expected.
- Do not force skills sections into every academic CV.
- Publications must support grouping and author-name emphasis.
- Section names must be more academic than corporate.

### 3.7 Universal micro-typography rules
- Body text: 10 pt to 11 pt for normal templates.
- Publication-heavy dossier: 9.5 pt to 10 pt, but only with clean leading.
- Name should be visually dominant but not theatrical.
- Section headings should rely on typography and spacing, not decoration.
- Italics should be used with restraint.
- Bold should carry hierarchy; italics should carry secondary metadata.

### 3.8 Universal publication rules
Publications are the most important academic design problem in your product.

Every premium template must support:
- grouped publication subsections,
- hanging indent,
- consistent citation style,
- optional DOI and URL,
- optional bolding of the CV owner’s name,
- optional first-author / corresponding-author notes,
- optional “selected publications” behavior,
- optional middle-author contribution note,
- clear labeling for status when not yet formally published.

---

## 4. New Premium Template Suite

You should build **three pro-only templates**:

1. **Classic Faculty CV**
2. **European Formal Academic CV**
3. **Research Dossier / Promotion CV**

These should not duplicate the current free templates. They should feel like a more serious, refined, internationally credible premium set.

---

# TEMPLATE 1 — CLASSIC FACULTY CV

## 5. Template Metadata

### Name
**Classic Faculty CV**

### Slug
`classic-faculty`

### Premium
`true`

### Target audience
- Assistant professor applicants
- Postdoctoral researchers
- Lecturer / tenure-track applicants
- Fellowship applicants
- Early- to mid-career researchers
- International academics applying to US/UK/global institutions

### Primary use case
This is the **default premium academic template**.

If a user does not know which template to choose, this should be the safest recommendation.

### Design intent
A classic, restrained, highly credible faculty-style academic CV with:
- left-aligned masthead,
- clear date column,
- grouped academic sections,
- elegant serif typography,
- strong first-page focus.

---

## 6. Template 1 Style Config

```json
{
  "pageSize": "Letter",
  "primaryColor": "#1F3A5F",
  "secondaryColor": "#5B6773",
  "fontFamily": "cmuserif",
  "fontSize": "10.75pt",
  "margins": "0.85in",
  "headerLayout": "left_masthead",
  "sectionHeaderStyle": "smallcaps_rule",
  "entryTitleWeight": "bold",
  "dateAlignment": "right_column",
  "dateColumnWidth": "24mm",
  "showPageNumbers": true,
  "showLastUpdated": true,
  "publicationStyle": "grouped",
  "publicationNumbering": "continuous",
  "showReferencesByDefault": false,
  "allowPhoto": false,
  "allowPersonalData": false,
  "showFullStreetAddress": false,
  "nameStyle": "titlecase",
  "nameSize": "20pt",
  "sectionTitleSize": "11.5pt",
  "bodyLeading": 1.2,
  "entrySpacing": 3.5,
  "sectionSpacing": 8,
  "subsectionSpacing": 4,
  "ruleWeight": 0.25,
  "linkStyle": "plain_text"
}
```

### Design notes
- `#1F3A5F` is deep academic navy, softer than the current free classic template.
- `CMUSerif` keeps the scholarly voice.
- `Letter` is the right default for the US-oriented template.
- `showLastUpdated` is valuable in academic review contexts.

---

## 7. Template 1 Header Layout

### Required structure
```
FULL NAME
Current Title, Department, Institution
City, Country | professional email | phone
Website | ORCID | Google Scholar | Scopus / Web of Science profile (optional)
```

### Rules
- Header is **left aligned**, never centered.
- Full street address hidden by default.
- Contact lines must be compact and horizontal.
- Avoid icons in PDF output.
- Use separators such as `|` or middle dots consistently.
- If website/ORCID/Google Scholar are empty, collapse the row cleanly.

### Size logic
- Name: 20pt bold
- Position line: 10.5pt regular
- Contact lines: 9.5pt regular
- Space after masthead: 6 to 8mm
- Thin rule under masthead optional but subtle

---

## 8. Template 1 Section Order

Recommended default order:

1. `personal_info`
2. `research_interests`
3. `academic_appointments` *(new)*
4. `education`
5. `publications`
6. `grants`
7. `teaching`
8. `supervision`
9. `academic_service` *(new)*
10. `conferences`
11. `projects`
12. `awards`
13. `professional_memberships`
14. `editorial`
15. `skills`
16. `languages`
17. `references`

### Visibility rules
- `references`: hidden by default
- `skills`: hidden by default unless technical field and user has meaningful content
- `languages`: hidden by default unless genuinely relevant
- `projects`: hidden if publications + grants already cover the same academic story

### Why this order works
It surfaces identity, research area, appointments, education, and publications early — the strongest faculty signals.

---

## 9. Template 1 Section Styling

### Section headers
- Small caps or uppercase small-title appearance
- Left aligned
- Thin rule under heading
- Color = primary color
- Avoid oversized headers

### Entry pattern
For appointments, education, awards, grants, conferences, and service:

**Line 1**: main title / position / degree on left, dates on right  
**Line 2**: institution / department / location in italic or muted text  
**Line 3+**: concise description if needed

### Description policy
Descriptions should be allowed, but:
- must be short,
- must not become long resume bullets,
- must be optional,
- should be limited to one to three compact lines.

---

## 10. Template 1 Publication Behavior

### Default grouping
Publications should render in this order when data exists:
1. Selected Publications *(optional display block)*
2. Peer-Reviewed Journal Articles
3. Peer-Reviewed Conference Papers
4. Book Chapters
5. Books / Monographs
6. Patents
7. Preprints / Working Papers
8. Other Scholarly Outputs

### Rendering rules
- Hanging indent required
- Continuous numbering across all groups
- Candidate’s own name optionally bolded
- DOI shown in plain text style, not blue hyperlink styling
- URL only if DOI unavailable or link is strategically useful
- If `is_selected = true`, allow a short selected publications block near page 1 or early in the publications section

### Strong recommendation
Upgrade publication schema rather than keeping only:
- title
- authors
- year
- venue
- doi
- url

The current schema is too thin for serious academic use.

---

## 11. Template 1 Ideal User Experience

This template should feel like:
- a strong US faculty application CV,
- a fellowship-ready academic CV,
- a clean professor-style document,
- and something a committee can skim quickly.

It should **not** feel like:
- an executive resume,
- a startup one-pager,
- a corporate profile,
- a European bureaucracy dossier.

---

# TEMPLATE 2 — EUROPEAN FORMAL ACADEMIC CV

## 12. Template Metadata

### Name
**European Formal Academic CV**

### Slug
`european-formal-academic`

### Premium
`true`

### Target audience
- Applicants to continental European institutions
- Applicants for administrative or formal university files
- Researchers in EU / DACH / Nordic contexts
- Users who prefer a cleaner, more tabular, more administrative structure

### Primary use case
This template serves the academic environments where a CV may be a little more formal, factual, and administratively structured.

### Design intent
A clean, formal, European-style academic CV that is:
- more tabular in feeling,
- sans-based,
- very orderly,
- compact but not cramped,
- optionally able to include personal-data items when regionally appropriate.

---

## 13. Template 2 Style Config

```json
{
  "pageSize": "A4",
  "primaryColor": "#234B46",
  "secondaryColor": "#6A747C",
  "fontFamily": "cmusans",
  "fontSize": "10.25pt",
  "margins": "0.8in",
  "headerLayout": "formal_compact",
  "sectionHeaderStyle": "caps_no_rule",
  "entryTitleWeight": "semibold",
  "dateAlignment": "left_date_band",
  "dateColumnWidth": "26mm",
  "showPageNumbers": true,
  "showLastUpdated": true,
  "publicationStyle": "grouped",
  "publicationNumbering": "by_group",
  "showReferencesByDefault": true,
  "allowPhoto": true,
  "allowPersonalData": true,
  "showFullStreetAddress": false,
  "nameStyle": "titlecase",
  "nameSize": "18pt",
  "sectionTitleSize": "11pt",
  "bodyLeading": 1.18,
  "entrySpacing": 3,
  "sectionSpacing": 7,
  "subsectionSpacing": 4,
  "ruleWeight": 0.18,
  "linkStyle": "plain_text"
}
```

### Design notes
- `CMUSans` helps the document feel cleaner and more administratively structured.
- A4 is the right default.
- Photo and personal data should be **optional**, not mandatory.

---

## 14. Template 2 Header Layout

### Required structure
The masthead should be more compact and formal than Template 1.

Two modes should exist:

#### Mode A — International-safe mode (default)
```
FULL NAME
Current Position | Institution
City, Country | email | phone | website | ORCID
```

#### Mode B — Formal European mode (optional)
```
FULL NAME
Current Position | Institution
City, Country | email | phone
Nationality (optional) | Work authorization (optional)
Date of birth (optional) | Marital status (optional)
Photo (optional, top-right only if supported later)
```

### Important product rule
Because US/UK users should not be pushed toward personal-data-heavy CVs, this template must use **privacy toggles**.

Do not show personal details unless:
- the template supports them, and
- the user explicitly enables them.

---

## 15. Template 2 Section Order

1. `personal_info`
2. `education`
3. `academic_appointments`
4. `research_experience` *(new)*
5. `publications`
6. `conferences`
7. `teaching`
8. `projects`
9. `grants`
10. `academic_service`
11. `professional_memberships`
12. `languages`
13. `certifications`
14. `references`

### Why this order works
This arrangement is more documentarian and chronological, which suits many European academic contexts.

---

## 16. Template 2 Section Styling

### Visual tone
- clean sans-serif
- tighter but not compressed
- modest section titles
- minimal rules
- clear date band or date column

### Date treatment
Unlike Template 1, this template may use a more visibly structured date column.

Example:
```
2019–2024   Associate Professor, Department of X
            University of Y, City, Country
```

This makes the CV feel more tabular without requiring a true table.

### Section titles
- uppercase or compact caps
- no dramatic underline
- slightly increased letter spacing if possible
- use color sparingly

---

## 17. Template 2 Publication Behavior

### Grouping
Keep grouping, but allow slightly simpler grouping than the dossier template:
1. Journal Articles
2. Conference Papers / Proceedings
3. Book Chapters
4. Patents
5. Other Outputs

### Numbering
`publicationNumbering = by_group`

This means each subsection can begin again:
- Journal Articles [1] [2] [3]
- Conference Papers [1] [2]

This is often easier in formal administrative reading.

---

## 18. Template 2 References Behavior

Unlike the US-oriented template, this template may show:
- 2 referees at the end, or
- a line such as “Referees available upon request” only if absolutely necessary.

### Product rule
Prefer **actual referees** over the phrase “available upon request.”

---

## 19. Template 2 Ideal User Experience

This template should feel like:
- a serious European academic file,
- a refined administrative CV,
- a clean institutional document.

It should not feel like:
- a glossy design CV,
- a visually experimental document,
- or a corporate/LinkedIn résumé.

---

# TEMPLATE 3 — RESEARCH DOSSIER / PROMOTION CV

## 20. Template Metadata

### Name
**Research Dossier CV**

### Slug
`research-dossier`

### Premium
`true`

### Target audience
- Senior academics
- Tenure / promotion files
- Senior grant applicants
- Department heads / PIs
- Highly published researchers
- Users with long publication lists, supervision records, grants, and service history

### Primary use case
This is the most structured and academically serious template in the platform.

### Design intent
A long-form dossier template designed for:
- publication-heavy careers,
- promotion or review files,
- large supervision and teaching records,
- rigorous category separation,
- and conservative presentation.

---

## 21. Template 3 Style Config

```json
{
  "pageSize": "Letter",
  "primaryColor": "#442C5A",
  "secondaryColor": "#5E6270",
  "fontFamily": "cmuserif",
  "fontSize": "9.75pt",
  "margins": "0.78in",
  "headerLayout": "left_masthead_compact",
  "sectionHeaderStyle": "smallcaps_heavy_rule",
  "entryTitleWeight": "bold",
  "dateAlignment": "right_column",
  "dateColumnWidth": "23mm",
  "showPageNumbers": true,
  "showLastUpdated": true,
  "publicationStyle": "deep_grouped",
  "publicationNumbering": "by_group",
  "showReferencesByDefault": false,
  "allowPhoto": false,
  "allowPersonalData": false,
  "showFullStreetAddress": false,
  "nameStyle": "titlecase",
  "nameSize": "18.5pt",
  "sectionTitleSize": "11pt",
  "bodyLeading": 1.16,
  "entrySpacing": 2.6,
  "sectionSpacing": 6.5,
  "subsectionSpacing": 3.5,
  "ruleWeight": 0.3,
  "linkStyle": "plain_text",
  "grantsAmountMode": "hide_if_promotion"
}
```

### Design notes
- Slightly denser than Template 1.
- Still readable.
- Better suited to 6–25 page academic files.
- Deep plum/slate color gives seriousness without looking corporate.

---

## 22. Template 3 Header Layout

### Structure
```
FULL NAME
Current Academic Title, Department, Institution
City, Country | email | phone | website
ORCID | Google Scholar | Scopus / Web of Science Researcher Profile
Last updated: Month Year
```

### Why “Last updated” matters
For review and promotion files, document currency matters. This should be a built-in option.

---

## 23. Template 3 Section Order

1. `personal_info`
2. `academic_appointments`
3. `education`
4. `research_interests`
5. `publications`
6. `grants`
7. `patents` *(new)*
8. `invited_talks` *(new)*
9. `conferences`
10. `teaching`
11. `supervision`
12. `academic_service`
13. `editorial`
14. `awards`
15. `professional_memberships`
16. `projects`
17. `references`

### Why this order works
This order reflects how senior academic achievement is often evaluated:
- appointments,
- publications,
- funding,
- reputation,
- teaching/supervision,
- service.

---

## 24. Template 3 Publication Behavior

This template must be the most powerful publication template in the system.

### Required grouping
1. Peer-Reviewed Original Research Articles
2. Peer-Reviewed Reviews / Commentaries / Other Peer-Reviewed Outputs
3. Non-Peer-Reviewed Publications
4. Books
5. Book Chapters
6. Conference Proceedings
7. Patents
8. Preprints / Working Papers
9. Other Scholarly Outputs

### Required controls
- optional middle-author contribution annotations
- optional selected publications summary at beginning
- optional author-role notes
- optional status labels: accepted, in press, under review, preprint
- hide citation metrics in promotion mode by default
- grants amount visibility toggle

### Important note
This is the template where strong publication data modeling becomes essential.

---

## 25. Template 3 Teaching, Supervision, and Service Behavior

### Teaching
Should support:
- course title,
- code,
- level,
- institution,
- role,
- date range,
- class size or delivery mode optionally,
- short description only when helpful.

### Supervision
Should support grouping by:
- doctoral,
- master’s,
- undergraduate,
- postdoctoral mentoring.

### Service
Should support categories such as:
- departmental service,
- university service,
- professional service,
- conference organization,
- journal reviewing / editorial work.

---

## 26. Template 3 Ideal User Experience

This template should feel like:
- a tenure dossier,
- a promotion file,
- a serious professoriate record,
- a polished long-form research career document.

It should not feel like:
- a condensed resume,
- a two-page profile,
- a design-forward CV.

---

# 27. Section System Changes Required Across the Platform

Your current section model is a strong start, but it is not yet enough for elite academic CV use.

## 27.1 Sections to keep and reuse
These existing sections remain valuable:
- `personal_info`
- `education`
- `publications`
- `awards`
- `research_interests`
- `projects`
- `teaching`
- `supervision`
- `grants`
- `conferences`
- `professional_memberships`
- `editorial`
- `languages`
- `certifications`
- `references`

## 27.2 Sections to reposition
### `experience`
Do not rely on generic `experience` as the main academic career section.

Instead:
- keep it for non-academic or mixed roles,
- but introduce academic-specific sections.

## 27.3 New sections recommended
You should add these new sections.

### A. `academic_appointments`
This should become one of the most important sections in the premium templates.

```json
[
  {
    "name": "position",
    "label": "Academic Position",
    "type": "text",
    "required": true,
    "placeholder": "Associate Professor, Postdoctoral Researcher, Lecturer"
  },
  {
    "name": "department",
    "label": "Department / Unit",
    "type": "text",
    "required": false,
    "placeholder": "Department of Physics"
  },
  {
    "name": "institution",
    "label": "Institution",
    "type": "text",
    "required": true,
    "placeholder": "University Name"
  },
  {
    "name": "location",
    "label": "Location",
    "type": "text",
    "required": false,
    "placeholder": "City, Country"
  },
  {
    "name": "year_start",
    "label": "Start Year",
    "type": "text",
    "required": true,
    "placeholder": "2019"
  },
  {
    "name": "year_end",
    "label": "End Year",
    "type": "text",
    "required": false,
    "placeholder": "Present"
  },
  {
    "name": "status",
    "label": "Status / Appointment Type",
    "type": "text",
    "required": false,
    "placeholder": "Tenure-track, Visiting, Permanent, Adjunct"
  },
  {
    "name": "description",
    "label": "Description",
    "type": "textarea",
    "required": false,
    "placeholder": "Optional concise description"
  }
]
```

### B. `research_experience`
```json
[
  {
    "name": "role",
    "label": "Role",
    "type": "text",
    "required": true,
    "placeholder": "Research Fellow, Research Assistant, Lab Scientist"
  },
  {
    "name": "lab_or_center",
    "label": "Lab / Center / Group",
    "type": "text",
    "required": false,
    "placeholder": "Computational Materials Group"
  },
  {
    "name": "institution",
    "label": "Institution",
    "type": "text",
    "required": true,
    "placeholder": "Institution Name"
  },
  {
    "name": "supervisor",
    "label": "Supervisor / PI",
    "type": "text",
    "required": false,
    "placeholder": "Prof. Jane Doe"
  },
  {
    "name": "year_start",
    "label": "Start Year",
    "type": "text",
    "required": true,
    "placeholder": "2021"
  },
  {
    "name": "year_end",
    "label": "End Year",
    "type": "text",
    "required": false,
    "placeholder": "Present"
  },
  {
    "name": "description",
    "label": "Research Summary",
    "type": "textarea",
    "required": false,
    "placeholder": "Brief research focus, methods, responsibilities"
  }
]
```

### C. `academic_service`
```json
[
  {
    "name": "activity",
    "label": "Service Activity",
    "type": "text",
    "required": true,
    "placeholder": "Curriculum Committee, Conference Organizer, Seminar Convenor"
  },
  {
    "name": "role",
    "label": "Role",
    "type": "text",
    "required": false,
    "placeholder": "Chair, Member, Coordinator"
  },
  {
    "name": "organization",
    "label": "Organization / Unit",
    "type": "text",
    "required": false,
    "placeholder": "Faculty of Engineering / IEEE / Conference Name"
  },
  {
    "name": "year_start",
    "label": "Start Year",
    "type": "text",
    "required": true,
    "placeholder": "2022"
  },
  {
    "name": "year_end",
    "label": "End Year",
    "type": "text",
    "required": false,
    "placeholder": "Present"
  },
  {
    "name": "description",
    "label": "Description",
    "type": "textarea",
    "required": false,
    "placeholder": "Optional concise description"
  }
]
```

### D. `invited_talks`
```json
[
  {
    "name": "title",
    "label": "Talk Title",
    "type": "text",
    "required": true,
    "placeholder": "Talk title"
  },
  {
    "name": "host",
    "label": "Host Institution / Organizer",
    "type": "text",
    "required": true,
    "placeholder": "Stanford University / IEEE Region X"
  },
  {
    "name": "event",
    "label": "Event / Seminar Series",
    "type": "text",
    "required": false,
    "placeholder": "Materials Seminar Series"
  },
  {
    "name": "location",
    "label": "Location",
    "type": "text",
    "required": false,
    "placeholder": "Oxford, UK"
  },
  {
    "name": "year",
    "label": "Year",
    "type": "text",
    "required": true,
    "placeholder": "2025"
  },
  {
    "name": "type",
    "label": "Type",
    "type": "text",
    "required": false,
    "placeholder": "Invited, Keynote, Plenary"
  }
]
```

### E. `patents`
```json
[
  {
    "name": "title",
    "label": "Patent Title",
    "type": "text",
    "required": true,
    "placeholder": "Patent title"
  },
  {
    "name": "inventors",
    "label": "Inventors",
    "type": "text",
    "required": true,
    "placeholder": "Author / inventor list"
  },
  {
    "name": "patent_number",
    "label": "Patent Number",
    "type": "text",
    "required": false,
    "placeholder": "US1234567 / WO..."
  },
  {
    "name": "jurisdiction",
    "label": "Jurisdiction",
    "type": "text",
    "required": false,
    "placeholder": "US, EP, PCT, LK"
  },
  {
    "name": "status",
    "label": "Status",
    "type": "text",
    "required": false,
    "placeholder": "Granted, Filed, Published"
  },
  {
    "name": "year",
    "label": "Year",
    "type": "text",
    "required": true,
    "placeholder": "2025"
  },
  {
    "name": "url",
    "label": "Link",
    "type": "url",
    "required": false,
    "placeholder": "Patent database URL"
  }
]
```

---

# 28. Publication Schema Upgrade (Strongly Recommended)

The current publication schema is too limited for premium academic templates.

## 28.1 Recommended upgraded schema for `publications`

```json
[
  {
    "name": "title",
    "label": "Title",
    "type": "text",
    "required": true,
    "placeholder": "Publication title"
  },
  {
    "name": "authors",
    "label": "Authors",
    "type": "textarea",
    "required": true,
    "placeholder": "Full author list"
  },
  {
    "name": "year",
    "label": "Year",
    "type": "text",
    "required": true,
    "placeholder": "2025"
  },
  {
    "name": "type",
    "label": "Publication Type",
    "type": "text",
    "required": false,
    "placeholder": "Journal Article, Conference Paper, Book Chapter, Book, Preprint, Patent"
  },
  {
    "name": "peer_review_status",
    "label": "Peer Review Status",
    "type": "text",
    "required": false,
    "placeholder": "Peer-reviewed, Non-peer-reviewed"
  },
  {
    "name": "status",
    "label": "Publication Status",
    "type": "text",
    "required": false,
    "placeholder": "Published, In Press, Accepted, Under Review, Submitted, Preprint"
  },
  {
    "name": "venue",
    "label": "Journal / Conference / Publisher",
    "type": "text",
    "required": false,
    "placeholder": "Nature Materials"
  },
  {
    "name": "volume",
    "label": "Volume",
    "type": "text",
    "required": false,
    "placeholder": "12"
  },
  {
    "name": "issue",
    "label": "Issue",
    "type": "text",
    "required": false,
    "placeholder": "4"
  },
  {
    "name": "pages",
    "label": "Pages",
    "type": "text",
    "required": false,
    "placeholder": "115-129"
  },
  {
    "name": "doi",
    "label": "DOI",
    "type": "text",
    "required": false,
    "placeholder": "10.xxxx/xxxxx"
  },
  {
    "name": "url",
    "label": "URL",
    "type": "url",
    "required": false,
    "placeholder": "Optional publication link"
  },
  {
    "name": "candidate_role_note",
    "label": "Role Note",
    "type": "text",
    "required": false,
    "placeholder": "First author, Corresponding author, Equal contribution"
  },
  {
    "name": "contribution_note",
    "label": "Contribution Note",
    "type": "textarea",
    "required": false,
    "placeholder": "Optional contribution note for middle-author papers"
  },
  {
    "name": "is_selected",
    "label": "Selected Publication",
    "type": "text",
    "required": false,
    "placeholder": "true / false"
  }
]
```

## 28.2 Publication rendering rules
- Do not render empty metadata fields.
- Use a consistent citation sequence.
- Group by `type` and `peer_review_status` where template requires.
- `status` must be visibly shown when not yet published.
- Support bolding the user’s own name at render time.
- Allow a template-level option for showing or hiding contribution notes.

---

# 29. Existing Section Improvements

## 29.1 `personal_info`
Recommended additions:
- `city_country`
- `current_department`
- `google_scholar`
- `scopus_profile`
- `researcherid`
- `linkedin` *(optional, usually hidden in academic mode)*
- `nationality` *(Europe only, optional)*
- `work_authorization` *(optional)*
- `date_of_birth` *(Europe only, optional)*
- `marital_status` *(Europe only, optional)*
- `photo_path` *(future support only)*

## 29.2 `education`
Recommended additions:
- `supervisor`
- `co_supervisor`
- `thesis_type`
- `distinction`
- `expected_completion`

## 29.3 `grants`
Recommended additions:
- `grant_number`
- `currency`
- `amount_display`
- `collaborators`
- `outcome`
- `is_competitive`

## 29.4 `teaching`
Recommended additions:
- `class_size`
- `delivery_mode`
- `curriculum_design`
- `evaluation_summary`

## 29.5 `supervision`
Recommended additions:
- `institution`
- `student_status`
- `completion_year`
- `role_detail`
- `funded_by`

## 29.6 `conferences`
Recommended additions:
- `authors`
- `date`
- `presentation_type`
- `invited` flag
- `published_in_proceedings` flag

---

# 30. Rendering Rules for All Premium Templates

## 30.1 Dates
- Use en dash or hyphen consistently.
- Examples:
  - `2021-2024`
  - `2022-Present`
  - `May 2025`
- Never mix many date styles randomly.

## 30.2 Entry title line
The most important item belongs on the left.
The date belongs in the right date column.

Correct pattern:
```
Associate Professor                                  2022-Present
Department of Materials Science, University X
```

Wrong pattern:
- date on its own line,
- centered dates,
- title and date mixed in prose.

## 30.3 Description blocks
Avoid long paragraphs in CV entries.

Use description only when it adds value, such as:
- teaching responsibilities,
- grant role clarity,
- service impact,
- interdisciplinary project explanation.

## 30.4 Spacing
Spacing is one of the biggest differentiators between average and premium CVs.

Rules:
- more space before sections than before entries,
- more space after masthead than after a normal entry,
- tight but breathable line spacing in publication lists,
- never let one-line entries float too far apart.

## 30.5 Rules and dividers
Use rules only as subtle separators.
Do not use heavy full-width graphic lines everywhere.

## 30.6 Page numbers
- Always show page numbers on premium templates.
- Placement options:
  - bottom center,
  - bottom right,
  - top right in dossier mode.
- Keep quiet and unobtrusive.

## 30.7 Last updated line
Recommended for Template 1 and Template 3.
Optional for Template 2.

---

# 31. Section Naming Standards

Section names shape how committees read the candidate.

## Preferred academic labels
Use these labels instead of more generic ones where possible:

- `Academic Appointments` instead of `Work Experience`
- `Research Experience` instead of generic `Projects` when that is the real content
- `Grants and Funding`
- `Selected Publications`
- `Peer-Reviewed Journal Articles`
- `Teaching Experience`
- `Student Supervision`
- `Academic Service`
- `Editorial and Reviewing Activity`
- `Invited Talks`
- `Conference Presentations`
- `Professional Memberships`

## Labels to avoid as default academic labels
- Career Objective
- Profile Summary
- Employment History
- Core Competencies
- Technical Stack
- Achievements
- Portfolio

These sound more corporate than academic.

---

# 32. Region-Specific Content Rules

## 32.1 USA / Canada / UK / many global applications
Default behavior should be conservative:
- no photo,
- no date of birth,
- no marital status,
- no number of children,
- no full home mailing address unless needed,
- no unnecessary personal details.

## 32.2 Europe
Allow optional inclusion of:
- nationality,
- work authorization / residence permit,
- date of birth,
- photo,
- selected personal details,
if the user explicitly chooses the European formal mode.

## 32.3 Product rule
Never force one region’s norm onto another region’s user.

This is why the template system must support:
- template-level defaults,
- user-level visibility toggles,
- field-level privacy settings.

---

# 33. Editor and UX Requirements

The premium templates will only feel premium if the editor helps users make good decisions.

## 33.1 Section guidance text
Each section should explain what belongs there.

Example for `academic_appointments`:
> Use this section for faculty, lecturer, postdoctoral, visiting, and research appointments. Do not mix scholarships, awards, and grants here.

## 33.2 Smart warnings
Add warnings such as:
- “This publication has no type; grouping may fail.”
- “You are using full street address in a US-style template. Hide it?”
- “References are visible, but many academic applications do not require them.”
- “Your publications are not categorized; consider using grouped mode.”
- “You have both Experience and Academic Appointments visible with overlapping content.”

## 33.3 Empty section suppression
Do not show headings for empty sections.
This is essential.

## 33.4 Optional section presets by career stage
Add presets such as:
- PhD student
- Postdoc
- Early-career faculty
- Senior faculty / PI

These presets should change section visibility and ordering, not just colors.

---

# 34. PDF Output Quality Rules

## 34.1 Avoid visual problems
Premium templates must never produce:
- orphan headings at page bottoms,
- publication numbers detached from entries,
- uneven hanging indents,
- huge white holes between sections,
- date collisions,
- broken link strings overrunning margins,
- repeated section headers with inconsistent spacing.

## 34.2 Page break logic
Implement better logic for:
- keeping section title with at least one entry,
- avoiding single publication titles at bottom with metadata on next page,
- repeating publication subsection heading only when necessary.

## 34.3 Long publication lists
Publication-heavy users should not break the layout.

Support:
- compact leading,
- grouped headings,
- proper continuation flow,
- optional omission of URLs when DOI exists,
- optional compact citation style.

---

# 35. Shared/Public CV View Recommendations

Your public/shared HTML page should also reflect academic seriousness.

## Recommendations
- mirror the chosen template color and font family as closely as possible,
- show document metadata such as template name and last updated,
- keep the HTML header minimal,
- do not convert the public CV page into a social-media-style profile,
- show citation profiles only when user enables them.

---

# 36. Implementation Priority

## Phase 1 — Highest value changes
1. Add the three premium templates.
2. Add `academic_appointments`.
3. Add `academic_service`.
4. Add `patents`.
5. Add `invited_talks`.
6. Upgrade publication schema and grouped rendering.
7. Change header from centered to template-controlled layout.
8. Add page size support for A4 / Letter.

## Phase 2 — Strong product upgrades
1. Add region-aware personal-info toggles.
2. Add career-stage presets.
3. Add “selected publications” mode.
4. Add contribution notes for publications.
5. Add last-updated footer/header option.

## Phase 3 — Advanced refinement
1. Add user-controlled citation style options.
2. Add photo support only for European formal mode.
3. Add narrative CV / R4RI support as a separate future product path.

---

# 37. Final Product Recommendations

## What CVScholar should become
CVScholar should not compete with generic resume builders.
It should become a **serious academic document system**.

That means the product should emphasize:
- academic section logic,
- publication intelligence,
- faculty dossier credibility,
- international conventions,
- and quiet typographic quality.

## Final recommendation on the three premium templates

### Template 1 — Classic Faculty CV
Best default for:
- US faculty applications
- postdocs
- fellowship applications
- general academic use

### Template 2 — European Formal Academic CV
Best for:
- continental Europe
- formal university file submissions
- users who prefer structured tabular clarity

### Template 3 — Research Dossier CV
Best for:
- senior researchers
- promotion / tenure files
- publication-heavy careers
- academic leadership profiles

---

# 38. Short Answer for the Font Question

**Yes, keep the classic LaTeX-style serif voice as your main academic default.**

But use it with discipline:
- serif for the two serious academic templates,
- sans for the European formal template,
- no decorative fonts,
- no trendy resume styling.

That combination will look more credible to top academics than trying to appear “modern” in a commercial design sense.

---

# 39. One-Sentence Strategic Summary

Build CVScholar’s premium template system around **institutional clarity, academic hierarchy, publication intelligence, and region-aware conventions**, not around decorative visual variety.
