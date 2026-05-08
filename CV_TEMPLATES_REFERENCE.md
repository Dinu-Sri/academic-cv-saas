# CVScholar — CV Template System Reference

> **Purpose**: Complete specification of CVScholar's existing 3 free CV templates.  
> Use this document to design **3 new Pro-only templates** with distinct visual identities.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Technology Stack & Rendering Engine](#2-technology-stack--rendering-engine)
3. [Existing Templates Summary](#3-existing-templates-summary)
4. [Template Style Configuration](#4-template-style-configuration)
5. [Sections & Field Schemas](#5-sections--field-schemas)
6. [PDF Rendering Details](#6-pdf-rendering-details)
7. [Subscription & Feature Flags](#7-subscription--feature-flags)
8. [Database Schema (Key Tables)](#8-database-schema-key-tables)
9. [UI & Editor Interface](#9-ui--editor-interface)
10. [Shared CV / Public View](#10-shared-cv--public-view)
11. [Design Brief for New Pro Templates](#11-design-brief-for-new-pro-templates)

---

## 1. Platform Overview

**CVScholar** is an academic CV builder SaaS for researchers, professors, and graduate students.

- **Users**: Academics, researchers, PhD students, professors
- **Core flow**: Register → Pick template → Fill sections in editor → Compile PDF → Download/Share
- **Plans**: Free (3 templates, 2 CVs), Pro ($1/mo, unlimited templates, 20 CVs), Enterprise
- **Key differentiator**: Academic-focused — supports ORCID import, Google Scholar import, publication lists, grants, supervision, editorial roles, etc.

---

## 2. Technology Stack & Rendering Engine

| Component | Technology |
|-----------|-----------|
| Backend | Pure PHP 8.2 MVC (no framework) |
| Database | MySQL 8.0 |
| Frontend | Bootstrap 5.3.3, vanilla JS |
| PDF Engine | **xelatex** via `LatexRenderer` for production CV compilation |
| Fonts | Computer Modern Unicode (CMUSerif, CMUSans, CMUMono) — serif/sans/mono variants with bold/italic |
| Page Size | A4 (210 × 297 mm) |
| Deployment | Docker (PHP 8.2 Apache + MySQL 8.0) |

### How PDF Generation Works

Production CV compilation uses `RendererFactory` → `LatexRenderer`, which generates a controlled xelatex document from normalized CV data. Template demo previews also use `LatexRenderer` with shared sample CV data. Legacy `LatexService.php` remains for LaTeX source helper flows and still contains older FPDF routines.

1. Template's `style_config` JSON provides layout defaults such as `fontFamily`, `fontSize`, `margins`, and page-number preferences
2. `LatexRenderer` renders the CV through xelatex with Computer Modern-style fonts
3. Section headings and the name header render in black for all templates
4. Margins, page size, page numbers, density, and section coverage are driven by `style_config` and template sections

**Rendering pipeline**:
- Parse `style_config` → set margins, fonts, colors
- Render personal info header (name, title, affiliation, contact)
- Loop through sections in `section_order` → render section header + entries
- Output PDF to `storage/generated/{user_id}/`

---

## 3. Existing Templates Summary

| ID | Name | Slug | Target User | Premium | Primary Color | Font | Font Size | Margins |
|----|------|------|-------------|---------|---------------|------|-----------|---------|
| 1 | Classic Academic | `classic` | Traditional academics, tenure applications | No (Free) | `#003366` (dark navy) | `lmodern` (Computer Modern serif) | 11pt | 1in (~25.4mm) |
| 2 | Modern Professional | `modern` | Industry-adjacent researchers, postdocs | No (Free) | `#0077B5` (LinkedIn blue) | `raleway` (sans-serif) | 11pt | 0.75in (~19mm) |
| 3 | Detailed Academic | `detailed` | Senior researchers, grant applications | No (Free) | `#660000` (burgundy) | `ebgaramond` (classical serif) | 10pt (smaller for density) | 0.9in (~22.9mm) |

### Template Descriptions

**Classic Academic** — "Traditional academic CV with clean typography and structured sections." Conservative serif layout, wide margins, standard academic formatting. Best for faculty applications and tenure review.

**Modern Professional** — "Contemporary design with accent colors and a sidebar layout." Sans-serif, tighter margins, professional blue accent. Suited for industry roles, tech academia, and interdisciplinary positions.

**Detailed Academic** — "Comprehensive template for senior academics with publication lists and grants." Smaller font to fit more content, elegant serif, page numbers shown. Designed for researchers with extensive publication/grant records.

---

## 4. Template Style Configuration

Each template stores a `style_config` JSON in the database:

### Classic Academic (ID=1)
```json
{
  "primaryColor": "#003366",
  "fontFamily": "lmodern",
  "fontSize": "11pt",
  "margins": "1in"
}
```
- **Vibe**: Traditional, conservative, serif-heavy
- **Section titles**: Large bold, navy `#003366`, rule underline
- **Page style**: No headers/footers

### Modern Professional (ID=2)
```json
{
  "primaryColor": "#0077B5",
  "fontFamily": "raleway",
  "fontSize": "11pt",
  "margins": "0.75in"
}
```
- **Vibe**: Clean, contemporary, sans-serif
- **Section titles**: Large bold, blue `#0077B5`, thicker rule underline
- **Additional colors**: Dark text `#333333` (RGB 51,51,51)
- **Page style**: No headers/footers

### Detailed Academic (ID=3)
```json
{
  "primaryColor": "#660000",
  "fontFamily": "ebgaramond",
  "fontSize": "10pt",
  "margins": "0.9in"
}
```
- **Vibe**: Scholarly, dense, elegant serif
- **Section titles**: Large small-caps, burgundy `#660000`, rule underline
- **Page style**: Shows page numbers (plain style)

---

## 5. Sections & Field Schemas

### 5.1 Base Sections (Available in ALL Templates)

These 7 sections exist in all 3 templates:

#### Personal Information (`personal_info`)
- **Order**: 1 | **Required**: Yes | **Repeatable**: No
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `full_name` | Full Name | text | Yes | — |
| `title` | Title | text | No | "Dr., Prof." |
| `affiliation` | Affiliation | text | No | — |
| `email` | Email | email | Yes | — |
| `phone` | Phone | text | No | — |
| `address` | Address | textarea | No | — |
| `website` | Website | url | No | — |
| `orcid` | ORCID ID | text | No | — |

#### Education (`education`)
- **Order**: 2 | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `degree` | Degree | text | Yes | "Ph.D. in Physics" |
| `institution` | Institution | text | Yes | — |
| `location` | Location | text | No | — |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Present" |
| `thesis` | Thesis Title | text | No | — |
| `gpa` | GPA | text | No | — |

#### Work Experience (`experience`)
- **Order**: 3 | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `position` | Position | text | Yes | — |
| `organization` | Organization | text | Yes | — |
| `location` | Location | text | No | — |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Present" |
| `description` | Description | textarea | No | — |

#### Publications (`publications`)
- **Order**: 4 | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Title | text | Yes | — |
| `authors` | Authors | text | Yes | — |
| `year` | Year | text | Yes | — |
| `venue` | Journal/Conference | text | No | — |
| `doi` | DOI | text | No | — |
| `url` | URL | url | No | — |

#### Skills (`skills`)
- **Order**: 5 | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `category` | Category | text | Yes | "Programming Languages" |
| `skills` | Skills | text | Yes | "Python, MATLAB, C++" |

#### Awards & Honors (`awards`)
- **Order**: 6 | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Award Title | text | Yes | — |
| `organization` | Organization | text | No | — |
| `year` | Year | text | Yes | — |
| `description` | Description | textarea | No | — |

#### References (`references`)
- **Order**: 7 (always last) | **Required**: No | **Repeatable**: Yes
- **Fields**:

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `name` | Name | text | Yes | — |
| `title` | Title | text | No | — |
| `affiliation` | Affiliation | text | No | — |
| `email` | Email | email | No | — |
| `phone` | Phone | text | No | — |

---

### 5.2 Extended Sections by Template

#### Classic Academic (ID=1) — 9 total sections
Base 7 + 2 additional:

| Section Key | Display Name | Order | Repeatable |
|------------|-------------|-------|------------|
| `research_interests` | Research Interests | 8 | Yes |
| `projects` | Projects | 9 | Yes |

#### Modern Professional (ID=2) — 12 total sections
Base 7 + 5 additional:

| Section Key | Display Name | Order | Repeatable |
|------------|-------------|-------|------------|
| `research_interests` | Research Interests | 8 | Yes |
| `projects` | Projects | 9 | Yes |
| `certifications` | Certifications & Licenses | 10 | Yes |
| `languages` | Languages | 11 | Yes |
| `professional_memberships` | Professional Memberships | 12 | Yes |

#### Detailed Academic (ID=3) — 17 total sections
Base 7 + 10 additional:

| Section Key | Display Name | Order | Repeatable |
|------------|-------------|-------|------------|
| `research_interests` | Research Interests | 8 | Yes |
| `projects` | Projects | 9 | Yes |
| `teaching` | Teaching Experience | 10 | Yes |
| `supervision` | Student Supervision | 11 | Yes |
| `grants` | Grants & Funding | 12 | Yes |
| `conferences` | Conference Presentations | 13 | Yes |
| `certifications` | Certifications & Licenses | 14 | Yes |
| `languages` | Languages | 15 | Yes |
| `professional_memberships` | Professional Memberships | 16 | Yes |
| `editorial` | Editorial & Reviewing | 17 | Yes |

---

### 5.3 Extended Section Field Schemas

#### Research Interests (`research_interests`)

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `area` | Research Area | text | Yes | "e.g., Machine Learning, Computational Chemistry" |
| `description` | Description | textarea | No | "Brief description of this research interest" |

#### Projects (`projects`)

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Title | text | Yes | — |
| `role` | Role | text | No | "Principal Investigator, Co-PI, Researcher" |
| `organization` | Organization/Funder | text | No | — |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Present" |
| `description` | Description | textarea | No | — |

#### Teaching Experience (`teaching`) — *Detailed only*

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `course` | Course Name | text | Yes | "e.g., Introduction to Physics" |
| `code` | Course Code | text | No | "e.g., PHY101" |
| `institution` | Institution | text | Yes | — |
| `level` | Level | text | No | "Undergraduate, Graduate, Postgraduate" |
| `role` | Role | text | No | "Lecturer, Teaching Assistant, Instructor" |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Present" |
| `description` | Description | textarea | No | — |

#### Student Supervision (`supervision`) — *Detailed only*

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `student_name` | Student Name | text | Yes | — |
| `degree` | Degree | text | Yes | "Ph.D., M.Sc., B.Sc." |
| `thesis_title` | Thesis Title | text | No | — |
| `role` | Your Role | text | No | "Main Supervisor, Co-Supervisor, Examiner" |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Ongoing" |
| `status` | Status | text | No | "Completed, In Progress" |

#### Grants & Funding (`grants`) — *Detailed only*

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Grant Title | text | Yes | — |
| `agency` | Funding Agency | text | Yes | — |
| `amount` | Amount | text | No | "e.g., $100,000" |
| `role` | Role | text | No | "PI, Co-PI, Named Investigator" |
| `year_start` | Start Year | text | Yes | — |
| `year_end` | End Year | text | No | "Present" |
| `status` | Status | text | No | "Active, Completed, Pending" |

#### Conference Presentations (`conferences`) — *Detailed only*

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Presentation Title | text | Yes | — |
| `conference` | Conference Name | text | Yes | — |
| `location` | Location | text | No | — |
| `year` | Year | text | Yes | — |
| `type` | Type | text | No | "Oral, Poster, Keynote, Invited Talk" |

#### Certifications & Licenses (`certifications`)

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `title` | Certification | text | Yes | "e.g., AWS Solutions Architect, PMP" |
| `issuer` | Issuing Organization | text | Yes | — |
| `year` | Year Obtained | text | Yes | — |
| `expiry` | Expiry | text | No | "No Expiry" |
| `credential_id` | Credential ID | text | No | — |

#### Languages (`languages`)

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `language` | Language | text | Yes | — |
| `proficiency` | Proficiency | text | Yes | "Native, Fluent, Intermediate, Basic" |

#### Professional Memberships (`professional_memberships`)

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `organization` | Organization | text | Yes | "e.g., IEEE, ACM, ACS" |
| `role` | Role/Grade | text | No | "Fellow, Senior Member, Member" |
| `year_start` | Since | text | Yes | — |
| `year_end` | Until | text | No | "Present" |

#### Editorial & Reviewing (`editorial`) — *Detailed only*

| Field Name | Label | Type | Required | Placeholder |
|-----------|-------|------|----------|-------------|
| `journal` | Journal/Conference | text | Yes | — |
| `role` | Role | text | Yes | "Reviewer, Associate Editor, Editorial Board Member" |
| `year_start` | Since | text | Yes | — |
| `year_end` | Until | text | No | "Present" |

---

## 6. PDF Rendering Details

### 6.1 Page Layout (All Templates)

- **Paper**: A4 (210 × 297 mm)
- **Auto page break**: at Y = 260mm
- **Margins**: Parsed from `style_config.margins` (e.g., "1in" → 25.4mm)

### 6.2 Personal Info Header (All Templates)

| Element | Font Size | Style | Alignment |
|---------|-----------|-------|-----------|
| Full Name | 22pt | Bold, CMUSerif | Centered |
| Rule | — | 0.3mm thin line | Full width |
| Title / Affiliation | 11pt | Normal | Centered |
| Address | 10pt | Normal | Centered |
| Email \| Phone | 10pt | Normal | Centered |
| Website \| ORCID | 10pt | Normal | Centered |

### 6.3 Section Headers

| Element | Font Size | Style | Color |
|---------|-----------|-------|-------|
| Section Title | 12pt | Bold, UPPERCASE | Template's `primaryColor` |
| Rule below | — | 0.25mm line | Template's `primaryColor` |

### 6.4 Entry Rendering by Section Type

#### Education
- **Line 1**: Bold degree (10.5pt) — right-aligned years (10pt)
- **Line 2**: Italic institution (10pt)
- **Line 3** (optional): "Thesis: ..." (9.5pt italic, indented)
- **Line 4** (optional): GPA (9.5pt, indented)

#### Experience
- **Line 1**: Bold position (10.5pt) — right-aligned years (10pt)
- **Line 2**: Italic organization + location (10pt)
- **Body** (optional): Description (9.5pt, indented, multi-line)

#### Publications
- Numbered list: `[1]`, `[2]`, etc.
- Format: Authors (Year). "Title." *Venue.* DOI: xxx
- Font: 9.5pt, hanging indent

#### Skills
- **Bold category** (10pt): comma-separated skills list
- Wraps naturally

#### Awards
- **Left**: Bold title — organization (10pt) | **Right**: Year
- Description below (9.5pt, indented)

#### References
- Bold name (10pt)
- Title, Affiliation (9.5pt italic)
- Email | Phone (9.5pt)

#### Research Interests
- Bold area (10pt)
- Description (9.5pt, multi-line, indented)

#### Projects
- Bold title (10.5pt) — years right-aligned
- Role, Organization, Amount (10pt italic)
- Description (9.5pt, indented)

#### Teaching
- Course + Code in parentheses (10.5pt) — years right-aligned
- Role, Institution, Level (10pt italic)
- Description (9.5pt, indented)

#### Supervision
- Student Name (Degree) (10.5pt) — years right-aligned
- Thesis title (9.5pt italic)
- Role | Status (9.5pt)

#### Grants
- Title (10.5pt) — years right-aligned
- Agency — Amount (10pt italic)
- Role | Status (9.5pt)

#### Conferences
- Title (10.5pt) — year right-aligned
- Conference, Location (Type) (10pt italic)

#### Certifications
- Title (10.5pt) — year right-aligned
- Issuer | ID | Expires (10pt italic)

#### Languages
- **Bold Language**: Proficiency (10pt, single line)

#### Professional Memberships
- Organization — Role (10.5pt) — years right-aligned

#### Editorial
- Journal/Conference (10.5pt) — years right-aligned
- Role (10pt italic)

---

## 7. Subscription & Feature Flags

### Plan Comparison

| Feature | Free | Pro ($1/mo) | Enterprise |
|---------|------|-------------|------------|
| Max CVs | 2 | 20 | Unlimited |
| Max Templates | 3 | Unlimited | Unlimited |
| Classic Template | ✅ | ✅ | ✅ |
| Modern Template | ✅ | ✅ | ✅ |
| Detailed Template | ✅ | ✅ | ✅ |
| **New Pro Templates** | ❌ | ✅ | ✅ |
| ORCID Import | ✅ | ✅ | ✅ |
| Google Scholar Import | ✅ | ✅ | ✅ |
| PDF Download | ✅ | ✅ | ✅ |
| Google Sign-in | ✅ | ✅ | ✅ |
| Custom Sections | ❌ | ✅ | ✅ |
| Priority PDF Generation | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Custom Branding | ❌ | ❌ | ✅ |

### Section Access by Plan

| Section | Free | Pro |
|---------|------|-----|
| personal_info | ✅ | ✅ |
| education | ✅ | ✅ |
| experience | ✅ | ✅ |
| publications | ✅ | ✅ |
| skills | ✅ | ✅ |
| awards | ✅ | ✅ |
| references | ✅ | ✅ |
| research_interests | ✅ | ✅ |
| projects | ✅ | ✅ |
| certifications | ✅ | ✅ |
| languages | ✅ | ✅ |
| professional_memberships | ✅ | ✅ |
| teaching | ❌ | ✅ |
| supervision | ❌ | ✅ |
| grants | ❌ | ✅ |
| conferences | ❌ | ✅ |
| editorial | ❌ | ✅ |

---

## 8. Database Schema (Key Tables)

### `templates`
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
name            VARCHAR(255) NOT NULL
slug            VARCHAR(100) UNIQUE NOT NULL
description     TEXT
latex_header    TEXT          -- Full LaTeX preamble (used for pdflatex path)
latex_footer    TEXT          -- LaTeX closing (used for pdflatex path)
style_config    JSON          -- {"primaryColor","fontFamily","fontSize","margins"}
is_premium      TINYINT(1) DEFAULT 0
is_active       TINYINT(1) DEFAULT 1
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `template_sections`
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
template_id     INT (FK → templates.id)
section_key     VARCHAR(100)   -- e.g., "education", "publications"
display_name    VARCHAR(255)   -- e.g., "Education", "Publications"
latex_code      TEXT           -- Mustache template: {{field}}, {{#entries}}...{{/entries}}
fields_schema   JSON           -- Array of field objects (see Section 5)
section_order   INT DEFAULT 0
is_required     TINYINT(1) DEFAULT 0
is_repeatable   TINYINT(1) DEFAULT 1
created_at      TIMESTAMP
```

### `cv_profiles`
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
user_id         INT (FK → users.id)
template_id     INT (FK → templates.id)
name            VARCHAR(255)
is_default      TINYINT(1) DEFAULT 0
personal_info   JSON           -- Stored as JSON in the profile
pdf_path        VARCHAR(500)
last_compiled_at TIMESTAMP
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `cv_sections`
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
profile_id      INT (FK → cv_profiles.id)
section_key     VARCHAR(100)
is_visible      TINYINT(1) DEFAULT 1
created_at      TIMESTAMP
```

### `cv_entries`
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
section_id      INT (FK → cv_sections.id)
user_entry_id   INT (FK → user_entries.id, nullable)
data            JSON           -- Flexible structure matching fields_schema
entry_order     INT DEFAULT 0
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `user_entries` (Master Copy)
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
user_id         INT (FK → users.id)
section_key     VARCHAR(100)
data            JSON
entry_order     INT DEFAULT 0
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `features` & `plan_features`
```sql
-- features
id              INT AUTO_INCREMENT PRIMARY KEY
feature_key     VARCHAR(100) UNIQUE
display_name    VARCHAR(255)
description     TEXT
category        VARCHAR(100)   -- "core", "templates", "sections"
sort_order      INT DEFAULT 0

-- plan_features
id              INT AUTO_INCREMENT PRIMARY KEY
plan            VARCHAR(50)    -- "free", "pro", "enterprise"
feature_key     VARCHAR(100)
is_enabled      TINYINT(1) DEFAULT 0
config_value    VARCHAR(255)   -- e.g., "2" for max_cvs on free plan
```

### `field_schema` JSON Format
```json
[
  {
    "name": "field_key",
    "label": "Display Label",
    "type": "text|email|textarea|url",
    "required": true,
    "placeholder": "Optional hint"
  }
]
```
> **Important**: Uses `"name"` key, NOT `"key"`.

---

## 9. UI & Editor Interface

### CV Editor Layout
- **Two-column**: Form panel (left, col-lg-7) + Live PDF preview (right, col-lg-5, sticky)
- **Tabs**: One tab per section (Personal, Education, Experience, etc.)
- **Entries**: Card-based with Add/Delete buttons; fields auto-generated from `fields_schema`
- **Field layout**: `text`/`email`/`url` → col-md-6 (two per row); `textarea` → col-12 (full width)
- **Autosave**: Status indicator transitions gold (saving) → green (saved)
- **Actions**: Compile PDF, Download PDF, Share, View LaTeX

### Template Gallery
- Responsive grid (3 columns on desktop)
- Each card: icon + name + description + Free/Premium badge
- "Preview" and "Use Template" buttons

### Template Preview Page
- Template name + description
- "Sections Included" list with field counts and required badges
- "Create CV with this Template" CTA

### CSS Variables
```css
--cs-primary: #0d6efd    /* Bootstrap blue */
--cs-navy: #1B2A4A
--cs-gold: #E8A817
--cs-body-bg: #F7F9FC
--cs-border: #D8E2EF
--cs-text: #1B2A4A
--cs-text-muted: #5A6A85
```

---

## 10. Shared CV / Public View

- Standalone HTML page (no app layout/nav)
- Open Graph + Twitter Card meta tags for social sharing
- Header bar: name, title, affiliation, Download PDF button
- Full-page PDF viewer via `<iframe>` (max-width 900px, centered)
- Font: Inter (system sans-serif)
- Button color: `#003366` (hover: `#002244`)

---

## 11. Design Brief for New Pro Templates

### What We Need

**3 new Pro-only templates** (IDs 4, 5, 6) with distinct visual identities that complement but don't duplicate the existing 3 free templates.

### Constraints

1. **Same rendering engine**: production CV PDFs are generated via xelatex. Design within the current controlled renderer capabilities:
   - Fonts available: Computer Modern Serif, Sans, Mono (bold, italic, bold-italic variants)
   - Colors: any hex color (converted to RGB)
   - Layout: single-column, top-to-bottom flow (no true multi-column or sidebar in PDF)
   - Elements: text, lines/rules, rectangles (filled/outlined)
   - No images, no gradients, no complex shapes in PDF output

2. **Style driven by `style_config` JSON**: Each template needs:
   ```json
   {
     "primaryColor": "#HEXCOLOR",
     "fontFamily": "font-name",
     "fontSize": "Xpt",
     "margins": "X.Xin"
   }
   ```

3. **Sections system**: New templates can use any combination of the 17 existing sections (see Section 5). They can also introduce NEW section types if needed (requires adding a new `fields_schema` and rendering logic).

4. **Must be Premium**: `is_premium = 1` in the `templates` table.

### Design Differentiation Opportunities

Even though the PDF engine is the same, visual differentiation can come from:

- **Color scheme**: Different primary colors, accent colors (can add secondary colors to `style_config`)
- **Typography choices**: serif vs sans-serif vs monospace dominance
- **Spacing & density**: Margins, line spacing, font sizes
- **Section header styles**: Different rule weights, positioning, text transforms (uppercase, small-caps)
- **Entry formatting**: Different emphasis patterns (bold vs italic), alignment, indentation
- **Personal info header**: Different layouts (centered vs left-aligned, different font size hierarchies)
- **Section selection**: Which sections are included and in what order
- **New style_config properties**: The rendering code can be extended to support new config keys — e.g., `secondaryColor`, `headerStyle`, `sectionDivider`, `nameSize`, etc.

### Suggested Template Concepts (Starting Points)

1. **Compact / Two-Page Max** — Minimal margins (0.6in), 9pt font, condensed spacing. For researchers who need everything on 2 pages. Color: teal/dark green.

2. **Executive / Leadership** — Large name, generous whitespace, emphasis on experience and grants. Color: charcoal/gold. For department heads, deans, senior PIs.

3. **Publication-Heavy / Research Portfolio** — Optimized for massive publication lists with categorization (journal articles, conference papers, book chapters, preprints). Color: deep purple/slate. For prolific researchers.

### What to Deliver

For each new template, please provide:

1. **Template metadata**: name, slug, description, style_config JSON
2. **Section list**: Which sections to include (from the existing 17 + any new ones), in what order
3. **Field schemas**: For any new sections (JSON format matching our existing pattern)
4. **Visual description**: How the PDF should look — header layout, section header style, entry formatting, spacing
5. **Sample rendering**: A mockup or detailed description of how a filled-in CV would appear
6. **Any new `style_config` properties** needed (we can extend the rendering code)

---

## Appendix A: Field Schema JSON Format

All field objects use this structure:
```json
{
  "name": "unique_field_key",
  "label": "Human-Readable Label",
  "type": "text|email|textarea|url",
  "required": true|false,
  "placeholder": "Optional hint text (shown in input)"
}
```

- `"name"` is the programmatic key (used in `data` JSON of entries)
- `"label"` is what the user sees in the form
- `"type"` determines the HTML input type and form layout
- `"required"` makes the field mandatory in the editor
- `"placeholder"` provides example/hint text

## Appendix B: Available Computer Modern Unicode Fonts

| Font | Variants | Usage |
|------|----------|-------|
| CMUSerif | Regular, Bold, Italic, BoldItalic | Classic/Detailed templates |
| CMUSans | Regular, Bold, Italic, BoldItalic | Modern template |
| CMUMono | Regular, Bold, Italic, BoldItalic | Code-like text (unused currently) |

These are the only fonts embedded in the FPDF setup. Adding new fonts requires converting TTF → FPDF format and registering them.

## Appendix C: Color Reference (Existing)

| Usage | Hex | RGB | Template |
|-------|-----|-----|----------|
| Classic Primary | `#003366` | (0, 51, 102) | Classic Academic |
| Modern Primary | `#0077B5` | (0, 119, 181) | Modern Professional |
| Detailed Primary | `#660000` | (102, 0, 0) | Detailed Academic |
| Modern Dark Text | `#333333` | (51, 51, 51) | Modern Professional |
| Share Button | `#003366` | (0, 51, 102) | Shared CV View |
| UI Primary | `#0d6efd` | (13, 110, 253) | Web Interface |
| UI Navy | `#1B2A4A` | (27, 42, 74) | Web Interface |
| UI Gold | `#E8A817` | (232, 168, 23) | Web Interface |
