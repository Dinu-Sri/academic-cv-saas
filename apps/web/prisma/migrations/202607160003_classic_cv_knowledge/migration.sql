-- Permanent system knowledge: academic CV design + Classic template production rules
-- Retrieved via retrieve_knowledge (namespaces academic_cv_guidance, cvscholar_product)

INSERT INTO "knowledge_documents" ("id", "workspaceId", "namespace", "visibility", "sourceType", "title", "version", "status", "sourceUri", "checksum", "metadataJson")
VALUES
  (
    'knowledge_academic_cv_design_v1',
    NULL,
    'academic_cv_guidance',
    'system',
    'curated',
    'Academic CV Design and Structure Guidance',
    '1.0.0',
    'active',
    'cvscholar://guidance/academic-cv-design',
    'classic-cv-design-research-v1',
    '{"seededBy":"202607160003_classic_cv_knowledge","sources":["Penn faculty CV","Dr Karen CV rules","MIT CAPD","Oxford Careers","PMC medical CV"]}'
  ),
  (
    'knowledge_cvscholar_classic_pdf_v1',
    NULL,
    'cvscholar_product',
    'system',
    'curated',
    'CVScholar Classic PDF Production Rules',
    '1.0.0',
    'active',
    'cvscholar://product/classic-pdf-renderer',
    'classic-pdf-product-rules-v1',
    '{"seededBy":"202607160003_classic_cv_knowledge"}'
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
    'knowledge_academic_cv_design_v1_chunk_1',
    'knowledge_academic_cv_design_v1',
    NULL,
    'academic_cv_guidance',
    1,
    'Respected academic CV layout principles',
    'Highly respected academic CVs use a single-column layout, reverse chronological order within sections, dates on the right, bold entry titles on the left, consistent serif typography (about 11-12pt body), roughly 1 inch margins, and clear section headings. Avoid corporate resume designs with photos, skill bars, multi-color sidebars, or dual columns. Multi-page is normal; include page numbers. Italics are for journals, book titles, and organization lines—not decoration. Hierarchy should come from bold/italic/regular weight more than light gray color, so the CV remains readable in black-and-white print.',
    120,
    '{"kind":"layout_principles"}'
  ),
  (
    'knowledge_academic_cv_design_v1_chunk_2',
    'knowledge_academic_cv_design_v1',
    NULL,
    'academic_cv_guidance',
    2,
    'Recommended academic section order',
    'A strong US faculty-style CV often follows: identity header (name, title, affiliation, contact including ORCID when available); short profile or research summary; education; academic appointments; research or professional experience; teaching; supervision; grants and fellowships; projects; awards; conference presentations and invited talks; editorial or service; memberships; skills and languages; publications (often substantial); references near the end; declaration last if required by locale. Emphasize what the target role values (research-first vs teaching-first) by ordering and depth, not by decorative design. References should list referee name, rank/title, affiliation, relationship, and contact details when provided.',
    115,
    '{"kind":"section_order"}'
  ),
  (
    'knowledge_academic_cv_design_v1_chunk_3',
    'knowledge_academic_cv_design_v1',
    NULL,
    'academic_cv_guidance',
    3,
    'Content quality guidance for academic entries',
    'Prefer verified, specific evidence over vague claims. Publications need authors, year, title, venue, and DOI or URL when available. Teaching should name course, role, level, and institution. Grants should include agency, role (PI/Co-PI), years, and amount when known. Supervision should name the student, degree, thesis or topic, role, and status. Avoid inventing metrics, citations, impact factors, or awards. When data is missing, recommend the user add verified facts rather than fabricating content. Long descriptions should stay concise; one or two focused paragraphs beat unfocused essays.',
    105,
    '{"kind":"content_quality"}'
  ),
  (
    'knowledge_academic_cv_design_v1_chunk_4',
    'knowledge_academic_cv_design_v1',
    NULL,
    'academic_cv_guidance',
    4,
    'Regional and audience notes',
    'US faculty search CVs are often longer and airier with explicit section labels. European formal CVs may be denser. Do not force photos, date of birth, marital status, or nationality into global defaults. Grant biosketches (NIH, NSF, ERC) are short constrained formats separate from a full academic CV. For teaching-focused roles, elevate teaching and supervision; for research roles, elevate publications, grants, and research narrative.',
    85,
    '{"kind":"audience"}'
  ),
  (
    'knowledge_cvscholar_classic_pdf_v1_chunk_1',
    'knowledge_cvscholar_classic_pdf_v1',
    NULL,
    'cvscholar_product',
    1,
    'Classic PDF is LatexRenderer production path',
    'CVScholar production Classic PDF is generated by PHP LatexRenderer with xelatex. It does not use DB latex_header/latex_footer fragments for layout. Data flows: profile personal_info and sections through CvDataNormalizer, then LatexRenderer buildDocument, then xelatex two-pass compile. Local design previews use the same classes so design and live stay identical. Edge-case handling (long text, URLs, page breaks, HTML strip, page numbers, B&W-safe contrast) runs automatically on every compile.',
    95,
    '{"kind":"architecture"}'
  ),
  (
    'knowledge_cvscholar_classic_pdf_v1_chunk_2',
    'knowledge_cvscholar_classic_pdf_v1',
    NULL,
    'cvscholar_product',
    2,
    'Classic template visual rules',
    'Classic Academic template uses A4, about 1 inch margins, 11pt Latin Modern Roman, black section headings with a thin rule and a small gap under the heading, bold entry titles with dates right-aligned, italic organization lines near black for print, and footer page numbers as Surname · n/N. Supervision entries should show student name, degree, role, institution, and thesis. Professional memberships show organization bold with dates aligned and role as subtitle. References and declaration are ordered late. Empty sections are omitted.',
    100,
    '{"kind":"classic_visual"}'
  ),
  (
    'knowledge_cvscholar_classic_pdf_v1_chunk_3',
    'knowledge_cvscholar_classic_pdf_v1',
    NULL,
    'cvscholar_product',
    3,
    'Agent behavior for Classic CV help',
    'When users ask to improve a Classic CV, review saved profile and section data only. Suggest stronger evidence and clearer structure. Do not invent publications, grants, or dates. Do not propose corporate resume redesigns with photos or skill meters for Classic. If layout issues are mentioned (overflow, long URLs, page breaks), explain that the production renderer auto-wraps, shortens URL display, keeps entries together when short, and page-breaks long descriptions safely. Writes to profile still require proposals and user approval.',
    95,
    '{"kind":"agent_behavior"}'
  ),
  (
    'knowledge_academic_cv_guidance_v1_chunk_3',
    'knowledge_academic_cv_guidance_v1',
    NULL,
    'academic_cv_guidance',
    3,
    'References and declaration placement',
    'In full academic CVs, put detailed references near the end unless the call asks for references on request only. Each referee entry should include name, academic rank or title, affiliation, relationship to the candidate when helpful, and contact email or phone. If a declaration or attestation is required, place it after references with a clear statement, date, and signature line. Never invent referee contacts.',
    75,
    '{"kind":"end_matter"}'
  ),
  (
    'knowledge_cvscholar_product_v1_chunk_2',
    'knowledge_cvscholar_product_v1',
    NULL,
    'cvscholar_product',
    2,
    'PDF edge-case automation',
    'CVScholar automatically normalizes CV fields before PDF compile: strip HTML, collapse whitespace, soft-cap extreme lengths, normalize Present/Ongoing years, escape LaTeX specials, shorten long URL display while keeping full href targets, prefer DOI over raw URL when both exist, scale oversized names, limit contact chips, keep section headings with following content, and use print-safe dark secondary text. Agents should not claim the user must manually fix these mechanical layout issues unless a render error is reported.',
    90,
    '{"kind":"pdf_automation"}'
  )
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "tokenEstimate" = EXCLUDED."tokenEstimate",
  "chunkOrder" = EXCLUDED."chunkOrder",
  "metadataJson" = EXCLUDED."metadataJson";
