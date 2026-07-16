-- Permanent system knowledge: academic website design + Scholar Pages product rules
-- Retrieved via retrieve_knowledge (namespaces academic_website_guidance, cvscholar_product)

INSERT INTO "knowledge_documents" ("id", "workspaceId", "namespace", "visibility", "sourceType", "title", "version", "status", "sourceUri", "checksum", "metadataJson")
VALUES
  (
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    'system',
    'curated',
    'Academic Website Design and Structure Guidance',
    '1.0.0',
    'active',
    'cvscholar://guidance/academic-website-design',
    'academic-website-design-research-v1',
    '{"seededBy":"202607160004_academic_website_knowledge","sources":["Rice Graduate Studies","Academic Designer","UC Press author toolkit","NN/g mobile nav","Baymard line length","WCAG readability","faculty website practice"]}'
  ),
  (
    'knowledge_cvscholar_scholar_pages_v1',
    NULL,
    'cvscholar_product',
    'system',
    'curated',
    'CVScholar Scholar Pages Website Production Rules',
    '1.0.0',
    'active',
    'cvscholar://product/scholar-pages-website',
    'scholar-pages-product-rules-v1',
    '{"seededBy":"202607160004_academic_website_knowledge","templateKey":"scholar-pages","legacyTemplateKey":"modern-scholar"}'
  )
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "version" = EXCLUDED."version",
  "status" = EXCLUDED."status",
  "checksum" = EXCLUDED."checksum",
  "metadataJson" = EXCLUDED."metadataJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "knowledge_chunks" ("id", "documentId", "workspaceId", "namespace", "chunkOrder", "title", "content", "tokenEstimate", "metadataJson")
VALUES
  (
    'knowledge_academic_website_design_v1_chunk_1',
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    1,
    'Purpose of a personal academic website',
    'A personal academic website is a portable professional identity for scholars, not a startup marketing landing page. Typical visitors include search committees, collaborators, prospective students, journalists, and the scholar themselves. The site should make it easy to answer: who is this person, what do they research, what have they published, how do I contact them, and where is the CV. Prefer verified facts, ORCID and Google Scholar links, and institutional affiliation. Do not invent metrics, citation counts, impact factors, or publications.',
    110,
    '{"kind":"purpose"}'
  ),
  (
    'knowledge_academic_website_design_v1_chunk_2',
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    2,
    'Recommended multipage information architecture',
    'For content-rich academic profiles, multipage structure is preferred over a single endless scroll. Default pages: Home (orient in under 30 seconds), About (bio and education), Research (agenda and projects), Publications (reverse chronological list with venue, year, DOI or URL), Teaching (courses and narrative), CV (structured career record), Contact (form and or email). Home should summarize and link deeper rather than dump the entire CV. Hide navigation items for empty or disabled pages. Unique URLs per topic improve sharing, SEO, and committee bookmarking.',
    120,
    '{"kind":"information_architecture"}'
  ),
  (
    'knowledge_academic_website_design_v1_chunk_3',
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    3,
    'Header, footer, and navigation norms',
    'Every page should share a clear header and footer. Header: scholar name as brand linking home, plus primary navigation. Desktop can show a horizontal nav when there are roughly seven or fewer top-level items. Mobile should use a labeled Menu control opening an accessible panel; hamburger-only icons are less discoverable. Mark the active page with more than color alone. Footer: name, affiliation, scholarly profile links when visible, subtle product mark, no advertising trackers. Contact must not be footer-only when a Contact page or form is enabled.',
    115,
    '{"kind":"chrome"}'
  ),
  (
    'knowledge_academic_website_design_v1_chunk_4',
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    4,
    'Evidence-based readability and mobile UX',
    'Readable web body text typically uses about 45 to 75 characters per line (at most around 80 for accessibility), base size of at least 16px, and line-height near 1.5 to 1.65. Do not stretch prose across full wide desktops. Prioritize content over chrome on small screens. Interactive targets should be large enough for touch (about 44px minimum). Support keyboard focus, skip links, one H1 per page, and visible focus rings. Low-contrast gray body text and decorative neon themes harm academic credibility and accessibility.',
    115,
    '{"kind":"readability_mobile"}'
  ),
  (
    'knowledge_academic_website_design_v1_chunk_5',
    'knowledge_academic_website_design_v1',
    NULL,
    'academic_website_guidance',
    5,
    'Anti-patterns for academic personal sites',
    'Avoid corporate resume skill bars, confetti, autoplay video heroes, stock marketing collages, dark neon SaaS aesthetics, nav links to empty sections, and reproducing the full CV on the homepage. Do not require visitors to hunt for contact. Do not track visitors with advertising pixels on privacy-safe academic sites. Prefer calm typography, one accent color, professional headshot optional, and scannable publication lists.',
    90,
    '{"kind":"anti_patterns"}'
  ),
  (
    'knowledge_cvscholar_scholar_pages_v1_chunk_1',
    'knowledge_cvscholar_scholar_pages_v1',
    NULL,
    'cvscholar_product',
    1,
    'Scholar Pages is the multipage website template',
    'CVScholar Scholar Pages is the named academic website template (templateKey scholar-pages; legacy modern-scholar accepted during transition). It is multipage with shared header and footer. Production lives on the rewrite stack only: draft workspace, snapshot publish, public host username.cvscholar.com. PHP templates are not the production path for rewrite public sites. Preview and public render must use the same Scholar Pages components so published snapshots match what authors previewed.',
    100,
    '{"kind":"product_template"}'
  ),
  (
    'knowledge_cvscholar_scholar_pages_v1_chunk_2',
    'knowledge_cvscholar_scholar_pages_v1',
    NULL,
    'cvscholar_product',
    2,
    'Scholar Pages page keys and public paths',
    'Default Scholar Pages navigation keys: home, about, research, publications, teaching, cv, contact. On the scholar subdomain, home is / and other pages are /{key}. Snapshots store relative nav hrefs. SEO builds per-page titles. Field visibility controls email, location, ORCID, Google Scholar, and LinkedIn. Contact forms use product spam protections (Turnstile and rate limits when configured). Analytics are privacy-safe page-path view counters only.',
    95,
    '{"kind":"routes_and_privacy"}'
  ),
  (
    'knowledge_cvscholar_scholar_pages_v1_chunk_3',
    'knowledge_cvscholar_scholar_pages_v1',
    NULL,
    'cvscholar_product',
    3,
    'Agent behavior for website design help',
    'When users ask to improve their academic website, use retrieve_knowledge for academic_website_guidance and cvscholar_product Scholar Pages rules. Recommend multipage structure, clearer home summary, research narrative, and complete publication metadata with DOIs when available. Do not invent content. Do not propose startup landing-page redesigns, skill meters, or auto-publish. Website writes go through proposals (propose_website_update) and publish stays user-controlled (prepare_website_publish). Prefer Scholar Pages visual restraint: academic navy accent, readable measure, sticky header, mobile Menu, global footer.',
    110,
    '{"kind":"agent_behavior"}'
  )
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "tokenEstimate" = EXCLUDED."tokenEstimate",
  "metadataJson" = EXCLUDED."metadataJson";
