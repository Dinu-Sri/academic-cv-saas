-- Migration 032: Field-level guidance (placeholders + help_text) for editor UX
--
-- Updates fields_schema JSON for the standard section_keys across ALL templates
-- (free + Pro) so users see consistent placeholders and tooltip-style hints.
--
-- The editor renders:
--   - "placeholder" inside the input (greyed-out example)
--   - "help_text" below the input (small muted line)
--
-- Idempotent: pure UPDATE statements; re-running just rewrites the same JSON.
-- Safe to deploy hot — fields_schema is read at editor render time, not cached.

-- ===== personal_info =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','full_name','label','Full Name','type','text','required',true,
                    'placeholder','Jane A. Smith','help_text','Use the name you want shown on the CV header — no titles like Dr.'),
        JSON_OBJECT('name','title','label','Title','type','text',
                    'placeholder','Postdoctoral Researcher','help_text','Your professional title, not honorific. e.g. "Lecturer", "PhD Candidate", "Senior Engineer".'),
        JSON_OBJECT('name','affiliation','label','Affiliation','type','text',
                    'placeholder','Department of Physics, MIT','help_text','Department + institution. Country is optional here.'),
        JSON_OBJECT('name','email','label','Email','type','email','required',true,
                    'placeholder','j.smith@university.edu'),
        JSON_OBJECT('name','phone','label','Phone','type','text',
                    'placeholder','+60 11 5126 1516','help_text','Include country code with +.'),
        JSON_OBJECT('name','address','label','Address','type','textarea',
                    'placeholder','Cambridge, MA, USA','help_text','Optional. City + country is usually enough for an academic CV.'),
        JSON_OBJECT('name','website','label','Website','type','url',
                    'placeholder','https://janesmith.com','help_text','Personal site or institutional profile page.'),
        JSON_OBJECT('name','orcid','label','ORCID ID','type','text',
                    'placeholder','0000-0002-1825-0097','help_text','16-digit ID from orcid.org — paste the digits only, no URL.')
       )
 WHERE section_key = 'personal_info';

-- ===== education =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','degree','label','Degree','type','text','required',true,
                    'placeholder','Ph.D. in Applied Social Sciences','help_text','Full degree name including specialization.'),
        JSON_OBJECT('name','institution','label','Institution','type','text','required',true,
                    'placeholder','University Sultan Zainal Abidin (UniSZA)'),
        JSON_OBJECT('name','location','label','Location','type','text',
                    'placeholder','Terengganu, Malaysia','help_text','City, country.'),
        JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true,
                    'placeholder','2022','help_text','4-digit year only.'),
        JSON_OBJECT('name','year_end','label','End Year','type','text',
                    'placeholder','2026 or Present','help_text','Use "Present" if ongoing.'),
        JSON_OBJECT('name','thesis','label','Thesis Title','type','text',
                    'placeholder','Developing the role of family and community in young people''s wellbeing','help_text','Just the title — do not include the word "Thesis:".'),
        JSON_OBJECT('name','gpa','label','GPA / CGPA','type','text',
                    'placeholder','3.85/4.0','help_text','Optional. Include the scale.')
       )
 WHERE section_key = 'education';

-- ===== experience =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','position','label','Position','type','text','required',true,
                    'placeholder','Graduate Research Mentor','help_text','Your job title or role.'),
        JSON_OBJECT('name','organization','label','Organization','type','text','required',true,
                    'placeholder','University Sultan Zainal Abidin (UniSZA)'),
        JSON_OBJECT('name','location','label','Location','type','text',
                    'placeholder','Terengganu, Malaysia'),
        JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true,
                    'placeholder','2022'),
        JSON_OBJECT('name','year_end','label','End Year','type','text',
                    'placeholder','Present','help_text','Use "Present" if ongoing.'),
        JSON_OBJECT('name','description','label','Description','type','textarea',
                    'placeholder','• Mentored 3 Master''s students in SPSS and NVivo data analysis.\n• Guided thesis development for postgraduate research projects.\n• Reviewed manuscripts for methodological rigor.',
                    'help_text','Use bullet points starting with "•" or "-". One achievement per line, action verb first. Keep each line under 200 characters.')
       )
 WHERE section_key = 'experience';

-- ===== publications =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','title','label','Title','type','text','required',true,
                    'placeholder','Parenting as a factor in adolescent cognitive development'),
        JSON_OBJECT('name','authors','label','Authors','type','text','required',true,
                    'placeholder','Omah, O. N., & Abu Bakar, N.','help_text','Use your preferred citation style (APA, MLA, etc.). Separate authors with commas, last author with "&".'),
        JSON_OBJECT('name','year','label','Year','type','text','required',true,
                    'placeholder','2024','help_text','4-digit publication year.'),
        JSON_OBJECT('name','venue','label','Journal / Conference','type','text',
                    'placeholder','Journal of Innovations, 12(3), 45–67','help_text','Include volume, issue, and page range when available.'),
        JSON_OBJECT('name','doi','label','DOI','type','text',
                    'placeholder','10.1234/jinnov.2024.001','help_text','DOI digits only — do NOT include https://doi.org/.'),
        JSON_OBJECT('name','url','label','URL','type','url',
                    'placeholder','https://doi.org/10.1234/jinnov.2024.001')
       )
 WHERE section_key = 'publications';

-- ===== skills =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','category','label','Category','type','text','required',true,
                    'placeholder','Data Analysis','help_text','One category per entry. Examples: "Programming Languages", "Research Methods", "Languages".'),
        JSON_OBJECT('name','skills','label','Skills','type','text','required',true,
                    'placeholder','SPSS, NVivo, Excel, R','help_text','Comma-separated list. Keep it short — group related skills under one category.')
       )
 WHERE section_key = 'skills';

-- ===== awards =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','title','label','Award Title','type','text','required',true,
                    'placeholder','Dean''s List','help_text','Just the award name, no qualifiers like "I received...".'),
        JSON_OBJECT('name','organization','label','Awarded by','type','text',
                    'placeholder','University Sultan Zainal Abidin'),
        JSON_OBJECT('name','year','label','Year','type','text','required',true,
                    'placeholder','2022'),
        JSON_OBJECT('name','description','label','Description','type','textarea',
                    'placeholder','Recognized for top 5% academic performance across the cohort.',
                    'help_text','Optional. One sentence about why you received it.')
       )
 WHERE section_key = 'awards';

-- ===== references =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','name','label','Name','type','text','required',true,
                    'placeholder','Prof. Dr. Norsuhaily Abu Bakar','help_text','Full name with academic title (Prof., Dr., etc.).'),
        JSON_OBJECT('name','title','label','Position','type','text',
                    'placeholder','Postgraduate Supervisor','help_text','Their role — NOT their honorific (that goes in Name).'),
        JSON_OBJECT('name','affiliation','label','Affiliation','type','text',
                    'placeholder','University Sultan Zainal Abidin (UniSZA), Malaysia'),
        JSON_OBJECT('name','email','label','Email','type','email',
                    'placeholder','norsuhaily@unisza.edu.my'),
        JSON_OBJECT('name','phone','label','Phone','type','text',
                    'placeholder','+60 19 914 4568')
       )
 WHERE section_key = 'references';

-- ===== research_interests =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','area','label','Research Area','type','text','required',true,
                    'placeholder','SME Development & Dynamic Capabilities Theory','help_text','Single area or topic. Use commas to group related sub-topics.'),
        JSON_OBJECT('name','description','label','Description','type','textarea',
                    'placeholder','Focus on growth and sustainability of small and medium enterprises in emerging economies, with emphasis on ICT adoption and inclusive community development.',
                    'help_text','1–2 sentences explaining your work in this area. Avoid run-on paragraphs.')
       )
 WHERE section_key = 'research_interests';

-- ===== projects =====
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT('name','title','label','Project Title','type','text','required',true,
                    'placeholder','Akudigbo Family Ties — Community Hall Initiative'),
        JSON_OBJECT('name','organization','label','Organization / Role','type','text',
                    'placeholder','Project Lead, AFT'),
        JSON_OBJECT('name','year_start','label','Start Year','type','text',
                    'placeholder','2020'),
        JSON_OBJECT('name','year_end','label','End Year','type','text',
                    'placeholder','Present'),
        JSON_OBJECT('name','description','label','Description','type','textarea',
                    'placeholder','• Designed youth-focused economic empowerment strategies.\n• Coordinated monthly community gatherings.\n• Delivered community hall project in April 2026.',
                    'help_text','Use bullet points starting with "•" or "-". One outcome per line.')
       )
 WHERE section_key = 'projects';
