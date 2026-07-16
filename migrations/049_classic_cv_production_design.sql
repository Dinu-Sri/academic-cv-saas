-- Classic Academic (id=1) production design defaults
-- Aligns DB style_config with LatexRenderer Classic design brief:
-- black print-safe heads, A4, 1in margins, page numbers on.
-- Idempotent: overwrites classic style_config to the approved production set.

UPDATE templates
SET
  name = 'Classic Academic',
  slug = 'classic',
  description = 'Traditional single-column academic CV: bold section heads with rule, A4, page numbers, print-safe contrast. Production layout is LatexRenderer (not DB latex fragments).',
  style_config = JSON_OBJECT(
    'primaryColor', '#000000',
    'fontFamily', 'lmodern',
    'fontSize', '11pt',
    'margins', '1in',
    'pageSize', 'a4',
    'showPageNumbers', true,
    'showOrcid', true,
    'showLinkedIn', true,
    'showWebsite', true,
    'showScholar', false,
    'showFullUrl', false,
    'headerLayout', 'centered_classic',
    'sectionHeaderStyle', 'bold_rule',
    'dateAlignment', 'right_column',
    'designVersion', 'classic-v6'
  ),
  is_active = 1
WHERE id = 1;
