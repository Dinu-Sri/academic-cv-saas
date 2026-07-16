<?php

class DemoCvDataFactory
{
    /**
     * Offline classic (id=1) demo payload when MySQL is unavailable.
     * Uses the same entry fixtures as buildForTemplate() for template 1.
     */
    public function buildClassicOffline(): array
    {
        $sections = [
            ['section_key' => 'academic_profile', 'display_name' => 'Profile', 'section_order' => 1],
            ['section_key' => 'research_interests', 'display_name' => 'Research Interests', 'section_order' => 2],
            ['section_key' => 'education', 'display_name' => 'Education', 'section_order' => 3],
            ['section_key' => 'experience', 'display_name' => 'Professional Experience', 'section_order' => 4],
            ['section_key' => 'publications', 'display_name' => 'Publications', 'section_order' => 5],
            ['section_key' => 'teaching', 'display_name' => 'Teaching', 'section_order' => 6],
            ['section_key' => 'grants', 'display_name' => 'Grants & Funding', 'section_order' => 7],
            ['section_key' => 'awards', 'display_name' => 'Awards', 'section_order' => 8],
            ['section_key' => 'conferences', 'display_name' => 'Conferences', 'section_order' => 9],
            ['section_key' => 'professional_memberships', 'display_name' => 'Professional Memberships', 'section_order' => 10],
        ];
        return $this->buildForTemplate(1, $sections);
    }

    /** Classic template style_config seed (matches migrations/002 defaults + production black heads). */
    public static function classicStyleConfig(): array
    {
        return [
            'primaryColor' => '#000000',
            'fontFamily' => 'lmodern',
            'fontSize' => '11pt',
            'margins' => '1in',
            'pageSize' => 'a4',
        ];
    }

    public function buildForTemplate(int $templateId, array $templateSections): array
    {
        usort($templateSections, static fn($a, $b) => (int) ($a['section_order'] ?? 99) <=> (int) ($b['section_order'] ?? 99));

        $sections = [];
        foreach ($templateSections as $section) {
            $key = (string) ($section['section_key'] ?? '');
            if ($key === '' || $key === 'personal_info') {
                continue;
            }

            $entries = $this->entriesFor($key, $templateId);
            if (empty($entries)) {
                continue;
            }

            $sections[] = [
                'section_key' => $key,
                'display_name' => $section['display_name'] ?? $this->titleize($key),
                'section_order' => (int) ($section['section_order'] ?? 99),
                'is_visible' => 1,
                'entries' => array_map(static fn($data) => ['data' => $data], $entries),
            ];
        }

        return [
            'personal_info' => $this->personalInfo($templateId),
            'sections' => $sections,
        ];
    }

    private function personalInfo(int $templateId): array
    {
        $profiles = [
            1 => ['full_name' => 'Dr. Maya Fernando', 'title' => 'Lecturer in Environmental Data Science'],
            2 => ['full_name' => 'Dr. Arjun Patel', 'title' => 'Research Scientist, Computational Biology'],
            3 => ['full_name' => 'Professor Elena Kovacs', 'title' => 'Professor of Comparative Literature'],
            4 => ['full_name' => 'Associate Professor Daniel Brooks', 'title' => 'Associate Professor of Public Policy'],
            5 => ['full_name' => 'Dr. Sofia Andersson', 'title' => 'Senior Lecturer in Applied Economics'],
            6 => ['full_name' => 'Professor Leila Haddad', 'title' => 'Chair in Biomedical Engineering'],
        ];

        $base = $profiles[$templateId] ?? $profiles[1];
        return array_merge($base, [
            'affiliation' => 'Northbridge University',
            'current_title' => $base['title'],
            'department' => 'Faculty of Arts and Sciences',
            'current_department' => 'Faculty of Arts and Sciences',
            'email' => 'maya.fernando@example.edu',
            'phone' => '+1 617 555 0148',
            'address' => 'Cambridge, MA, USA',
            'city_country' => 'Cambridge, MA, USA',
            'website' => 'https://example.edu/mfernando',
            'orcid' => '0000-0002-1234-5678',
            'google_scholar' => 'https://scholar.google.com/citations?user=demo',
            'linkedin' => 'https://www.linkedin.com/in/demo-scholar',
        ]);
    }

    private function entriesFor(string $key, int $templateId): array
    {
        $entries = [
            'academic_profile' => [[
                'summary' => 'Researcher and educator working at the intersection of evidence synthesis, responsible data systems, and public decision-making. Experienced in interdisciplinary projects, graduate teaching, and publication-led research programmes.',
            ]],
            'research_interests' => [[
                'area' => 'Computational Social Science',
                'keywords' => 'survey methodology, causal inference, research software, open data',
                'description' => 'Designing transparent data pipelines and reproducible methods for policy-relevant research.',
            ], [
                'area' => 'Higher Education Analytics',
                'keywords' => 'student success, learning analytics, institutional research',
                'description' => 'Studying how universities can use evidence responsibly to improve academic outcomes.',
            ]],
            'education' => [[
                'degree' => 'Ph.D. in Data, Policy and Society',
                'institution' => 'University of Edinburgh',
                'location' => 'Edinburgh, United Kingdom',
                'year_start' => '2014',
                'year_end' => '2018',
                'thesis' => 'Computational Methods for Measuring Institutional Change',
                'supervisor' => 'Prof. Helen Mercer',
                'gpa' => 'Passed with distinction',
                'description' => 'Doctoral research combined statistical modelling with qualitative validation across multi-country institutional datasets.',
            ], [
                'degree' => 'M.Sc. in Applied Statistics',
                'institution' => 'National University of Singapore',
                'location' => 'Singapore',
                'year_start' => '2012',
                'year_end' => '2014',
                'thesis' => 'Bayesian Models for Longitudinal Survey Data',
            ]],
            'experience' => [[
                'position' => 'Lecturer in Research Methods',
                'organization' => 'Northbridge University',
                'department' => 'Faculty of Arts and Sciences',
                'location' => 'Cambridge, MA',
                'year_start' => '2021',
                'year_end' => 'Present',
                'description' => 'Teach graduate research design, supervise thesis projects, and lead a methods lab supporting faculty research across departments.',
            ], [
                'position' => 'Postdoctoral Fellow',
                'organization' => 'Centre for Evidence and Policy',
                'location' => 'London, United Kingdom',
                'year_start' => '2018',
                'year_end' => '2021',
                'description' => 'Developed open-source tools for evidence mapping and co-authored cross-sector policy reports with government and NGO partners.',
            ]],
            'academic_appointments' => [[
                'position' => 'Associate Professor',
                'department' => 'Department of Public Policy',
                'institution' => 'Northbridge University',
                'location' => 'Cambridge, MA',
                'year_start' => '2023',
                'year_end' => 'Present',
                'status' => 'Tenured',
                'description' => 'Lead the evidence systems research group and coordinate doctoral training in applied research methods.',
            ], [
                'position' => 'Assistant Professor',
                'department' => 'Department of Public Policy',
                'institution' => 'Northbridge University',
                'location' => 'Cambridge, MA',
                'year_start' => '2018',
                'year_end' => '2023',
                'status' => 'Tenure-track',
            ]],
            'research_experience' => [[
                'position' => 'Principal Investigator',
                'organization' => 'Open Research Infrastructure Lab',
                'location' => 'Cambridge, MA',
                'year_start' => '2020',
                'year_end' => 'Present',
                'description' => 'Direct a team building reproducible data workflows for multi-institutional research collaborations.',
            ]],
            'publications' => $this->publications($templateId),
            'grants' => [[
                'title' => 'Responsible Data Infrastructure for Public Research',
                'agency' => 'National Science Foundation',
                'amount' => '$420,000',
                'role' => 'Principal Investigator',
                'year_start' => '2024',
                'year_end' => '2027',
                'status' => 'Active',
                'grant_number' => 'NSF-RD-24018',
            ], [
                'title' => 'Open Evidence Tools for Academic Policy',
                'agency' => 'Mellon Foundation',
                'amount' => '$185,000',
                'role' => 'Co-PI',
                'year_start' => '2021',
                'year_end' => '2023',
                'status' => 'Completed',
            ]],
            'teaching' => [[
                'course' => 'Research Design and Causal Inference',
                'code' => 'RSM 601',
                'institution' => 'Northbridge University',
                'level' => 'Graduate',
                'role' => 'Course Convenor',
                'year_start' => '2021',
                'year_end' => 'Present',
                'description' => 'Designed a project-based course covering causal diagrams, quasi-experimental design, and reproducible analysis.',
            ], [
                'course' => 'Data Ethics for Researchers',
                'code' => 'IDS 410',
                'institution' => 'Northbridge University',
                'level' => 'Undergraduate',
                'role' => 'Instructor',
                'year_start' => '2022',
                'year_end' => '2025',
            ]],
            'supervision' => [[
                'student_name' => 'Amina Rahman',
                'degree' => 'Ph.D.',
                'thesis_title' => 'Data Governance Practices in Public Universities',
                'role' => 'Main Supervisor',
                'institution' => 'Northbridge University',
                'year_start' => '2022',
                'year_end' => 'Ongoing',
                'status' => 'In Progress',
            ], [
                'student_name' => 'Lucas Meyer',
                'degree' => 'M.Sc.',
                'thesis_title' => 'Visual Analytics for Evidence Reviews',
                'role' => 'Supervisor',
                'year_start' => '2021',
                'year_end' => '2022',
                'status' => 'Completed',
            ]],
            'academic_service' => [[
                'activity' => 'Graduate Curriculum Committee',
                'role' => 'Chair',
                'organization' => 'Faculty of Arts and Sciences',
                'year_start' => '2023',
                'year_end' => 'Present',
                'description' => 'Coordinated revision of research methods requirements across four graduate programmes.',
            ], [
                'activity' => 'Open Science Working Group',
                'role' => 'Member',
                'organization' => 'Northbridge University Library',
                'year_start' => '2020',
                'year_end' => '2024',
            ]],
            'conferences' => [[
                'title' => 'Auditable Evidence Pipelines for Policy Research',
                'conference' => 'International Conference on Computational Social Science',
                'location' => 'Copenhagen, Denmark',
                'year' => '2025',
                'type' => 'Oral Presentation',
            ], [
                'title' => 'Reproducibility in Cross-Institutional Data Projects',
                'conference' => 'Open Scholarship Forum',
                'location' => 'Toronto, Canada',
                'year' => '2024',
                'type' => 'Panel',
            ]],
            'invited_talks' => [[
                'title' => 'Designing Research Systems That Can Be Checked',
                'venue' => 'Oxford Internet Institute Seminar Series',
                'location' => 'Oxford, United Kingdom',
                'year' => '2025',
                'type' => 'Invited Lecture',
            ]],
            'projects' => [[
                'title' => 'Open Evidence Map Toolkit',
                'role' => 'Principal Investigator',
                'organization' => 'Northbridge University',
                'year_start' => '2022',
                'year_end' => 'Present',
                'collaborators' => 'Policy Lab, University Library, Centre for Digital Methods',
                'outputs' => 'Software package, documentation, two journal articles',
                'description' => 'A modular toolkit for screening, coding, and visualising evidence bases for public-sector research questions.',
            ]],
            'awards' => [[
                'title' => 'Early Career Research Excellence Award',
                'organization' => 'Northbridge University',
                'year' => '2024',
                'level' => 'University-level',
                'description' => 'Recognised for interdisciplinary research impact and graduate mentorship.',
            ], [
                'title' => 'Best Paper Award',
                'organization' => 'Open Scholarship Forum',
                'year' => '2022',
                'level' => 'International',
            ]],
            'professional_memberships' => [[
                'organization' => 'Society for Research Methodology',
                'role' => 'Member',
                'year_start' => '2019',
                'year_end' => 'Present',
            ], [
                'organization' => 'Association for Public Policy Analysis',
                'role' => 'Fellow',
                'year_start' => '2023',
                'year_end' => 'Present',
            ]],
            'editorial' => [[
                'journal' => 'Journal of Open Research Methods',
                'role' => 'Associate Editor',
                'year_start' => '2024',
                'year_end' => 'Present',
            ], [
                'journal' => 'Evidence & Policy',
                'role' => 'Reviewer',
                'year_start' => '2020',
                'year_end' => 'Present',
            ]],
            'skills' => [[
                'category' => 'Methods',
                'skills' => 'Causal inference, survey design, systematic review, mixed methods',
            ], [
                'category' => 'Software',
                'skills' => 'R, Python, SQL, Quarto, Git, reproducible workflow design',
            ]],
            'languages' => [[
                'language' => 'English',
                'proficiency' => 'native',
            ], [
                'language' => 'French',
                'proficiency' => 'fluent',
            ]],
            'patents' => [[
                'title' => 'System for Provenance Tracking in Collaborative Evidence Reviews',
                'authors' => 'Fernando, M.; Brooks, D.; Chen, L.',
                'year' => '2023',
                'status' => 'Filed',
                'patent_number' => 'US 63/555,018',
            ]],
            'references' => [[
                'name' => 'Prof. Helen Mercer',
                'title' => 'Professor of Research Policy',
                'affiliation' => 'University of Edinburgh',
                'relationship' => 'Doctoral supervisor',
                'email' => 'helen.mercer@example.edu',
                'phone' => '+44 131 555 0199',
            ], [
                'name' => 'Prof. Samuel Okafor',
                'title' => 'Dean, Faculty of Arts and Sciences',
                'affiliation' => 'Northbridge University',
                'relationship' => 'Department chair',
                'email' => 'samuel.okafor@example.edu',
            ]],
            'declaration' => [[
                'statement' => 'I hereby declare that the information provided above is true and accurate to the best of my knowledge.',
                'declaration_date' => date('F j, Y'),
                'signature_mode' => 'manual',
                'signature_name' => 'Dr. Maya Fernando',
            ]],
        ];

        $result = $entries[$key] ?? [];
        if ($templateId >= 3 && in_array($key, ['publications', 'grants', 'teaching', 'academic_service', 'conferences', 'projects'], true)) {
            $result = array_merge($result, array_slice($result, 0, 1));
        }
        if ($templateId === 6 && $key === 'publications') {
            $result = array_merge($result, $this->publicationExtras());
        }

        return $result;
    }

    private function publications(int $templateId): array
    {
        $items = [[
            'authors' => '**Fernando, M.**, Chen, L., & Okafor, S.',
            'year' => '2025',
            'title' => 'Auditable Workflows for Public Evidence Synthesis',
            'venue' => 'Journal of Open Research Methods',
            'volume_issue_pages' => '14(2), 88-107',
            'volume' => '14',
            'issue' => '2',
            'pages' => '88-107',
            'doi' => '10.5555/jorm.2025.018',
            'url' => 'https://doi.org/10.5555/jorm.2025.018',
            'publication_type' => 'Journal Article',
            'status' => 'Published',
        ], [
            'authors' => 'Brooks, D., **Fernando, M.**, & Singh, P.',
            'year' => '2024',
            'title' => 'Responsible Analytics in Higher Education Decision-Making',
            'venue' => 'Higher Education Policy Review',
            'volume_issue_pages' => '39(4), 441-463',
            'volume' => '39',
            'issue' => '4',
            'pages' => '441-463',
            'doi' => '10.5555/hepr.2024.044',
            'publication_type' => 'Journal Article',
            'status' => 'Published',
        ], [
            'authors' => '**Fernando, M.** & Mercer, H.',
            'year' => '2023',
            'title' => 'Evidence Maps as Boundary Objects in Policy Research',
            'venue' => 'International Journal of Social Research Methodology',
            'volume_issue_pages' => '26(6), 719-735',
            'doi' => '10.5555/ijsrm.2023.719',
            'publication_type' => 'Journal Article',
        ]];

        return $templateId >= 4 ? array_merge($items, $this->publicationExtras()) : $items;
    }

    private function publicationExtras(): array
    {
        return [[
            'authors' => 'Singh, P., **Fernando, M.**, & Zhao, Y.',
            'year' => '2022',
            'title' => 'Versioned Datasets for Multi-Site Educational Research',
            'venue' => 'Proceedings of the ACM Conference on Learning Analytics',
            'pages' => '144-156',
            'publication_type' => 'Conference Paper',
        ], [
            'authors' => '**Fernando, M.**, Al-Sayed, N., & Brooks, D.',
            'year' => '2021',
            'title' => 'From Dashboards to Deliberation: Institutional Uses of Data',
            'venue' => 'Policy Sciences',
            'volume' => '54',
            'issue' => '3',
            'pages' => '501-526',
            'publication_type' => 'Journal Article',
        ]];
    }

    private function titleize(string $key): string
    {
        return ucwords(str_replace('_', ' ', $key));
    }
}