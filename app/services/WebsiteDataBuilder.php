<?php
/**
 * WebsiteDataBuilder
 *
 * Assembles the read-only view-model for a user's public academic website from
 * the CENTRAL profile (users.personal_info + user_entries + verified
 * publications). Applies the website's section/field visibility settings so
 * sensitive details stay hidden unless the owner opts in.
 *
 * This is strictly read-only and never exposes another user's data: every query
 * is scoped to the website owner's user_id.
 */
class WebsiteDataBuilder
{
    /** Order in which sections appear on the public page. */
    private const SECTION_ORDER = [
        'research_interests', 'education', 'experience', 'teaching',
        'publications', 'projects', 'grants', 'conferences', 'supervision',
        'awards', 'skills', 'memberships', 'languages', 'references',
    ];

    private const SECTION_LABELS = [
        'research_interests' => 'Research Interests',
        'education'          => 'Education',
        'experience'         => 'Experience',
        'teaching'           => 'Teaching',
        'publications'       => 'Publications',
        'projects'           => 'Projects',
        'grants'             => 'Grants & Funding',
        'conferences'        => 'Conferences',
        'supervision'        => 'Supervision',
        'awards'             => 'Awards & Honours',
        'skills'             => 'Skills',
        'memberships'        => 'Professional Memberships',
        'languages'          => 'Languages',
        'references'         => 'References',
    ];

    private CVProfile $cvModel;

    public function __construct(?CVProfile $cvModel = null)
    {
        $this->cvModel = $cvModel ?? new CVProfile();
    }

    /**
     * @param array $website  Row from AcademicWebsite (decoded visibility maps).
     * @param array $user      Full user row (must include id, personal_info).
     * @return array view-model consumed by templates/website/public.php
     */
    public function build(array $website, array $user): array
    {
        $userId = (int) $user['id'];
        $sectionVisibility = is_array($website['section_visibility'] ?? null)
            ? $website['section_visibility']
            : AcademicWebsite::defaultSectionVisibility();
        $fieldVisibility = is_array($website['field_visibility'] ?? null)
            ? $website['field_visibility']
            : AcademicWebsite::defaultFieldVisibility();

        $personalInfo = $this->decodePersonalInfo($user);

        return [
            'personal'     => $this->buildPersonal($user, $personalInfo, $fieldVisibility),
            'summary'      => $this->buildSummary($userId, $sectionVisibility),
            'sections'     => $this->buildSections($userId, $sectionVisibility, $fieldVisibility),
            'publications' => $this->buildPublications($userId, $sectionVisibility),
            'download'     => $this->buildDownload($website, $userId, $sectionVisibility),
            'contact_enabled' => !empty($sectionVisibility['contact_form']),
            'stats'        => $this->buildStats($userId),
        ];
    }

    public function buildForPage(array $website, array $user, string $page): array
    {
        $full = $this->build($website, $user);

        switch ($page) {
            case 'publications':
                return [
                    'personal' => $full['personal'], 'summary' => '', 'sections' => [],
                    'publications' => $full['publications'],
                    'download' => $full['download'],
                    'contact_enabled' => false, 'stats' => $full['stats'],
                ];
            case 'teaching':
                $ts = array_filter($full['sections'], static fn($s) => in_array($s['key'] ?? '', ['teaching','supervision','education'], true));
                return [
                    'personal' => $full['personal'], 'sections' => array_values($ts),
                    'publications' => [], 'download' => $full['download'],
                    'contact_enabled' => false, 'stats' => $full['stats'],
                ];
            case 'cv':
                return [
                    'personal' => $full['personal'], 'summary' => '', 'sections' => [],
                    'publications' => [], 'download' => $full['download'],
                    'contact_enabled' => false, 'stats' => $full['stats'],
                ];
            case 'contact':
                return [
                    'personal' => $full['personal'], 'summary' => '', 'sections' => [],
                    'publications' => [], 'download' => $full['download'],
                    'contact_enabled' => $full['contact_enabled'], 'stats' => $full['stats'],
                ];
            default:
                $as = array_filter($full['sections'], static fn($s) => !in_array($s['key'] ?? '', ['teaching','supervision','education','publications'], true));
                return [
                    'personal' => $full['personal'], 'summary' => $full['summary'],
                    'sections' => array_values($as), 'publications' => [],
                    'download' => $full['download'], 'contact_enabled' => false,
                    'stats' => $full['stats'],
                ];
        }
    }

    private function buildStats(int $userId): array
    {
        return (new AcademicWebsite())->getStats($userId);
    }

    // -- Personal / hero -----------------------------------------------------

    private function decodePersonalInfo(array $user): array
    {
        $info = [];
        if (!empty($user['personal_info'])) {
            $decoded = is_array($user['personal_info'])
                ? $user['personal_info']
                : json_decode((string) $user['personal_info'], true);
            if (is_array($decoded)) {
                $info = $decoded;
            }
        }
        return $info;
    }

    private function buildPersonal(array $user, array $info, array $fieldVisibility): array
    {
        $get = static fn(string $key): string => trim((string) ($info[$key] ?? ''));
        $avatarUrl = trim((string) ($user['avatar_url'] ?? ''));

        $personal = [
            'full_name'      => $get('full_name'),
            'title'          => $get('title'),
            'affiliation'    => $get('affiliation'),
            'avatar_url'     => $avatarUrl,
            'location'       => '',
            'links'          => [],
            'email'          => '',
            'phone'          => '',
            'address'        => '',
        ];

        // Public-safe links are always shown when present.
        foreach ([
            'website'        => $get('website'),
            'linkedin'       => $get('linkedin'),
            'orcid'          => $get('orcid'),
            'google_scholar' => $get('google_scholar'),
        ] as $key => $value) {
            if ($value !== '') {
                $personal['links'][$key] = $value;
            }
        }

        // Sensitive fields gated behind explicit opt-in.
        if (!empty($fieldVisibility['show_email'])) {
            $personal['email'] = $get('email');
        }
        if (!empty($fieldVisibility['show_phone'])) {
            $personal['phone'] = $get('phone');
        }
        if (!empty($fieldVisibility['show_address'])) {
            $personal['address'] = $get('location') !== '' ? $get('location') : $get('address');
        } else {
            // Location is broad enough to display without being a full address;
            // keep it hidden too unless address opt-in is on, per spec.
            $personal['location'] = '';
        }

        return $personal;
    }

    private function buildSummary(int $userId, array $sectionVisibility): string
    {
        if (empty($sectionVisibility['academic_profile'])) {
            return '';
        }
        $entries = $this->cvModel->getUserEntries($userId, 'academic_profile');
        foreach ($entries as $entry) {
            $data = $entry['data'] ?? [];
            $summary = trim((string) ($data['summary'] ?? $data['description'] ?? ''));
            if ($summary !== '') {
                return $summary;
            }
        }
        return '';
    }

    // -- Repeatable sections -------------------------------------------------

    private function buildSections(int $userId, array $sectionVisibility, array $fieldVisibility): array
    {
        $all = $this->cvModel->getUserEntries($userId);
        $bySection = [];
        foreach ($all as $entry) {
            $key = (string) ($entry['section_key'] ?? '');
            if ($key === '') {
                continue;
            }
            $bySection[$key][] = is_array($entry['data'] ?? null) ? $entry['data'] : [];
        }

        $sections = [];
        foreach (self::SECTION_ORDER as $key) {
            // publications are rendered from the dedicated publications table.
            if ($key === 'publications') {
                continue;
            }
            if (empty($sectionVisibility[$key])) {
                continue;
            }
            if ($key === 'references' && empty($fieldVisibility['show_references'])) {
                continue;
            }
            $entries = $bySection[$key] ?? [];
            $entries = array_values(array_filter($entries, [$this, 'entryHasContent']));
            if (empty($entries)) {
                continue;
            }
            $sections[] = [
                'key'     => $key,
                'label'   => self::SECTION_LABELS[$key] ?? ucfirst(str_replace('_', ' ', $key)),
                'entries' => $entries,
            ];
        }
        return $sections;
    }

    private function entryHasContent(array $data): bool
    {
        foreach ($data as $value) {
            if (is_string($value) && trim($value) !== '') {
                return true;
            }
            if (is_numeric($value)) {
                return true;
            }
        }
        return false;
    }

    // -- Publications --------------------------------------------------------

    private function buildPublications(int $userId, array $sectionVisibility): array
    {
        if (empty($sectionVisibility['publications'])) {
            return [];
        }

        // Prefer the verified publications table (approval workflow).
        try {
            $verified = (new ProfileImportService())->getApprovedPublications($userId);
        } catch (Throwable $e) {
            $verified = [];
        }
        if (!empty($verified)) {
            return array_map(static function (array $p): array {
                return [
                    'title'   => trim((string) ($p['title'] ?? '')),
                    'authors' => trim((string) ($p['authors'] ?? '')),
                    'year'    => trim((string) ($p['year'] ?? '')),
                    'venue'   => trim((string) ($p['venue'] ?? '')),
                    'doi'     => trim((string) ($p['doi'] ?? '')),
                    'url'     => trim((string) ($p['url'] ?? '')),
                ];
            }, $verified);
        }

        // Fall back to central master entries.
        $entries = $this->cvModel->getUserEntries($userId, 'publications');
        $out = [];
        foreach ($entries as $entry) {
            $d = $entry['data'] ?? [];
            if (!$this->entryHasContent($d)) {
                continue;
            }
            $out[] = [
                'title'   => trim((string) ($d['title'] ?? '')),
                'authors' => trim((string) ($d['authors'] ?? '')),
                'year'    => trim((string) ($d['year'] ?? '')),
                'venue'   => trim((string) ($d['venue'] ?? '')),
                'doi'     => trim((string) ($d['doi'] ?? '')),
                'url'     => trim((string) ($d['url'] ?? '')),
            ];
        }
        return $out;
    }

    // -- Download CV ---------------------------------------------------------

    private function buildDownload(array $website, int $userId, array $sectionVisibility): array
    {
        $result = ['available' => false, 'cv_id' => 0];
        if (empty($sectionVisibility['download_cv'])) {
            return $result;
        }

        $cv = $this->resolveSourceCv($website, $userId);
        if ($cv && !empty($cv['pdf_path']) && is_file($cv['pdf_path'])) {
            $result['available'] = true;
            $result['cv_id'] = (int) $cv['id'];
        }
        return $result;
    }

    private function resolveSourceCv(array $website, int $userId): ?array
    {
        $sourceId = (int) ($website['source_cv_id'] ?? 0);
        if ($sourceId > 0) {
            $cv = $this->cvModel->findById($sourceId);
            if ($cv && (int) $cv['user_id'] === $userId) {
                return $cv;
            }
        }
        // Fall back to the most-recently updated compiled CV.
        $cvs = $this->cvModel->findByUser($userId);
        foreach ($cvs as $cv) {
            if (!empty($cv['pdf_path']) && is_file($cv['pdf_path'])) {
                return $cv;
            }
        }
        return null;
    }
}
