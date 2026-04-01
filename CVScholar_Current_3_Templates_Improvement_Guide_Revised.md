# CVScholar — Current 3 Templates Improvement Guide (Revised)

> Purpose: detailed product, content, and layout specification for improving CVScholar’s **existing three templates** so they remain simple, credible, and highly useful for **students, early-career academics, postgraduates, lecturers, researchers, and institutions that prefer straightforward academic CV formats**.

---

## Table of Contents

1. Purpose of the current three templates
2. What the current templates already do well
3. Main gaps in the current templates
4. Core principles for improving the current templates
5. Shared design standards for all three templates
6. Shared information architecture and section policy
7. Recommended field-level improvements
8. Template 1 — Classic Academic (improved spec)
9. Template 2 — Modern Professional (improved spec)
10. Template 3 — Detailed Academic (improved spec)
11. Rendering and layout refinements needed in the engine
12. Regional and audience-specific notes
13. Font strategy
14. Implementation priority list
15. Final recommendations

---

## 1) Purpose of the current three templates

These three templates should continue to serve users who want:

- a **serious academic CV quickly**
- a format that feels **credible and university-appropriate**
- a structure that is **easier to fill** than a full faculty dossier
- a design that works well for **students, junior researchers, lecturers, assistant lecturers, postgraduate applicants, scholarship applicants, and practical university contexts**

The main goal is not to make these templates visually luxurious. The goal is to make them:

- clear
- efficient
- readable
- academically respectable
- useful for weaker and mid-strength profiles

### Recommended positioning of the three current templates

| Template | Main role | Best for |
|---|---|---|
| Classic Academic | safest academic default | students, lecturers, MPhil/PhD applicants, university jobs |
| Modern Professional | cleaner interdisciplinary layout | postdocs, tech researchers, interdisciplinary academics, innovation applicants |
| Detailed Academic | fuller academic record format | users with more research, publications, projects, awards, service, and broader academic output |

A user should immediately feel:

- **Classic** = safest and most traditional
- **Modern** = cleaner and more contemporary
- **Detailed** = fuller and denser without becoming messy

---

## 2) What the current templates already do well

Your current system already has a very good starting base.

### Strengths to preserve

1. **Academic-first section structure**  
   Personal information, education, publications, research interests, projects, awards, references, and academic records already align better with university needs than generic resume builders.

2. **Simple repeatable data model**  
   The repeatable-section approach is practical and scalable. It is especially suitable for SaaS form entry.

3. **Conservative visual base**  
   The current templates avoid over-decorated corporate resume styling. This is important and should be preserved.

4. **Good foundation for typography-driven design**  
   The system already leans toward a scholarly presentation style rather than a trendy startup resume style.

5. **Usable for broad academic levels**  
   Even now, the templates can serve students, junior staff, and standard academic applicants with minor improvements.

---

## 3) Main gaps in the current templates

### 3.1 The three templates are not yet distinct enough in use

At the moment, the difference between templates appears to depend heavily on style settings such as colors, margins, and font configuration. Users should feel clearer practical differences in:

- section emphasis
- density
- page rhythm
- entry hierarchy
- typical audience fit

### 3.2 The section model is good, but some fields are still too generic

The templates need better support for:

- thesis details in education
- better structured publication entries
- stronger research project entries
- academic profile links such as ORCID and Google Scholar
- stronger optional fields for early-career users

### 3.3 Weaker-profile users can still look too empty

Many students and junior lecturers may not have:

- grants
- editorial roles
- many publications
- major invited talks

So the system should support fields that help such users still look strong and credible, such as:

- final-year projects
- thesis title
- technical skills
- certifications and training
- professional memberships
- language proficiency
- workshops and conferences attended or presented
- academic summary/profile

### 3.4 References should not dominate the document

References can remain supported, but in most modern academic CV contexts they should be:

- optional
- near the end
- easy to hide

They should not be treated as a mandatory core section.

### 3.5 Header efficiency can be improved substantially

The current centered or vertically heavy structure uses more page space than necessary. The first page of an academic CV must establish identity quickly and save space for academic content.

---

## 4) Core principles for improving the current templates

### Principle 1 — Simplicity must look intentional

Simple does not mean plain or weak. The templates should feel:

- quiet
- organized
- academic
- composed

### Principle 2 — Help weaker profiles look complete

A strong builder should still make a user with:

- one degree
- one thesis or project
- a few certifications
- one publication or no publications
- a short skills list

look polished and respectable.

### Principle 3 — Avoid unnecessary regional defaults

The default academic structure should **not** force:

- photo
- date of birth
- religion
- marital status
- national ID number
- gender

These may be optional regional extras if needed later, but should never be default requirements.

### Principle 4 — The templates should differ by use case, not only by color

Users must immediately understand what each template is for.

### Principle 5 — Typography and hierarchy matter more than decoration

Academic CVs become strong through:

- good spacing
- consistent dates
- clear headings
- readable entry blocks
- disciplined typography

not through icons, colored boxes, and decoration.

---

## 5) Shared design standards for all three templates

These standards should apply across the entire current template family.

### 5.1 Header standards

### Recommended header structure

**Line 1:** Full name  
**Line 2:** Current role / academic stage / specialization  
**Line 3:** Institution / department / affiliation  
**Line 4:** City, Country | email | phone | website | ORCID | Google Scholar

### Header rules

- keep the name visually prominent, but not oversized
- reduce wasted vertical space
- keep line lengths controlled
- show only useful contact fields
- use short display labels instead of full raw URLs
- do not repeat institution names unnecessarily
- avoid decorative banners or oversized boxes

### 5.2 Section title rules

Section titles should be:

- formal
- consistent
- readable
- clearly separated from body entries

Recommended style:

- title case or restrained small caps
- thin rule under section title if needed
- consistent spacing above and below headings
- avoid overly dark or thick separators

### 5.3 Entry structure rules

Every major entry should follow the same information hierarchy.

Recommended pattern:

**Primary item** ........................................ **Date**  
Secondary line for institution / venue / department / role  
Optional detail line for thesis title, specialization, achievement, or description

This pattern should be used consistently for:

- education
- appointments
- awards
- projects
- conferences
- grants
- training

### 5.4 White space rules

Even dense templates need breathing room.

Recommended behavior:

- more space before section headings than between entries
- compact but readable body spacing
- avoid large visual gaps caused by inconsistent description handling
- support graceful page breaks for long sections

### 5.5 Date formatting rules

Use one date style across the whole document.

Recommended default styles:

- `2023–Present`
- `2020–2024`
- `Expected 2027`

Avoid mixing:

- `2022-24`
- `Jan 2023 - Current`
- `2023 to present`

### 5.6 Publication formatting rules

Publications must be one of the strongest visual sections.

Minimum standard:

- hanging indent
- consistent punctuation
- optional bolding of the CV owner’s name
- DOI shown cleanly when useful
- avoid long messy raw URLs unless essential
- maintain consistent style across journal, conference, chapter, and other outputs

### 5.7 Page numbering

All templates should support:

- page number in footer
- optional “Last updated” footer text
- consistent footer placement

### 5.8 Link presentation

Do not show long raw URLs when shorter labels will work better.

Examples:

- `ORCID: 0000-0002-...`
- `Google Scholar`
- `Portfolio`
- `Personal Website`

---

## 6) Shared information architecture and section policy

## 6.1 Core sections that all templates should support

These should remain available across the current system:

1. Personal Information
2. Education
3. Academic Appointments / Experience
4. Publications
5. Research Interests
6. Projects / Research Projects
7. Awards and Honors
8. Skills
9. Certifications / Training
10. Conferences / Presentations
11. Professional Memberships
12. Languages
13. References
14. Academic Profile / Summary

## 6.2 Recommended default section family

For stronger real-world usability, the current templates should support the following improved family clearly:

1. Personal Information
2. Academic Profile / Summary
3. Education
4. Academic Appointments / Experience
5. Research Interests
6. Publications
7. Research Projects / Projects
8. Awards and Honors
9. Conferences / Presentations
10. Certifications / Training
11. Skills
12. Professional Memberships
13. Languages
14. References

This order can vary slightly by template, but these sections are enough for most real academic users.

## 6.3 Important optional additions

The following should be supported because they greatly improve CV quality for students and early-career users:

- thesis title in education
- final-year project title
- expected graduation date
- GPA / classification / rank / honors
- workshop participation
- short academic summary
- project collaborators
- project outputs such as paper, prototype, report, dataset, software, or patent

### Academic Profile / Summary

This should be a short 2–4 line section that helps weaker or interdisciplinary profiles look more mature.

Good use cases:

- student applying for postgraduate admission
- lecturer with teaching and research mix
- interdisciplinary researcher with technical and academic outputs

It should never become a long corporate objective statement.

---

## 7) Recommended field-level improvements

## 7.1 Personal Information — improve substantially

Recommended fields:

| Field | Status | Notes |
|---|---|---|
| `full_name` | Required | must support initials and long academic names |
| `preferred_name` | Optional | useful for publications or international use |
| `current_title` | Optional | Lecturer, Research Assistant, PhD Candidate, etc. |
| `department` | Optional | especially important for academics |
| `institution` | Optional | main affiliation |
| `city_country` | Optional | preferred over full mailing address |
| `email` | Recommended | primary contact |
| `phone` | Optional | region dependent |
| `website` | Optional | short label in final CV |
| `orcid` | Recommended for researchers | very important in academic use |
| `google_scholar` | Recommended | highly useful |
| `linkedin` | Optional | more suitable in Modern template |
| `researcher_id` / `scopus_id` | Optional | useful for some fields |
|

Rules:

- do not require full postal address by default
- do not require photo
- support multiple academic profile links cleanly
- make ORCID and Google Scholar first-class academic identity fields

## 7.2 Education — needs stronger academic detail

Recommended fields:

| Field | Notes |
|---|---|
| degree title | full academic degree name |
| specialization / subject | major field |
| institution | university / faculty |
| location | optional |
| date range | required |
| expected completion | optional |
| GPA / class / honors | optional but important |
| thesis / dissertation title | highly recommended |
| supervisor(s) | optional |
| thesis keywords / focus | optional |
| short description | optional |

Education entries should be able to carry more academic weight, especially for users with limited experience.

## 7.3 Academic Appointments / Experience

Recommended fields:

| Field | Notes |
|---|---|
| role title | Lecturer, Demonstrator, Research Assistant, Intern, etc. |
| institution / organization | required |
| department / unit | optional |
| location | optional |
| date range | required |
| nature of role | academic, research, teaching, technical, industry |
| short achievements / responsibilities | optional |

Use academic wording wherever appropriate.

## 7.4 Publications — most important field upgrades

Recommended publication fields:

| Field | Notes |
|---|---|
| title | required |
| authors | required |
| user-name emphasis flag | optional |
| publication type | journal, conference, chapter, book, patent, preprint, report |
| venue | journal / conference / publisher |
| year | required |
| volume / issue / pages | optional |
| DOI | optional but valuable |
| URL | optional |
| indexing / status | optional |
| notes | optional |

Recommended improvements:

- support categories cleanly
- support hanging indent output
- support bolding of user name
- allow short status tags like `Accepted`, `Under Review`, `In Press`, `Published`
- prevent inconsistent punctuation across entries

## 7.5 Skills — make them academically useful

Skills should be grouped in academically relevant ways, such as:

- Laboratory Techniques
- Programming
- Data Analysis
- Design / CAD
- Instrumentation
- Teaching Tools
- Languages / Writing Tools

Avoid presenting skills as a generic corporate keyword cloud.

## 7.6 Awards and Honors

Recommended fields:

- award title
- awarding body
- year
- level or significance
- optional short note

Examples of useful notes:

- university-level
- national-level
- competitive merit award

## 7.7 Conferences / Presentations

Recommended fields:

- presentation title
- event name
- role type: oral, poster, invited talk, participant
- date / year
- location
- optional co-authors
- optional notes

This section is especially useful for users with fewer formal publications.

## 7.8 Research Interests — improve usability

Research interests should support:

- comma-separated display
- optional grouped themes
- optional order by strength or priority

Avoid long narrative paragraphs.

## 7.9 Projects — make them more research-aware

Recommended project fields:

| Field | Notes |
|---|---|
| title | required |
| role | PI, co-investigator, student researcher, team member, developer |
| institution / lab / organization | optional |
| date range | required |
| collaborators | optional |
| summary | short academic-style description |
| outputs | optional: paper, report, prototype, software, patent, dataset |
| tools / methods | optional |

Projects should not look like generic job tasks. They should read like real academic or research initiatives.

## 7.10 Certifications / Training

This section is highly valuable for early-career users.

Recommended fields:

- title
- provider
- year / date
- credential ID or URL if relevant
- short note

This section should support:

- research training
- software certifications
- laboratory safety training
- pedagogy training
- workshop certificates

## 7.11 Languages

Recommended fields:

- language
- level / proficiency
- optional note

Use standard expressions such as:

- Native
- Fluent
- Professional Working Proficiency
- Intermediate
- Basic

## 7.12 Professional Memberships

Keep simple but useful.

Recommended fields:

- organization name
- grade or level if relevant
- year joined
- role if relevant

## 7.13 Academic Profile / Summary

Recommended constraints:

- 2–4 lines
- no generic motivational language
- focus on field, strengths, and academic direction

Good example pattern:

> Lecturer and researcher in materials and nano science with interests in applied instrumentation, functional coatings, and academic curriculum development. Experienced in research supervision, university teaching, and interdisciplinary technical projects.

## 7.14 References

Recommended fields:

- full name
- title
- institution
- relationship
- email
- phone (optional)

References should be easy to:

- hide entirely
- show only upon request
- limit to 2–3 entries

---

## 8) Template 1 — Classic Academic (improved spec)

## 8.1 Main purpose

This should remain the safest academic default.

Best for:

- students
- assistant lecturers
- lecturers
- MPhil / PhD applicants
- scholarship applicants
- academic job applicants
- universities that prefer conservative CV styling

## 8.2 Visual character

This template should feel:

- traditional
- clean
- balanced
- formal
- unmistakably academic

### Design rules

- one-column layout
- left-aligned header
- restrained serif typography
- thin section separators
- right-aligned dates
- moderate white space
- no heavy color blocks
- no sidebar

## 8.3 Recommended section order

1. Personal Information
2. Academic Profile / Summary (optional)
3. Education
4. Academic Appointments / Experience
5. Research Interests
6. Publications
7. Research Projects
8. Awards and Honors
9. Conferences / Presentations
10. Certifications / Training
11. Skills
12. Professional Memberships (optional)
13. Languages (optional)
14. References (optional)

## 8.4 What to improve specifically

- make header more compact
- improve date alignment
- improve education entry depth with thesis support
- make project entries more formal and research-oriented
- make publication section more elegant with hanging indents
- reduce visual heaviness of centered layout habits

## 8.5 Best user profile

This template is the best “safe choice” when the user is unsure.

It should be the default recommendation for most users.

---

## 9) Template 2 — Modern Professional (improved spec)

## 9.1 Main purpose

This should be a cleaner, more contemporary academic template for users whose work sits between academia, research, innovation, and professional practice.

Best for:

- interdisciplinary academics
- postdocs
- engineering and technology researchers
- industry-collaborative academics
- research center applicants
- users applying to labs, NGOs, think tanks, innovation programs, or R&D environments

## 9.2 Visual character

This template should feel:

- modern
- disciplined
- clean
- slightly lighter than Classic
- professional without becoming corporate

### Design rules

- one-column layout
- stronger visual spacing rhythm
- cleaner sans-serif body style or academic sans
- limited accent color allowed
- still avoid strong sidebars unless true structural support exists in renderer
- slightly more emphasis on profile, skills, and projects than Classic

## 9.3 Recommended section order

1. Personal Information
2. Academic Profile / Summary
3. Research Interests
4. Education
5. Academic Appointments / Experience
6. Projects
7. Publications
8. Skills
9. Certifications / Training
10. Conferences / Presentations
11. Professional Memberships
12. Languages
13. Awards and Honors
14. References (optional)

## 9.4 What to improve specifically

- make profile section slightly more visible
- let project entries carry more importance than in Classic
- present links and academic IDs more cleanly
- make skills layout feel structured, not keyword-heavy
- keep publication formatting rigorous even in a modern layout

## 9.5 What not to do

- do not make it look like a startup designer resume
- do not use icon-heavy personal branding
- do not use a real sidebar unless the engine genuinely supports it well
- do not overuse color

---

## 10) Template 3 — Detailed Academic (improved spec)

## 10.1 Main purpose

This should be the fullest of the current three templates.

Best for:

- users with several publications
- researchers with broader activity records
- lecturers with multiple academic roles
- users applying for scholarships, fellowships, internal academic review, or research-heavy opportunities
- users who simply need a richer CV without moving into a full promotion dossier format

## 10.2 Visual character

This template should feel:

- dense but readable
- serious
- efficient
- highly structured
- publication-friendly

### Design rules

- one-column layout
- compact spacing with strong consistency
- serif or classic academic typography
- very controlled section gaps
- best publication formatting among the three templates
- strongest support for long multi-page documents

## 10.3 Recommended section order

1. Personal Information
2. Academic Profile / Summary (optional)
3. Education
4. Academic Appointments / Experience
5. Research Interests
6. Publications
7. Research Projects
8. Conferences / Presentations
9. Awards and Honors
10. Certifications / Training
11. Skills
12. Professional Memberships
13. Languages
14. References (optional)

## 10.4 What to improve specifically

- improve density without overcrowding
- make publications highly scannable
- improve page-break logic for long sections
- support stronger grouping and ordering rules
- allow richer education, project, and conference entries
- keep structure more disciplined than the other two templates

## 10.5 Positioning note

This template should feel fuller and more authoritative than the other two, but still remain accessible and easy to fill.

---

## 11) Rendering and layout refinements needed in the engine

A few renderer-level improvements will significantly improve all three templates.

## 11.1 True right-aligned date handling

Do not approximate dates with manual spaces. Use proper measured text alignment or dedicated date-column handling.

## 11.2 Consistent hanging indent support for publications

This is essential for academic credibility.

## 11.3 Better section spacing control

Spacing before headings, after headings, and between entries should be controlled by template rules, not left to ad hoc rendering differences.

## 11.4 Smarter page-break logic

Prevent awkward breaks such as:

- heading at bottom of page with no content
- single orphan line of an entry
- broken publication entries in ugly places

## 11.5 Multi-link compact contact rendering

Support compressed header rendering such as:

`Colombo, Sri Lanka | email@example.com | ORCID | Google Scholar | Website`

## 11.6 Template-specific default ordering

Each template should define a strong default order, but still allow user customization.

## 11.7 Graceful empty-section suppression

If a user has no items in a section, the final CV should simply omit that section without breaking spacing.

## 11.8 Better long-text handling

Descriptions for projects, theses, and conference notes should wrap cleanly and maintain indentation consistency.

## 11.9 URL shortening and display labels

Long URLs should render as labels wherever possible.

## 11.10 Optional owner-name highlighting in publications

Useful for academic multi-author lists.

---

## 12) Regional and audience-specific notes

### 12.1 Global-safe defaults

All three templates should stay globally safe by default:

- no photo required
- no date of birth required
- no marital status required
- no religion required
- no national identity number required

### 12.2 Asian and lower-resource institutional relevance

These templates will be especially valuable if they support users who often need to present a respectable record with limited output.

That means emphasizing:

- thesis details
- final-year projects
- workshops and training
- academic service
- skills and tools
- conference participation
- language proficiency

### 12.3 Early-career friendliness

The builder should not assume that publications are the only source of academic strength.

For many real users, the strongest sections may be:

- education
- thesis
- projects
- training
- awards
- teaching-related experience

---

## 13) Font strategy

Yes — keeping a classic LaTeX-style academic identity is a good choice.

### Recommendation

Use the classic academic font voice as the main visual identity for:

- Classic Academic
- Detailed Academic

For Modern Professional, use a cleaner academic sans or a more neutral modern typeface while keeping the overall tone scholarly.

### Font direction

- **Classic Academic:** classic serif / LaTeX-like academic voice
- **Modern Professional:** clean academic sans
- **Detailed Academic:** refined serif with strong readability in long documents

### Important note

Do not rely on the font alone to create quality. The font helps, but the real strength comes from:

- hierarchy
- spacing
- date alignment
- entry structure
- publication formatting

---

## 14) Implementation priority list

### Priority 1 — high-impact improvements

1. improve header layout efficiency
2. improve date alignment consistency
3. support thesis title in education
4. improve publication hanging indents
5. improve section spacing consistency
6. add academic profile / summary section
7. improve project structure with outputs and collaborators
8. improve page-break control
9. add ORCID and Google Scholar as first-class fields
10. suppress empty sections gracefully

### Priority 2 — template distinction improvements

11. clarify default audience for each template
12. strengthen Classic as conservative academic default
13. strengthen Modern as cleaner interdisciplinary template
14. strengthen Detailed as fuller academic template
15. improve skills grouping logic
16. improve conference / presentation section richness
17. improve certification / training section quality
18. improve link display labels

### Priority 3 — refinement improvements

19. improve optional language section
20. improve reference visibility logic
21. improve footer options
22. improve long entry wrapping
23. improve microcopy and placeholders in the editor
24. improve consistency of punctuation in publications

---

## 15) Final recommendations

### Improve the current templates rather than replacing them

Your existing three templates are already a good foundation. They do not need to be discarded. They need to be made:

- clearer in purpose
- stronger in hierarchy
- more helpful for real academic users
- more distinct in practical use

### The most important content improvements are

- thesis support in education
- better structured publications
- stronger research project entries
- academic profile / summary
- ORCID and Google Scholar fields
- better support for workshops, training, and conference participation

### The most important design improvements are

- compact left-aligned header
- right-aligned dates
- disciplined section spacing
- better publication formatting
- stronger page-break behavior
- clearer template differentiation

### Font recommendation

Yes — continue using the classic academic LaTeX-style identity as a core visual direction. It suits the product well.

### Final conclusion

If CVScholar improves the current three templates with:

- stronger hierarchy
- better academic fields
- clearer section ordering
- improved renderer behavior
- more useful early-career support
- disciplined typography

then these templates will become significantly more valuable for a very large real-world user base, while still remaining simple and easy to use.
