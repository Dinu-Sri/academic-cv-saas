<?php
/**
 * Builds the canonical CV import schema from active template section schemas.
 */
class CvSectionSchemaService
{
    private const FALLBACK_FIELDS = [
        'personal_info' => ['full_name', 'title', 'affiliation', 'email', 'phone', 'location', 'address', 'website', 'linkedin', 'orcid', 'google_scholar'],
        'academic_profile' => ['summary'],
        'education' => ['degree', 'institution', 'location', 'year_start', 'year_end', 'thesis', 'supervisor', 'gpa', 'description'],
        'experience' => ['position', 'organization', 'department', 'location', 'year_start', 'year_end', 'description'],
        'academic_appointments' => ['position', 'institution', 'department', 'location', 'year_start', 'year_end', 'description'],
        'research_experience' => ['position', 'institution', 'project', 'supervisor', 'location', 'year_start', 'year_end', 'description'],
        'research_interests' => ['area', 'description'],
        'publications' => ['title', 'authors', 'year', 'publication_type', 'venue', 'volume_issue_pages', 'doi', 'url', 'status'],
        'grants' => ['title', 'agency', 'grant_number', 'role', 'amount', 'year_start', 'year_end', 'status', 'collaborators', 'description'],
        'patents' => ['title', 'inventors', 'patent_number', 'jurisdiction', 'status', 'year', 'url'],
        'invited_talks' => ['title', 'event', 'institution', 'location', 'date', 'year', 'description'],
        'conferences' => ['title', 'conference', 'location', 'date', 'year', 'presentation_type', 'description'],
        'teaching' => ['course', 'code', 'level', 'institution', 'role', 'year_start', 'year_end', 'description'],
        'supervision' => ['student_name', 'degree', 'institution', 'role', 'year_start', 'year_end', 'status', 'topic'],
        'academic_service' => ['role', 'committee', 'institution', 'year_start', 'year_end', 'description'],
        'editorial' => ['role', 'journal', 'publisher', 'year_start', 'year_end', 'description'],
        'projects' => ['title', 'role', 'organization', 'year_start', 'year_end', 'description', 'collaborators', 'outputs'],
        'awards' => ['title', 'organization', 'year', 'level', 'description'],
        'certifications' => ['title', 'issuer', 'organization', 'year', 'credential_id', 'description'],
        'skills' => ['category', 'skills'],
        'languages' => ['language', 'proficiency'],
        'professional_memberships' => ['organization', 'role', 'year_start', 'year_end'],
        'references' => ['name', 'title', 'institution', 'affiliation', 'email', 'phone', 'relationship'],
        'declaration' => ['statement', 'place', 'date', 'signature_name'],
    ];

    private const LABELS = [
        'personal_info' => 'Personal Information',
        'academic_profile' => 'Academic Profile',
        'academic_appointments' => 'Academic Appointments',
        'research_experience' => 'Research Experience',
        'research_interests' => 'Research Interests',
        'publications' => 'Publications',
        'grants' => 'Grants and Funding',
        'patents' => 'Patents',
        'invited_talks' => 'Invited Talks',
        'conferences' => 'Conference Presentations',
        'teaching' => 'Teaching Experience',
        'supervision' => 'Student Supervision',
        'academic_service' => 'Academic Service',
        'editorial' => 'Editorial and Reviewing',
        'professional_memberships' => 'Professional Memberships',
        'declaration' => 'Declaration',
    ];

    private const FIELD_ALIASES = [
        'personal_info' => ['orcid_id' => 'orcid', 'google_scholar_id' => 'google_scholar', 'scholar' => 'google_scholar'],
        'education' => ['school' => 'institution', 'college' => 'institution', 'university' => 'institution'],
        'experience' => ['institution' => 'organization', 'company' => 'organization', 'employer' => 'organization', 'role' => 'position'],
        'academic_appointments' => ['organization' => 'institution', 'role' => 'position'],
        'research_experience' => ['organization' => 'institution', 'role' => 'position'],
        'publications' => ['journal' => 'venue', 'conference' => 'venue', 'type' => 'publication_type', 'pages' => 'volume_issue_pages'],
        'grants' => ['organization' => 'agency', 'funder' => 'agency', 'year' => 'year_start'],
        'invited_talks' => ['organization' => 'institution'],
        'conferences' => ['event' => 'conference', 'type' => 'presentation_type'],
        'teaching' => ['year' => 'year_start', 'organization' => 'institution'],
        'certifications' => ['organization' => 'issuer'],
        'professional_memberships' => ['year' => 'year_start'],
        'references' => ['organization' => 'institution', 'affiliation' => 'institution'],
    ];

    private const HEADING_ALIASES = [
        'academic_profile' => ['profile', 'summary', 'professional summary', 'about', 'biography'],
        'education' => ['education', 'academic qualifications', 'educational qualifications'],
        'experience' => ['experience', 'work experience', 'employment', 'professional experience'],
        'academic_appointments' => ['appointments', 'academic appointments', 'faculty appointments'],
        'research_experience' => ['research experience', 'research positions', 'research roles'],
        'research_interests' => ['research interests', 'research areas', 'areas of expertise'],
        'publications' => ['publications', 'selected publications', 'journal articles', 'research publications'],
        'grants' => ['grants', 'funding', 'research funding', 'funded projects'],
        'patents' => ['patents', 'intellectual property', 'patent applications', 'inventions'],
        'invited_talks' => ['invited talks', 'keynotes', 'invited lectures', 'seminars'],
        'conferences' => ['conferences', 'conference presentations', 'presentations'],
        'teaching' => ['teaching', 'teaching experience', 'courses taught'],
        'supervision' => ['supervision', 'student supervision', 'thesis supervision'],
        'academic_service' => ['academic service', 'service', 'committee service'],
        'editorial' => ['editorial', 'reviewing', 'journal reviewing', 'editorial service'],
        'projects' => ['projects', 'research projects', 'selected projects'],
        'awards' => ['awards', 'honors', 'honours', 'scholarships'],
        'certifications' => ['certifications', 'certificates', 'licenses'],
        'skills' => ['skills', 'technical skills', 'competencies'],
        'languages' => ['languages', 'language proficiency'],
        'professional_memberships' => ['memberships', 'professional memberships', 'affiliations'],
        'references' => ['references', 'referees'],
        'declaration' => ['declaration', 'signature', 'certification statement'],
    ];

    public function getRegistry(): array
    {
        $registry = $this->fallbackRegistry();

        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->query(
                "SELECT ts.section_key, ts.display_name, ts.fields_schema
                 FROM template_sections ts
                 JOIN templates t ON t.id = ts.template_id
                 WHERE t.is_active = 1
                 ORDER BY ts.section_order ASC, ts.id ASC"
            );

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $sectionKey = (string) ($row['section_key'] ?? '');
                if ($sectionKey === '') {
                    continue;
                }

                $registry[$sectionKey] ??= $this->emptySection($sectionKey);
                $displayName = trim((string) ($row['display_name'] ?? ''));
                if ($displayName !== '') {
                    $registry[$sectionKey]['label'] = $displayName;
                }

                $fields = json_decode((string) ($row['fields_schema'] ?? '[]'), true);
                if (!is_array($fields)) {
                    continue;
                }

                foreach ($fields as $field) {
                    if (!is_array($field)) {
                        continue;
                    }
                    $name = trim((string) ($field['name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $registry[$sectionKey]['fields'][$name] = [
                        'name' => $name,
                        'label' => trim((string) ($field['label'] ?? $name)),
                        'type' => trim((string) ($field['type'] ?? 'text')),
                        'required' => !empty($field['required']),
                    ];
                }
            }
        } catch (Throwable $e) {
            error_log('CvSectionSchemaService registry fallback: ' . $e->getMessage());
        }

        foreach ($registry as $sectionKey => &$section) {
            $section['fields'] = array_values($section['fields']);
            $section['aliases'] = self::HEADING_ALIASES[$sectionKey] ?? [];
            $section['field_aliases'] = self::FIELD_ALIASES[$sectionKey] ?? [];
            $section['example'] = $this->exampleFor($sectionKey);
            $section['feature_key'] = $sectionKey === 'personal_info' ? '' : 'section_' . $sectionKey;
        }
        unset($section);

        return $registry;
    }

    public function getSectionKeys(bool $includePersonalInfo = false): array
    {
        $keys = array_keys($this->getRegistry());
        if (!$includePersonalInfo) {
            $keys = array_values(array_filter($keys, static fn($key) => $key !== 'personal_info'));
        }
        return $keys;
    }

    public function getFieldNames(string $sectionKey): array
    {
        $section = $this->getRegistry()[$sectionKey] ?? null;
        if (!$section) {
            return [];
        }
        return array_values(array_filter(array_map(static fn($field) => (string) ($field['name'] ?? ''), $section['fields'])));
    }

    public function getFieldAliases(string $sectionKey): array
    {
        $section = $this->getRegistry()[$sectionKey] ?? null;
        return is_array($section) ? ($section['field_aliases'] ?? []) : [];
    }

    public function getPromptContract(): array
    {
        $contract = [];
        foreach ($this->getRegistry() as $sectionKey => $section) {
            $fieldNames = array_values(array_filter(array_map(static fn($field) => (string) ($field['name'] ?? ''), $section['fields'])));
            $contract[$sectionKey] = [
                'label' => $section['label'],
                'aliases' => $section['aliases'],
                'fields' => $fieldNames,
                'field_aliases' => $section['field_aliases'],
                'example' => $section['example'],
            ];
        }
        return $contract;
    }

    public function getJsonShape(): array
    {
        $shape = ['personal_info' => []];
        foreach ($this->getFieldNames('personal_info') as $field) {
            $shape['personal_info'][$field] = '';
        }

        foreach ($this->getSectionKeys(false) as $sectionKey) {
            $entry = [];
            foreach ($this->getFieldNames($sectionKey) as $field) {
                $entry[$field] = '';
            }
            $shape[$sectionKey] = [$entry];
        }
        $shape['unmapped_items'] = [['heading' => '', 'content' => '', 'reason' => '']];
        $shape['mapping_warnings'] = [];
        return $shape;
    }

    private function fallbackRegistry(): array
    {
        $registry = [];
        foreach (self::FALLBACK_FIELDS as $sectionKey => $fields) {
            $registry[$sectionKey] = $this->emptySection($sectionKey);
            foreach ($fields as $field) {
                $registry[$sectionKey]['fields'][$field] = [
                    'name' => $field,
                    'label' => ucwords(str_replace('_', ' ', $field)),
                    'type' => 'text',
                    'required' => false,
                ];
            }
        }
        return $registry;
    }

    private function emptySection(string $sectionKey): array
    {
        return [
            'key' => $sectionKey,
            'label' => self::LABELS[$sectionKey] ?? ucwords(str_replace('_', ' ', $sectionKey)),
            'fields' => [],
            'aliases' => [],
            'field_aliases' => [],
            'example' => [],
            'feature_key' => '',
        ];
    }

    private function exampleFor(string $sectionKey): array
    {
        $examples = [
            'personal_info' => ['full_name' => 'Dr. Asha Perera', 'title' => 'Senior Lecturer', 'affiliation' => 'University of Colombo', 'email' => 'asha.perera@example.edu', 'orcid' => '0000-0002-1825-0097'],
            'academic_profile' => ['summary' => 'Computational biologist studying machine learning methods for genomic medicine and reproducible clinical decision support.'],
            'education' => ['degree' => 'Ph.D. in Computer Science', 'institution' => 'University of Melbourne', 'location' => 'Melbourne, Australia', 'year_start' => '2016', 'year_end' => '2020', 'thesis' => 'Deep Learning for Biomedical Sequence Analysis', 'supervisor' => 'Prof. Jane Smith'],
            'experience' => ['position' => 'Senior Lecturer', 'organization' => 'University of Colombo', 'department' => 'Department of Computer Science', 'year_start' => '2022', 'year_end' => 'Present', 'description' => 'Teach machine learning and supervise postgraduate research.'],
            'academic_appointments' => ['position' => 'Assistant Professor', 'institution' => 'National University of Singapore', 'department' => 'School of Computing', 'year_start' => '2020', 'year_end' => '2022'],
            'research_experience' => ['position' => 'Postdoctoral Research Fellow', 'institution' => 'Oxford Big Data Institute', 'project' => 'Clinical AI safety evaluation', 'year_start' => '2020', 'year_end' => '2022'],
            'research_interests' => ['area' => 'Biomedical AI', 'description' => 'Interpretable machine learning for clinical genomics and public health surveillance.'],
            'publications' => ['title' => 'Attention models for clinical sequence classification', 'authors' => 'Perera A.; Smith J.', 'year' => '2023', 'publication_type' => 'Journal Article', 'venue' => 'Journal of Biomedical Informatics', 'doi' => '10.1234/example'],
            'grants' => ['title' => 'AI Methods for Regional Disease Surveillance', 'agency' => 'National Science Foundation', 'grant_number' => 'NSF-234567', 'role' => 'Principal Investigator', 'amount' => 'USD 120,000', 'year_start' => '2024', 'year_end' => '2026', 'status' => 'Active'],
            'patents' => ['title' => 'System and Method for Automated Crop Disease Detection', 'inventors' => 'Asha Perera; Kamal Silva', 'patent_number' => 'US 11,234,567', 'jurisdiction' => 'United States', 'status' => 'Granted', 'year' => '2022', 'url' => 'https://patents.example/11234567'],
            'invited_talks' => ['title' => 'Trustworthy AI for Clinical Genomics', 'event' => 'International Bioinformatics Symposium', 'institution' => 'University of Tokyo', 'location' => 'Tokyo, Japan', 'year' => '2024'],
            'conferences' => ['title' => 'A transformer model for variant prioritization', 'conference' => 'ISMB', 'location' => 'Lyon, France', 'year' => '2023', 'presentation_type' => 'Oral Presentation'],
            'teaching' => ['course' => 'Machine Learning', 'code' => 'CS4050', 'level' => 'Undergraduate', 'institution' => 'University of Colombo', 'role' => 'Lecturer', 'year_start' => '2022', 'year_end' => 'Present'],
            'supervision' => ['student_name' => 'Nimali Fernando', 'degree' => 'M.Sc.', 'institution' => 'University of Colombo', 'role' => 'Main Supervisor', 'year_start' => '2023', 'year_end' => 'Present', 'status' => 'In progress', 'topic' => 'Deep learning for satellite image classification'],
            'academic_service' => ['role' => 'Member', 'committee' => 'Faculty Research Ethics Committee', 'institution' => 'University of Colombo', 'year_start' => '2022', 'year_end' => 'Present'],
            'editorial' => ['role' => 'Reviewer', 'journal' => 'IEEE Transactions on Medical Imaging', 'publisher' => 'IEEE', 'year_start' => '2021', 'year_end' => 'Present'],
            'projects' => ['title' => 'Open Clinical NLP Toolkit', 'role' => 'Project Lead', 'organization' => 'University of Colombo', 'year_start' => '2021', 'year_end' => '2023', 'description' => 'Built reusable NLP components for hospital discharge summaries.'],
            'awards' => ['title' => 'Early Career Researcher Award', 'organization' => 'Sri Lanka Association for AI', 'year' => '2023', 'level' => 'National'],
            'certifications' => ['title' => 'Clinical Data Science Certificate', 'issuer' => 'Coursera', 'year' => '2021', 'credential_id' => 'ABC-123'],
            'skills' => ['category' => 'Programming', 'skills' => 'Python, R, SQL, MATLAB'],
            'languages' => ['language' => 'English', 'proficiency' => 'Fluent'],
            'professional_memberships' => ['organization' => 'Association for Computing Machinery', 'role' => 'Member', 'year_start' => '2019', 'year_end' => 'Present'],
            'references' => ['name' => 'Prof. Jane Smith', 'title' => 'Professor of Computer Science', 'institution' => 'University of Melbourne', 'email' => 'jane.smith@example.edu', 'relationship' => 'Ph.D. supervisor'],
            'declaration' => ['statement' => 'I certify that the information provided is accurate to the best of my knowledge.', 'place' => 'Colombo', 'date' => '2026-05-14', 'signature_name' => 'Asha Perera'],
        ];

        return $examples[$sectionKey] ?? [];
    }
}