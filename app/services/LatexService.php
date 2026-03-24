<?php
/**
 * LaTeX Service - Generates and compiles LaTeX documents
 * Falls back to FPDF when pdflatex is not available
 */

require_once APP_PATH . '/lib/fpdf.php';

/**
 * FPDF subclass that renders page numbers in the footer
 */
class CVScholarPDF extends FPDF
{
    public bool $showPageNumbers = false;
    public string $footerFont = 'CMUSerif';

    function Footer(): void
    {
        if (!$this->showPageNumbers) return;
        $this->SetY(-15);
        $this->SetFont($this->footerFont, '', 9);
        $this->SetTextColor(128, 128, 128);
        $this->Cell(0, 10, $this->PageNo() . ' / {nb}', 0, 0, 'C');
    }
}

class LatexService
{
    private CVProfile $cvModel;
    private Template $templateModel;
    private string $fontFamily = 'CMUSerif';
    private float $entrySpacing = 4;
    private array $secondaryColor = [102, 102, 102];

    public function __construct()
    {
        $this->cvModel = new CVProfile();
        $this->templateModel = new Template();
    }

    /**
     * Generate full LaTeX source for a CV profile
     */
    public function generateLatex(int $profileId): string
    {
        $profile = $this->cvModel->findById($profileId);
        if (!$profile) return '';

        $template = $this->templateModel->findById($profile['template_id']);
        if (!$template) return '';

        $sections = $this->cvModel->getSections($profileId);

        // Start with header
        $latex = $template['latex_header'] . "\n\n";

        // Render each section
        foreach ($sections as $section) {
            if (empty($section['is_visible'])) continue;

            if ($section['section_key'] === 'personal_info') {
                $personalInfo = $profile['personal_info'] ?? [];
                $latex .= $this->renderSection($section['latex_code'], $personalInfo) . "\n\n";
            } else {
                if (empty($section['entries'])) continue;
                $latex .= $this->renderRepeatingSection($section['latex_code'], $section['entries']) . "\n\n";
            }
        }

        $latex .= $template['latex_footer'];
        return $latex;
    }

    /**
     * Compile CV to PDF - uses pdflatex if available, falls back to FPDF
     */
    public function compile(int $profileId): array
    {
        $profile = $this->cvModel->findById($profileId);
        if (!$profile) {
            return ['success' => false, 'error' => 'Profile not found.'];
        }

        // Check if pdflatex is available
        if ($this->isPdflatexAvailable()) {
            return $this->compileWithLatex($profileId, $profile);
        }

        // Fallback: generate PDF with FPDF
        return $this->compileWithFPDF($profileId, $profile);
    }

    /**
     * Generate a demo PDF for a template with sample data
     */
    public function generateDemoPDF(int $templateId): array
    {
        $demoDir = STORAGE_PATH . '/demos';
        if (!is_dir($demoDir)) {
            mkdir($demoDir, 0755, true);
        }
        $demoPath = $demoDir . '/demo_template_' . $templateId . '.pdf';

        // Use cached version if exists
        if (file_exists($demoPath)) {
            return ['success' => true, 'pdf_path' => $demoPath];
        }

        $template = $this->templateModel->findById($templateId);
        if (!$template) {
            return ['success' => false, 'error' => 'Template not found.'];
        }

        $templateSections = $this->templateModel->getSections($templateId);
        $samplePI = $this->getDemoPersonalInfo();
        $sampleData = $this->getDemoSectionData();

        // Build sections array matching compileWithFPDF expectations
        $sections = [];
        foreach ($templateSections as $ts) {
            $key = $ts['section_key'];
            if ($key === 'personal_info') continue;
            $entries = [];
            if (isset($sampleData[$key])) {
                foreach ($sampleData[$key] as $entryData) {
                    $entries[] = ['data' => $entryData];
                }
            }
            if (empty($entries)) continue;
            $sections[] = [
                'section_key' => $key,
                'display_name' => $ts['display_name'],
                'is_visible' => 1,
                'fields_schema' => $ts['fields_schema'],
                'entries' => $entries,
            ];
        }

        // Build a fake profile to pass to the rendering pipeline
        $fakeProfile = [
            'template_id' => $templateId,
            'personal_info' => $samplePI,
            'user_id' => 0,
        ];

        return $this->renderDemoPDF($fakeProfile, $template, $sections, $demoPath);
    }

    /**
     * Render a demo PDF using the same pipeline as compileWithFPDF
     */
    private function renderDemoPDF(array $profile, array $template, array $sections, string $outputPath): array
    {
        $styleConfig = $template['style_config'] ?? [];
        $personalInfo = $profile['personal_info'];

        $primaryColor = $this->hexToRGB($styleConfig['primaryColor'] ?? '#003366');
        $secondaryColor = $this->hexToRGB($styleConfig['secondaryColor'] ?? '#666666');
        $fontFamily = $this->getFontFamily($styleConfig);
        $pageSize = $this->getPageSize($styleConfig);
        $headerLayout = $styleConfig['headerLayout'] ?? 'centered';
        $sectionHeaderStyle = $styleConfig['sectionHeaderStyle'] ?? 'bold_rule';
        $showPageNumbers = $styleConfig['showPageNumbers'] ?? false;
        $showLastUpdated = $styleConfig['showLastUpdated'] ?? false;
        $nameSize = (float)($styleConfig['nameSize'] ?? '22pt');
        $sectionTitleSize = (float)($styleConfig['sectionTitleSize'] ?? '12pt');
        $entrySpacing = (float)($styleConfig['entrySpacing'] ?? 4);
        $sectionSpacing = (float)($styleConfig['sectionSpacing'] ?? 4);
        $ruleWeight = (float)($styleConfig['ruleWeight'] ?? 0.25);

        $pdf = new CVScholarPDF('P', 'mm', $pageSize);
        $pdf->showPageNumbers = (bool)$showPageNumbers;
        $pdf->footerFont = $fontFamily;
        if ($showPageNumbers) { $pdf->AliasNbPages(); }
        $pdf->SetAutoPageBreak(true, 20);

        $pdf->AddFont('CMUSerif', '', 'cmunrm.php');
        $pdf->AddFont('CMUSerif', 'B', 'cmunbx.php');
        $pdf->AddFont('CMUSerif', 'I', 'cmunti.php');
        $pdf->AddFont('CMUSerif', 'BI', 'cmunbi.php');
        $pdf->AddFont('CMUSans', '', 'cmunss.php');
        $pdf->AddFont('CMUSans', 'B', 'cmunsx.php');
        $pdf->AddFont('CMUSans', 'I', 'cmunsi.php');
        $pdf->AddFont('CMUMono', '', 'cmuntt.php');

        $pdf->AddPage();
        $marginStr = $styleConfig['margins'] ?? '1in';
        $marginMM = $this->parseMargin($marginStr);
        $pdf->SetMargins($marginMM, $marginMM, $marginMM);
        $pdf->SetX($marginMM);
        $pdf->SetY($marginMM);

        $totalPageWidth = $this->getPageWidthMM($pageSize);
        $pageWidth = $totalPageWidth - (2 * $marginMM);

        $this->fontFamily = $fontFamily;
        $this->entrySpacing = $entrySpacing;
        $this->secondaryColor = $secondaryColor;

        if (in_array($headerLayout, ['left_masthead', 'left_masthead_compact', 'formal_compact'])) {
            $this->renderLeftAlignedHeader($pdf, $personalInfo, $styleConfig, $fontFamily, $nameSize, $pageWidth, $marginMM);
        } else {
            $this->renderCenteredHeader($pdf, $personalInfo, $fontFamily, $pageWidth, $marginMM);
        }

        $this->pubCounter = 0;
        $pageHeight = $this->getPageHeightMM($pageSize);
        $minSectionKeep = 35;

        foreach ($sections as $section) {
            if (empty($section['is_visible'])) continue;
            if (empty($section['entries'])) continue;

            // Ensure header + first entry stay on the same page
            $spaceLeft = $pageHeight - $marginMM - $pdf->GetY();
            if ($spaceLeft < $minSectionKeep) {
                $pdf->AddPage();
                $pdf->SetY($marginMM);
            }

            $pdf->Ln($sectionSpacing - 2);
            $this->renderSectionHeader($pdf, $section['display_name'], $primaryColor, $pageWidth, $marginMM, $sectionHeaderStyle, $sectionTitleSize, $ruleWeight, $fontFamily);
            $this->renderSectionEntries($pdf, $section, $pageWidth, $marginMM, $pageHeight);
            $pdf->Ln($entrySpacing);
        }

        if ($showLastUpdated) {
            $pdf->Ln(4);
            $pdf->SetFont($fontFamily, 'I', 8);
            $pdf->SetTextColor(128, 128, 128);
            $pdf->SetX($marginMM);
            $pdf->Cell($pageWidth, 5, $this->toISO('Last updated: ' . date('F Y')), 0, 1, 'R');
        }

        try {
            $pdf->Output('F', $outputPath);
        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'Demo PDF generation failed: ' . $e->getMessage()];
        }

        return ['success' => true, 'pdf_path' => $outputPath];
    }

    private function getDemoPersonalInfo(): array
    {
        return [
            'full_name' => 'Dr. Sarah J. Mitchell',
            'title' => 'Associate Professor',
            'current_title' => 'Associate Professor of Computer Science',
            'department' => 'Department of Computer Science',
            'affiliation' => 'University of Cambridge',
            'email' => 'sarah.mitchell@cam.ac.uk',
            'phone' => '+44 1223 335 884',
            'address' => 'Cambridge, United Kingdom',
            'website' => 'https://sarahmitchell.ac.uk',
            'orcid' => '0000-0002-1234-5678',
            'google_scholar' => 'https://scholar.google.com/citations?user=example',
            'linkedin' => 'https://linkedin.com/in/sarah-mitchell-cs',
            'nationality' => 'British',
            'date_of_birth' => '15 March 1985',
            'current_department' => 'Department of Computer Science',
            'city_country' => 'Cambridge, United Kingdom',
            'scopus_profile' => 'https://www.scopus.com/authid/detail.uri?authorId=12345',
        ];
    }

    private function getDemoSectionData(): array
    {
        return [
            'academic_profile' => [
                ['summary' => 'Associate Professor with over 12 years of experience in machine learning, natural language processing, and computational linguistics. Published 45+ peer-reviewed articles in top-tier venues including NeurIPS, ACL, and JMLR. Recipient of the ERC Starting Grant (2021) and multiple best paper awards. Active in supervision, teaching, and academic service with a strong commitment to open-source research.'],
            ],
            'education' => [
                ['degree' => 'Ph.D. in Computer Science', 'institution' => 'University of Oxford', 'location' => 'Oxford, UK', 'year_start' => '2009', 'year_end' => '2013', 'thesis' => 'Scalable Methods for Probabilistic Topic Models in Large Text Corpora', 'supervisor' => 'Prof. James R. Whitfield', 'gpa' => ''],
                ['degree' => 'M.Sc. in Artificial Intelligence', 'institution' => 'University of Edinburgh', 'location' => 'Edinburgh, UK', 'year_start' => '2007', 'year_end' => '2009', 'thesis' => '', 'supervisor' => '', 'gpa' => 'Distinction'],
                ['degree' => 'B.Sc. (Hons) in Mathematics', 'institution' => 'Imperial College London', 'location' => 'London, UK', 'year_start' => '2003', 'year_end' => '2007', 'thesis' => '', 'supervisor' => '', 'gpa' => 'First Class Honours'],
            ],
            'experience' => [
                ['position' => 'Associate Professor', 'organization' => 'University of Cambridge', 'department' => 'Department of Computer Science', 'location' => 'Cambridge, UK', 'year_start' => '2019', 'year_end' => 'Present', 'description' => 'Leading the Computational Linguistics Lab. Teaching advanced modules in NLP and machine learning. Supervising 5 PhD students and 3 postdoctoral researchers.'],
                ['position' => 'Lecturer in Computer Science', 'organization' => 'University College London', 'department' => 'Department of Computer Science', 'location' => 'London, UK', 'year_start' => '2014', 'year_end' => '2019', 'description' => 'Taught modules in data science, machine learning, and statistics. Supervised 8 PhD students to completion.'],
                ['position' => 'Postdoctoral Research Associate', 'organization' => 'MIT Computer Science and AI Lab', 'department' => 'CSAIL', 'location' => 'Cambridge, MA, USA', 'year_start' => '2013', 'year_end' => '2014', 'description' => 'Developed novel algorithms for large-scale text analysis under NSF-funded research project.'],
            ],
            'research_interests' => [
                ['area' => 'Natural Language Processing', 'keywords' => 'text summarization, sentiment analysis, transformers', 'description' => 'Developing efficient transformer architectures for low-resource language understanding and generation tasks.'],
                ['area' => 'Machine Learning', 'keywords' => 'probabilistic models, Bayesian inference, deep learning', 'description' => 'Scalable variational inference methods for large probabilistic models with applications to text and vision.'],
                ['area' => 'Computational Social Science', 'keywords' => 'misinformation detection, opinion mining', 'description' => ''],
            ],
            'publications' => [
                ['title' => 'Efficient Transformer Architectures for Low-Resource Languages', 'authors' => '**S.J. Mitchell**, A. Kumar, L. Chen', 'year' => '2024', 'publication_type' => 'Journal Article', 'venue' => 'Journal of Machine Learning Research', 'volume_issue_pages' => 'Vol. 25, pp. 1-32', 'doi' => '10.5555/jmlr.2024.001', 'url' => '', 'status' => 'Published'],
                ['title' => 'Bayesian Topic Models with Neural Variational Inference', 'authors' => '**S.J. Mitchell**, R.P. Adams', 'year' => '2023', 'publication_type' => 'Conference Paper', 'venue' => 'Advances in Neural Information Processing Systems (NeurIPS)', 'volume_issue_pages' => '', 'doi' => '10.5555/neurips.2023.042', 'url' => '', 'status' => 'Published'],
                ['title' => 'Cross-Lingual Sentiment Analysis via Knowledge Distillation', 'authors' => 'L. Chen, **S.J. Mitchell**, M. Rodriguez', 'year' => '2023', 'publication_type' => 'Conference Paper', 'venue' => 'Annual Meeting of the Association for Computational Linguistics (ACL)', 'volume_issue_pages' => 'pp. 456-470', 'doi' => '10.18653/v1/2023.acl-main.045', 'url' => '', 'status' => 'Published'],
                ['title' => 'A Survey of Misinformation Detection Using NLP Techniques', 'authors' => 'D. Park, **S.J. Mitchell**', 'year' => '2022', 'publication_type' => 'Journal Article', 'venue' => 'Computational Linguistics', 'volume_issue_pages' => 'Vol. 48, Issue 2, pp. 301-345', 'doi' => '10.1162/coli_a_00432', 'url' => '', 'status' => 'Published'],
                ['title' => 'Scalable Variational Inference for Deep Generative Models of Text', 'authors' => '**S.J. Mitchell**', 'year' => '2025', 'publication_type' => 'Journal Article', 'venue' => 'Artificial Intelligence', 'volume_issue_pages' => '', 'doi' => '', 'url' => '', 'status' => 'Under Review'],
            ],
            'projects' => [
                ['title' => 'Low-Resource NLP for Heritage Languages', 'role' => 'Principal Investigator', 'organization' => 'ERC Starting Grant', 'funding_agency' => 'European Research Council', 'amount' => 'EUR 1.5M', 'year_start' => '2021', 'year_end' => '2026', 'collaborators' => 'Dr. A. Kumar (ETH Zurich), Prof. L. Nguyen (NUS)', 'outputs' => '8 papers, 2 open-source toolkits', 'tools_methods' => 'PyTorch, Hugging Face, multilingual transformers', 'description' => 'Developing NLP tools and resources for underrepresented languages with limited digital text corpora.'],
                ['title' => 'AI-Driven Misinformation Detection Platform', 'role' => 'Co-PI', 'organization' => 'EPSRC', 'funding_agency' => 'EPSRC', 'amount' => 'GBP 420,000', 'year_start' => '2020', 'year_end' => '2023', 'collaborators' => 'Prof. J. Smith (Oxford)', 'outputs' => '5 papers, 1 deployed tool', 'tools_methods' => '', 'description' => 'Built a real-time platform for detecting and categorizing misinformation across social media platforms.'],
            ],
            'awards' => [
                ['title' => 'ERC Starting Grant', 'organization' => 'European Research Council', 'year' => '2021', 'level' => 'International', 'description' => ''],
                ['title' => 'Best Paper Award', 'organization' => 'ACL 2020', 'year' => '2020', 'level' => 'International', 'description' => 'For "Neural Topic Models with Continuous Latent Representations"'],
                ['title' => 'University Teaching Excellence Award', 'organization' => 'University College London', 'year' => '2018', 'level' => 'University-level', 'description' => ''],
            ],
            'conferences' => [
                ['title' => 'Efficient Transformers for Under-Resourced Languages', 'conference' => 'NeurIPS 2024', 'location' => 'Vancouver, Canada', 'year' => '2024', 'type' => 'Oral'],
                ['title' => 'Cross-Lingual Sentiment Analysis', 'conference' => 'ACL 2023', 'location' => 'Toronto, Canada', 'year' => '2023', 'type' => 'Poster'],
                ['title' => 'Misinformation Detection at Scale', 'conference' => 'AAAI 2022', 'location' => 'Virtual', 'year' => '2022', 'type' => 'Invited Talk'],
            ],
            'teaching' => [
                ['course' => 'Advanced Natural Language Processing', 'code' => 'CS4520', 'level' => 'Postgraduate', 'institution' => 'University of Cambridge', 'role' => 'Lecturer', 'year_start' => '2020', 'year_end' => 'Present', 'description' => 'Covers transformers, attention mechanisms, pre-training, and NLP applications. 60+ students per year.'],
                ['course' => 'Machine Learning Foundations', 'code' => 'CS3010', 'level' => 'Undergraduate', 'institution' => 'University of Cambridge', 'role' => 'Lecturer', 'year_start' => '2019', 'year_end' => 'Present', 'description' => 'Core module covering supervised, unsupervised, and reinforcement learning.'],
            ],
            'supervision' => [
                ['student_name' => 'Li Chen', 'degree' => 'Ph.D.', 'thesis_title' => 'Cross-Lingual Transfer Learning for Low-Resource Sentiment Analysis', 'role' => 'Primary Supervisor', 'institution' => 'University of Cambridge', 'year_start' => '2021', 'year_end' => 'Ongoing', 'status' => 'Year 3'],
                ['student_name' => 'David Park', 'degree' => 'Ph.D.', 'thesis_title' => 'Automated Fact-Checking with Large Language Models', 'role' => 'Primary Supervisor', 'institution' => 'University of Cambridge', 'year_start' => '2020', 'year_end' => '2024', 'status' => 'Completed'],
            ],
            'grants' => [
                ['title' => 'Low-Resource NLP for Heritage Languages', 'agency' => 'European Research Council (ERC)', 'amount' => 'EUR 1,500,000', 'year_start' => '2021', 'year_end' => '2026', 'role' => 'PI', 'grant_number' => 'ERC-StG-2021-101039', 'status' => 'Active', 'collaborators' => 'Dr. A. Kumar (ETH Zurich)'],
                ['title' => 'AI-Driven Misinformation Detection', 'agency' => 'EPSRC', 'amount' => 'GBP 420,000', 'year_start' => '2020', 'year_end' => '2023', 'role' => 'Co-PI', 'grant_number' => 'EP/T001234/1', 'status' => 'Completed', 'collaborators' => ''],
            ],
            'skills' => [
                ['category' => 'Programming', 'skills' => 'Python, R, Julia, C++, SQL, JavaScript'],
                ['category' => 'ML Frameworks', 'skills' => 'PyTorch, TensorFlow, JAX, Hugging Face Transformers, scikit-learn'],
                ['category' => 'Tools & Platforms', 'skills' => 'Git, Docker, AWS, LaTeX, Linux, Jupyter'],
            ],
            'certifications' => [
                ['title' => 'AWS Certified Machine Learning - Specialty', 'issuer' => 'Amazon Web Services', 'year' => '2022', 'credential_id' => 'AWS-ML-2022-98765', 'description' => ''],
                ['title' => 'Certified Scrum Master', 'issuer' => 'Scrum Alliance', 'year' => '2019', 'credential_id' => '', 'description' => ''],
            ],
            'languages' => [
                ['language' => 'English', 'proficiency' => 'Native'],
                ['language' => 'French', 'proficiency' => 'Professional Working'],
                ['language' => 'Mandarin', 'proficiency' => 'Intermediate'],
            ],
            'professional_memberships' => [
                ['organization' => 'Association for Computational Linguistics (ACL)', 'role' => 'Senior Member', 'year_start' => '2015', 'year_end' => 'Present'],
                ['organization' => 'IEEE', 'role' => 'Member', 'year_start' => '2013', 'year_end' => 'Present'],
                ['organization' => 'British Computer Society (BCS)', 'role' => 'Fellow', 'year_start' => '2020', 'year_end' => 'Present'],
            ],
            'editorial' => [
                ['journal' => 'Journal of Machine Learning Research', 'role' => 'Associate Editor', 'year_start' => '2022', 'year_end' => 'Present'],
                ['journal' => 'Computational Linguistics', 'role' => 'Reviewer', 'year_start' => '2016', 'year_end' => 'Present'],
            ],
            'references' => [
                ['name' => 'Prof. James R. Whitfield', 'title' => 'Professor of Computer Science', 'affiliation' => 'University of Oxford', 'relationship' => 'PhD Supervisor', 'email' => 'j.whitfield@cs.ox.ac.uk', 'phone' => ''],
                ['name' => 'Prof. Ryan P. Adams', 'title' => 'Professor of Computer Science', 'affiliation' => 'Princeton University', 'relationship' => 'Postdoctoral Mentor', 'email' => 'rpa@cs.princeton.edu', 'phone' => ''],
            ],
            'academic_appointments' => [
                ['position' => 'Associate Professor', 'department' => 'Department of Computer Science', 'institution' => 'University of Cambridge', 'location' => 'Cambridge, UK', 'year_start' => '2019', 'year_end' => 'Present', 'status' => 'Permanent', 'description' => ''],
                ['position' => 'Lecturer', 'department' => 'Department of Computer Science', 'institution' => 'University College London', 'location' => 'London, UK', 'year_start' => '2014', 'year_end' => '2019', 'status' => '', 'description' => ''],
            ],
            'research_experience' => [
                ['role' => 'Postdoctoral Research Associate', 'lab_or_center' => 'CSAIL', 'institution' => 'Massachusetts Institute of Technology', 'year_start' => '2013', 'year_end' => '2014', 'supervisor' => 'Prof. Regina Barzilay', 'description' => 'Developed scalable algorithms for unsupervised text analysis.'],
            ],
            'academic_service' => [
                ['activity' => 'Program Committee Co-Chair', 'role' => 'Co-Chair', 'organization' => 'EMNLP 2024', 'year_start' => '2024', 'year_end' => '2024', 'description' => ''],
                ['activity' => 'Departmental Admissions Committee', 'role' => 'Member', 'organization' => 'University of Cambridge', 'year_start' => '2021', 'year_end' => 'Present', 'description' => 'Reviewing PhD applications for the Computer Science department.'],
            ],
            'invited_talks' => [
                ['title' => 'The Future of Low-Resource NLP', 'host' => 'Google DeepMind', 'event' => 'AI Research Seminar Series', 'location' => 'London, UK', 'year' => '2024', 'type' => 'Invited Talk'],
                ['title' => 'Scalable Bayesian Inference for NLP', 'host' => 'Stanford NLP Group', 'event' => 'Stanford NLP Seminar', 'location' => 'Stanford, CA, USA', 'year' => '2022', 'type' => 'Invited Talk'],
            ],
            'patents' => [
                ['title' => 'System for Real-Time Multilingual Misinformation Detection', 'inventors' => 'S.J. Mitchell, J. Smith, D. Park', 'year' => '2023', 'patent_number' => 'GB2023/001234', 'jurisdiction' => 'United Kingdom', 'status' => 'Filed'],
            ],
        ];
    }

    /**
     * Check if pdflatex is installed and accessible
     */
    private function isPdflatexAvailable(): bool
    {
        $compiler = LATEX_COMPILER;
        if (PHP_OS_FAMILY === 'Windows') {
            exec("where $compiler 2>NUL", $out, $code);
        } else {
            exec("which $compiler 2>/dev/null", $out, $code);
        }
        return $code === 0;
    }

    /**
     * Compile using pdflatex (original method)
     */
    private function compileWithLatex(int $profileId, array $profile): array
    {
        $latex = $this->generateLatex($profileId);
        if (empty($latex)) {
            return ['success' => false, 'error' => 'No LaTeX content generated.'];
        }

        $tempDir = LATEX_TEMP_DIR . '/' . $profileId . '_' . time();
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $texFile = $tempDir . '/cv.tex';
        $pdfFile = $tempDir . '/cv.pdf';

        file_put_contents($texFile, $latex);

        $compiler = escapeshellarg(LATEX_COMPILER);
        $texFileEscaped = escapeshellarg($texFile);
        $outputDir = escapeshellarg($tempDir);

        $command = sprintf(
            '%s -interaction=nonstopmode -output-directory=%s %s 2>&1',
            $compiler,
            $outputDir,
            $texFileEscaped
        );

        exec($command, $output, $returnCode);
        exec($command, $output2, $returnCode2);

        if (!file_exists($pdfFile)) {
            $errorLog = implode("\n", array_merge($output, $output2));
            $this->cleanTempDir($tempDir);
            return [
                'success' => false,
                'error'   => 'LaTeX compilation failed. Check your content for special characters.',
                'log'     => $errorLog,
            ];
        }

        $finalDir = GENERATED_DIR . '/' . $profile['user_id'];
        if (!is_dir($finalDir)) {
            mkdir($finalDir, 0755, true);
        }

        $finalPath = $finalDir . '/cv_' . $profileId . '.pdf';
        copy($pdfFile, $finalPath);
        $this->cleanTempDir($tempDir);

        return ['success' => true, 'pdf_path' => $finalPath];
    }

    /**
     * Determine the primary font family based on style_config
     */
    private function getFontFamily(array $styleConfig): string
    {
        $family = strtolower($styleConfig['fontFamily'] ?? 'cmuserif');
        if (in_array($family, ['cmusans', 'raleway'])) {
            return 'CMUSans';
        }
        return 'CMUSerif';
    }

    /**
     * Determine the FPDF page size string from style_config
     */
    private function getPageSize(array $styleConfig): string
    {
        $size = strtolower($styleConfig['pageSize'] ?? 'A4');
        return ($size === 'letter') ? 'Letter' : 'A4';
    }

    /**
     * Get page width in mm for the given page size
     */
    private function getPageWidthMM(string $pageSize): float
    {
        return ($pageSize === 'Letter') ? 215.9 : 210.0;
    }

    /**
     * Get page height in mm for the given page size
     */
    private function getPageHeightMM(string $pageSize): float
    {
        return ($pageSize === 'Letter') ? 279.4 : 297.0;
    }

    /**
     * Compile using FPDF (fallback when pdflatex not installed)
     */
    private function compileWithFPDF(int $profileId, array $profile): array
    {
        $template = $this->templateModel->findById($profile['template_id']);
        if (!$template) {
            return ['success' => false, 'error' => 'Template not found.'];
        }

        $sections = $this->cvModel->getSections($profileId);
        $styleConfig = $template['style_config'] ?? [];
        $personalInfo = $profile['personal_info'] ?? [];

        // Parse style config values
        $primaryColor = $this->hexToRGB($styleConfig['primaryColor'] ?? '#003366');
        $secondaryColor = $this->hexToRGB($styleConfig['secondaryColor'] ?? '#666666');
        $fontFamily = $this->getFontFamily($styleConfig);
        $pageSize = $this->getPageSize($styleConfig);
        $headerLayout = $styleConfig['headerLayout'] ?? 'centered';
        $sectionHeaderStyle = $styleConfig['sectionHeaderStyle'] ?? 'bold_rule';
        $showPageNumbers = $styleConfig['showPageNumbers'] ?? false;
        $showLastUpdated = $styleConfig['showLastUpdated'] ?? false;
        $nameSize = (float)($styleConfig['nameSize'] ?? '22pt');
        $sectionTitleSize = (float)($styleConfig['sectionTitleSize'] ?? '12pt');
        $entrySpacing = (float)($styleConfig['entrySpacing'] ?? 4);
        $sectionSpacing = (float)($styleConfig['sectionSpacing'] ?? 4);
        $ruleWeight = (float)($styleConfig['ruleWeight'] ?? 0.25);

        $pdf = new CVScholarPDF('P', 'mm', $pageSize);
        $pdf->showPageNumbers = (bool)$showPageNumbers;
        $pdf->footerFont = $fontFamily;
        if ($showPageNumbers) {
            $pdf->AliasNbPages();
        }
        $pdf->SetAutoPageBreak(true, 20);

        // Load Computer Modern Unicode fonts (classical LaTeX look)
        $pdf->AddFont('CMUSerif', '', 'cmunrm.php');
        $pdf->AddFont('CMUSerif', 'B', 'cmunbx.php');
        $pdf->AddFont('CMUSerif', 'I', 'cmunti.php');
        $pdf->AddFont('CMUSerif', 'BI', 'cmunbi.php');
        $pdf->AddFont('CMUSans', '', 'cmunss.php');
        $pdf->AddFont('CMUSans', 'B', 'cmunsx.php');
        $pdf->AddFont('CMUSans', 'I', 'cmunsi.php');
        $pdf->AddFont('CMUMono', '', 'cmuntt.php');

        $pdf->AddPage();

        // Margins
        $marginStr = $styleConfig['margins'] ?? '1in';
        $marginMM = $this->parseMargin($marginStr);
        $pdf->SetMargins($marginMM, $marginMM, $marginMM);
        $pdf->SetX($marginMM);
        $pdf->SetY($marginMM);

        $totalPageWidth = $this->getPageWidthMM($pageSize);
        $pageWidth = $totalPageWidth - (2 * $marginMM);

        // Store rendering context for entry renderers
        $this->fontFamily = $fontFamily;
        $this->entrySpacing = $entrySpacing;
        $this->secondaryColor = $secondaryColor;

        // === PERSONAL INFO HEADER ===
        if (in_array($headerLayout, ['left_masthead', 'left_masthead_compact', 'formal_compact'])) {
            $this->renderLeftAlignedHeader($pdf, $personalInfo, $styleConfig, $fontFamily, $nameSize, $pageWidth, $marginMM);
        } else {
            $this->renderCenteredHeader($pdf, $personalInfo, $fontFamily, $pageWidth, $marginMM);
        }

        // Publication counter for numbered lists
        $this->pubCounter = 0;

        // === SECTIONS ===
        // Minimum space needed for header (~13mm) + at least one entry (~22mm) = 35mm
        $pageHeight = $this->getPageHeightMM($pageSize);
        $minSectionKeep = 35;
        foreach ($sections as $section) {
            if (empty($section['is_visible'])) continue;
            if ($section['section_key'] === 'personal_info') continue;
            if (empty($section['entries'])) continue;

            // Ensure header + first entry stay on the same page
            $spaceLeft = $pageHeight - $marginMM - $pdf->GetY();
            if ($spaceLeft < $minSectionKeep) {
                $pdf->AddPage();
                $pdf->SetY($marginMM);
            }

            // Section header
            $pdf->Ln($sectionSpacing - 2);
            $this->renderSectionHeader($pdf, $section['display_name'], $primaryColor, $pageWidth, $marginMM, $sectionHeaderStyle, $sectionTitleSize, $ruleWeight, $fontFamily);

            // Section entries
            $this->renderSectionEntries($pdf, $section, $pageWidth, $marginMM, $pageHeight);

            $pdf->Ln($entrySpacing);
        }

        // "Last updated" footer
        if ($showLastUpdated) {
            $pdf->Ln(4);
            $pdf->SetFont($fontFamily, 'I', 8);
            $pdf->SetTextColor(128, 128, 128);
            $pdf->SetX($marginMM);
            $pdf->Cell($pageWidth, 5, $this->toISO('Last updated: ' . date('F Y')), 0, 1, 'R');
        }

        // Page numbers — handled via FPDF footer override
        // (see compileWithFPDF where AliasNbPages is set and footer callback renders page numbers)

        // Save to file
        $finalDir = GENERATED_DIR . '/' . $profile['user_id'];
        if (!is_dir($finalDir)) {
            mkdir($finalDir, 0755, true);
        }

        $finalPath = $finalDir . '/cv_' . $profileId . '.pdf';

        try {
            $pdf->Output('F', $finalPath);
        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'PDF generation failed: ' . $e->getMessage()];
        }

        return ['success' => true, 'pdf_path' => $finalPath];
    }

    /**
     * Render centered header (legacy free templates)
     */
    private function renderCenteredHeader(FPDF $pdf, array $pi, string $font, float $w, float $m): void
    {
        $fullName = $pi['full_name'] ?? '';
        $title = $pi['title'] ?? '';
        $currentTitle = $pi['current_title'] ?? '';
        $department = $pi['department'] ?? '';
        $affiliation = $pi['affiliation'] ?? '';
        $email = $pi['email'] ?? '';
        $phone = $pi['phone'] ?? '';
        $website = $pi['website'] ?? '';
        $orcid = $pi['orcid'] ?? '';
        $address = $pi['address'] ?? '';
        $googleScholar = $pi['google_scholar'] ?? '';
        $linkedin = $pi['linkedin'] ?? '';

        // Name - large, bold, centered
        $pdf->SetFont($font, 'B', 22);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->Cell($w, 10, $this->toISO($fullName), 0, 1, 'C');
        $pdf->Ln(1);

        // Thin rule under name
        $pdf->SetDrawColor(0, 0, 0);
        $pdf->SetLineWidth(0.3);
        $y = $pdf->GetY();
        $pdf->Line($m, $y, $m + $w, $y);
        $pdf->Ln(3);

        // Position line: Current Title / Title, Department, Institution
        $positionParts = [];
        if ($currentTitle) $positionParts[] = $currentTitle;
        elseif ($title) $positionParts[] = $title;
        if ($department) $positionParts[] = $department;
        if ($affiliation) $positionParts[] = $affiliation;
        if (!empty($positionParts)) {
            $pdf->SetFont($font, '', 11);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($w, 6, $this->toISO(implode(', ', $positionParts)), 0, 1, 'C');
        }

        if ($address) {
            $pdf->SetFont($font, '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($w, 5, $this->toISO($address), 0, 1, 'C');
        }

        $contactParts = [];
        if ($email) $contactParts[] = $email;
        if ($phone) $contactParts[] = $phone;
        if (!empty($contactParts)) {
            $pdf->SetFont($font, '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($w, 5, $this->toISO(implode('  |  ', $contactParts)), 0, 1, 'C');
        }

        $webParts = [];
        if ($website) $webParts[] = $this->shortenUrl($website);
        if ($orcid) $webParts[] = 'ORCID: ' . $orcid;
        if ($googleScholar) $webParts[] = 'Scholar: ' . $this->shortenUrl($googleScholar);
        if ($linkedin) $webParts[] = 'LinkedIn: ' . $this->shortenUrl($linkedin);
        if (!empty($webParts)) {
            $pdf->SetFont($font, '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $this->renderWrappedContactLine($pdf, $webParts, $font, 10, $w, $m, 'C');
        }

        $pdf->Ln(6);
    }

    /**
     * Render left-aligned masthead header (pro templates)
     */
    private function renderLeftAlignedHeader(FPDF $pdf, array $pi, array $styleConfig, string $font, float $nameSize, float $w, float $m): void
    {
        $fullName = $pi['full_name'] ?? '';
        $title = $pi['title'] ?? '';
        $affiliation = $pi['affiliation'] ?? '';
        $department = $pi['current_department'] ?? '';
        $email = $pi['email'] ?? '';
        $phone = $pi['phone'] ?? '';
        $website = $pi['website'] ?? '';
        $orcid = $pi['orcid'] ?? '';
        $cityCountry = $pi['city_country'] ?? ($pi['address'] ?? '');
        $googleScholar = $pi['google_scholar'] ?? '';
        $scopusProfile = $pi['scopus_profile'] ?? '';
        $nationality = $pi['nationality'] ?? '';
        $dateOfBirth = $pi['date_of_birth'] ?? '';

        $headerLayout = $styleConfig['headerLayout'] ?? 'left_masthead';
        $isCompact = in_array($headerLayout, ['left_masthead_compact', 'formal_compact']);
        $positionFontSize = $isCompact ? 10 : 10.5;
        $contactFontSize = $isCompact ? 9 : 9.5;

        // Name - left aligned
        $pdf->SetFont($font, 'B', $nameSize);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetX($m);
        $pdf->Cell($w, $nameSize * 0.5, $this->toISO($fullName), 0, 1, 'L');
        $pdf->Ln(1);

        // Position line: Title, Department, Institution
        $positionParts = [];
        if ($title) $positionParts[] = $title;
        if ($department) $positionParts[] = $department;
        if ($affiliation) $positionParts[] = $affiliation;
        if (!empty($positionParts)) {
            $pdf->SetFont($font, '', $positionFontSize);
            $pdf->SetTextColor(40, 40, 40);
            $pdf->SetX($m);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $positionParts)), 0, 1, 'L');
        }

        // Contact line 1: City | email | phone
        $contact1 = [];
        if ($cityCountry) $contact1[] = $cityCountry;
        if ($email) $contact1[] = $email;
        if ($phone) $contact1[] = $phone;
        if (!empty($contact1)) {
            $pdf->SetFont($font, '', $contactFontSize);
            $pdf->SetTextColor(60, 60, 60);
            $pdf->SetX($m);
            $pdf->Cell($w, 5, $this->toISO(implode('  |  ', $contact1)), 0, 1, 'L');
        }

        // Contact line 2: website | ORCID | Scholar | Scopus
        $contact2 = [];
        if ($website) $contact2[] = $this->shortenUrl($website);
        if ($orcid) $contact2[] = 'ORCID: ' . $orcid;
        if ($googleScholar) $contact2[] = 'Scholar: ' . $this->shortenUrl($googleScholar);
        if ($scopusProfile) $contact2[] = 'Scopus: ' . $this->shortenUrl($scopusProfile);
        if (!empty($contact2)) {
            $pdf->SetFont($font, '', $contactFontSize);
            $pdf->SetTextColor(60, 60, 60);
            $this->renderWrappedContactLine($pdf, $contact2, $font, $contactFontSize, $w, $m, 'L');
        }

        // European personal data line (only if template allows and data present)
        if ($headerLayout === 'formal_compact' && ($nationality || $dateOfBirth)) {
            $personalParts = [];
            if ($nationality) $personalParts[] = 'Nationality: ' . $nationality;
            if ($dateOfBirth) $personalParts[] = 'Born: ' . $dateOfBirth;
            $pdf->SetFont($font, '', $contactFontSize);
            $pdf->SetTextColor(80, 80, 80);
            $pdf->SetX($m);
            $pdf->Cell($w, 5, $this->toISO(implode('  |  ', $personalParts)), 0, 1, 'L');
        }

        // Thin rule under masthead
        $ruleWeight = (float)($styleConfig['ruleWeight'] ?? 0.25);
        $pdf->Ln(2);
        $pdf->SetDrawColor(180, 180, 180);
        $pdf->SetLineWidth($ruleWeight);
        $y = $pdf->GetY();
        $pdf->Line($m, $y, $m + $w, $y);

        $spacingAfter = $isCompact ? 4 : 6;
        $pdf->Ln($spacingAfter);
    }

    /**
     * Shorten a URL for display (strip scheme, trailing slash, limit length)
     */
    private function shortenUrl(string $url): string
    {
        $display = preg_replace('#^https?://(www\.)?#', '', $url);
        $display = rtrim($display, '/');
        if (strlen($display) > 45) {
            $display = substr($display, 0, 42) . '...';
        }
        return $display;
    }

    /**
     * Render contact parts separated by |, wrapping to next line if too wide
     */
    private function renderWrappedContactLine(FPDF $pdf, array $parts, string $font, float $fontSize, float $w, float $m, string $align): void
    {
        $pdf->SetFont($font, '', $fontSize);
        $separator = '  |  ';
        $full = implode($separator, $parts);

        if ($pdf->GetStringWidth($this->toISO($full)) <= $w) {
            $pdf->SetX($m);
            $pdf->Cell($w, 5, $this->toISO($full), 0, 1, $align);
            return;
        }

        // Split into multiple lines
        $currentLine = [];
        foreach ($parts as $part) {
            $testLine = empty($currentLine) ? $part : implode($separator, array_merge($currentLine, [$part]));
            if ($pdf->GetStringWidth($this->toISO($testLine)) > $w && !empty($currentLine)) {
                $pdf->SetX($m);
                $pdf->Cell($w, 5, $this->toISO(implode($separator, $currentLine)), 0, 1, $align);
                $currentLine = [$part];
            } else {
                $currentLine[] = $part;
            }
        }
        if (!empty($currentLine)) {
            $pdf->SetX($m);
            $pdf->Cell($w, 5, $this->toISO(implode($separator, $currentLine)), 0, 1, $align);
        }
    }

    /**
     * Render a section header with configurable style
     */
    private function renderSectionHeader(FPDF $pdf, string $title, array $color, float $pageWidth, float $margin, string $style = 'bold_rule', float $titleSize = 12, float $ruleWeight = 0.25, string $font = 'CMUSerif'): void
    {
        $pdf->SetX($margin);

        switch ($style) {
            case 'smallcaps_rule':
                // Small-caps effect via uppercase + slightly smaller size
                $pdf->SetFont($font, 'B', $titleSize);
                $pdf->SetTextColor($color[0], $color[1], $color[2]);
                $pdf->Cell($pageWidth, 7, $this->toISO(strtoupper($title)), 0, 1, 'L');
                $pdf->SetDrawColor($color[0], $color[1], $color[2]);
                $pdf->SetLineWidth($ruleWeight);
                $y = $pdf->GetY();
                $pdf->Line($margin, $y, $margin + $pageWidth, $y);
                $pdf->Ln(3);
                break;

            case 'smallcaps_heavy_rule':
                $pdf->SetFont($font, 'B', $titleSize);
                $pdf->SetTextColor($color[0], $color[1], $color[2]);
                $pdf->Cell($pageWidth, 7, $this->toISO(strtoupper($title)), 0, 1, 'L');
                $pdf->SetDrawColor($color[0], $color[1], $color[2]);
                $pdf->SetLineWidth($ruleWeight);
                $y = $pdf->GetY();
                $pdf->Line($margin, $y, $margin + $pageWidth, $y);
                $pdf->Ln(3);
                break;

            case 'caps_no_rule':
                // Clean uppercase, no rule underneath
                $pdf->SetFont($font, 'B', $titleSize);
                $pdf->SetTextColor($color[0], $color[1], $color[2]);
                $pdf->Cell($pageWidth, 7, $this->toISO(strtoupper($title)), 0, 1, 'L');
                $pdf->Ln(2);
                break;

            default: // 'bold_rule' — legacy style
                $pdf->SetFont($font, 'B', 12);
                $pdf->SetTextColor(0, 0, 0);
                $pdf->Cell($pageWidth, 7, $this->toISO(strtoupper($title)), 0, 1, 'L');
                $pdf->SetDrawColor(0, 0, 0);
                $pdf->SetLineWidth(0.25);
                $y = $pdf->GetY();
                $pdf->Line($margin, $y, $margin + $pageWidth, $y);
                $pdf->Ln(4);
                break;
        }
    }

    /**
     * Render entries for a section
     */
    private function renderSectionEntries(FPDF $pdf, array $section, float $pageWidth, float $margin, float $pageHeight = 297.0): void
    {
        $key = $section['section_key'];
        $pdf->SetTextColor(40, 40, 40);

        // Reset publication counter at start of publications section
        if ($key === 'publications') {
            $this->pubCounter = 0;
        }

        $bottomMargin = 25;

        foreach ($section['entries'] as $entry) {
            $data = $entry['data'] ?? [];

            // Check page space — keep enough room for at least one entry
            if ($pdf->GetY() > ($pageHeight - $bottomMargin - 15)) {
                $pdf->AddPage();
                $pdf->SetY($bottomMargin);
            }

            switch ($key) {
                case 'education':
                    $this->renderEducationEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'experience':
                    $this->renderExperienceEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'publications':
                    $this->renderPublicationEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'skills':
                    $this->renderSkillsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'awards':
                    $this->renderAwardsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'references':
                    $this->renderReferencesEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'research_interests':
                    $this->renderResearchInterestsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'projects':
                    $this->renderProjectsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'teaching':
                    $this->renderTeachingEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'supervision':
                    $this->renderSupervisionEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'grants':
                    $this->renderGrantsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'conferences':
                    $this->renderConferencesEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'certifications':
                    $this->renderCertificationsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'languages':
                    $this->renderLanguagesEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'professional_memberships':
                    $this->renderMembershipsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'editorial':
                    $this->renderEditorialEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'academic_appointments':
                    $this->renderAcademicAppointmentsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'research_experience':
                    $this->renderResearchExperienceEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'academic_service':
                    $this->renderAcademicServiceEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'invited_talks':
                    $this->renderInvitedTalksEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'patents':
                    $this->renderPatentsEntry($pdf, $data, $pageWidth, $margin);
                    break;
                case 'academic_profile':
                    $this->renderAcademicProfileEntry($pdf, $data, $pageWidth, $margin);
                    break;
                default:
                    $this->renderGenericEntry($pdf, $data, $section['fields_schema'] ?? [], $pageWidth, $margin);
                    break;
            }
        }
    }

    private function renderEducationEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $degree = $this->toISO($d['degree'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $degree, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $pdf->SetX($m);
        $pdf->SetFont($f, 'I', 10);
        $institution = $this->toISO($d['institution'] ?? '');
        $location = $this->toISO($d['location'] ?? '');
        $instLine = $institution;
        if ($location) $instLine .= ', ' . $location;
        $pdf->Cell($w, 5, $instLine, 0, 1, 'L');

        if (!empty($d['thesis'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, 'I', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO('Thesis: ' . $d['thesis']), 0, 'L');
        }

        if (!empty($d['supervisor'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Supervisor: ' . $d['supervisor']), 0, 1, 'L');
        }

        if (!empty($d['gpa'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('GPA: ' . $d['gpa']), 0, 1, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderExperienceEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $position = $this->toISO($d['position'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $position, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $pdf->SetX($m);
        $pdf->SetFont($f, 'I', 10);
        $org = $this->toISO($d['organization'] ?? '');
        $location = $this->toISO($d['location'] ?? '');
        $orgLine = $org;
        if ($location) $orgLine .= ', ' . $location;
        $pdf->Cell($w, 5, $orgLine, 0, 1, 'L');

        if (!empty($d['department'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Department: ' . $d['department']), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private int $pubCounter = 0;

    private function renderPublicationEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $this->pubCounter++;
        $numLabel = '[' . $this->pubCounter . ']';
        $indent = 12;

        // Number label
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 9.5);
        $pdf->Cell($indent, 5, $this->toISO($numLabel), 0, 0, 'L');

        // Build citation: Authors (Year). "Title." Venue, Vol/Issue/Pages. Status. DOI
        $pdf->SetFont($f, '', 9.5);
        $text = '';
        if (!empty($d['authors'])) $text .= $d['authors'];
        if (!empty($d['year'])) $text .= ' (' . $d['year'] . '). ';
        else $text .= '. ';
        if (!empty($d['title'])) $text .= chr(34) . $d['title'] . '.' . chr(34) . ' ';
        if (!empty($d['venue'])) {
            $text .= $d['venue'];
            // Add volume/issue/pages — support both combined and separate fields
            if (!empty($d['volume_issue_pages'])) {
                $text .= ', ' . $d['volume_issue_pages'];
            } else {
                $volParts = [];
                if (!empty($d['volume'])) {
                    $vol = $d['volume'];
                    if (!empty($d['issue'])) $vol .= '(' . $d['issue'] . ')';
                    $volParts[] = $vol;
                }
                if (!empty($d['pages'])) $volParts[] = $d['pages'];
                if (!empty($volParts)) $text .= ', ' . implode(', ', $volParts);
            }
            $text .= '. ';
        }
        if (!empty($d['publication_type'])) {
            $text .= '[' . $d['publication_type'] . '] ';
        }
        if (!empty($d['status']) && strtolower($d['status']) !== 'published') {
            $text .= '[' . $d['status'] . '] ';
        }
        if (!empty($d['doi'])) $text .= 'DOI: ' . $d['doi'];

        $pdf->MultiCell($w - $indent, 4.5, $this->toISO(trim($text)), 0, 'L');

        // Candidate role note or contribution note
        $notes = [];
        if (!empty($d['candidate_role_note'])) $notes[] = $d['candidate_role_note'];
        if (!empty($d['contribution_note'])) $notes[] = $d['contribution_note'];
        if (!empty($notes)) {
            $pdf->SetX($m + $indent);
            $pdf->SetFont($f, 'I', 8.5);
            $pdf->Cell($w - $indent, 4, $this->toISO(implode(' | ', $notes)), 0, 1, 'L');
        }

        $pdf->Ln(2.5);
    }

    private function renderSkillsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10);
        $cat = $this->toISO($d['category'] ?? '');
        $catWidth = $pdf->GetStringWidth($cat . ': ') + 2;
        $pdf->Cell($catWidth, 5.5, $cat . ':', 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->MultiCell($w - $catWidth, 5.5, $this->toISO($d['skills'] ?? ''), 0, 'L');
        $pdf->Ln(2);
    }

    private function renderAwardsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $org = $this->toISO($d['organization'] ?? '');

        $left = $title;
        if ($org) $left .= ' -- ' . $org;
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        if (!empty($d['level'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, 'I', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO($d['level']), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderReferencesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10);
        $pdf->Cell($w, 5, $this->toISO($d['name'] ?? ''), 0, 1, 'L');

        $details = [];
        if (!empty($d['title'])) $details[] = $d['title'];
        if (!empty($d['affiliation'])) $details[] = $d['affiliation'];
        if (!empty($details)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode(', ', $details)), 0, 1, 'L');
        }

        if (!empty($d['relationship'])) {
            $pdf->SetX($m);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO('(' . $d['relationship'] . ')'), 0, 1, 'L');
        }

        $contact = [];
        if (!empty($d['email'])) $contact[] = $d['email'];
        if (!empty($d['phone'])) $contact[] = $d['phone'];
        if (!empty($contact)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode('  |  ', $contact)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderAcademicProfileEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $summary = $d['summary'] ?? '';
        if (empty($summary)) return;
        $pdf->SetX($m);
        $pdf->SetFont($f, '', 10);
        $pdf->SetTextColor(40, 40, 40);
        $pdf->MultiCell($w, 5, $this->toISO($summary), 0, 'J');
        $pdf->Ln(2);
    }

    private function renderResearchInterestsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10);
        $area = $this->toISO($d['area'] ?? '');
        $pdf->Cell($w, 5.5, $area, 0, 1, 'L');

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }

        if (!empty($d['keywords'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, 'I', 9);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO('Keywords: ' . $d['keywords']), 0, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderProjectsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        $org = $d['organization'] ?? $d['funding_agency'] ?? '';
        if ($org) $subParts[] = $org;
        if (!empty($d['amount'])) $subParts[] = $d['amount'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['collaborators'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Collaborators: ' . $d['collaborators']), 0, 1, 'L');
        }

        if (!empty($d['outputs'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Outputs: ' . $d['outputs']), 0, 1, 'L');
        }

        if (!empty($d['tools_methods'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, 'I', 9);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Tools: ' . $d['tools_methods']), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderTeachingEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $course = $this->toISO($d['course'] ?? '');
        if (!empty($d['code'])) $course .= ' (' . $this->toISO($d['code']) . ')';
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $course, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        if (!empty($d['institution'])) $subParts[] = $d['institution'];
        if (!empty($d['level'])) $subParts[] = $d['level'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderSupervisionEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $name = $this->toISO($d['student_name'] ?? '');
        $degree = $this->toISO($d['degree'] ?? '');
        $left = $name;
        if ($degree) $left .= ' (' . $degree . ')';
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Ongoing'));
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        if (!empty($d['thesis_title'])) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 9.5);
            $pdf->MultiCell($w, 4.5, $this->toISO($d['thesis_title']), 0, 'L');
        }

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        if (!empty($d['institution'])) $subParts[] = $d['institution'];
        if (!empty($d['status'])) $subParts[] = $d['status'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode(' | ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderGrantsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['agency'])) $subParts[] = $d['agency'];
        if (!empty($d['amount'])) $subParts[] = $d['amount'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(' -- ', $subParts)), 0, 1, 'L');
        }

        $extraParts = [];
        if (!empty($d['role'])) $extraParts[] = 'Role: ' . $d['role'];
        if (!empty($d['grant_number'])) $extraParts[] = 'Grant #: ' . $d['grant_number'];
        if (!empty($d['status'])) $extraParts[] = 'Status: ' . $d['status'];
        if (!empty($extraParts)) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO(implode(' | ', $extraParts)), 0, 1, 'L');
        }

        if (!empty($d['collaborators'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, 'I', 9);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Collaborators: ' . $d['collaborators']), 0, 1, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderConferencesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['conference'])) $subParts[] = $d['conference'];
        if (!empty($d['location'])) $subParts[] = $d['location'];
        if (!empty($d['type'])) $subParts[] = '(' . $d['type'] . ')';
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderCertificationsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['issuer'])) $subParts[] = $d['issuer'];
        if (!empty($d['credential_id'])) $subParts[] = 'ID: ' . $d['credential_id'];
        if (!empty($d['expiry'])) $subParts[] = 'Expires: ' . $d['expiry'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(' | ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderLanguagesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10);
        $lang = $this->toISO($d['language'] ?? '');
        $langWidth = $pdf->GetStringWidth($lang . ': ') + 2;
        $pdf->Cell($langWidth, 5.5, $lang . ':', 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w - $langWidth, 5.5, $this->toISO($d['proficiency'] ?? ''), 0, 1, 'L');
        $pdf->Ln(2);
    }

    private function renderMembershipsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $org = $this->toISO($d['organization'] ?? '');
        $role = $this->toISO($d['role'] ?? '');
        $left = $org;
        if ($role) $left .= ' -- ' . $role;
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');
        $pdf->Ln(3);
    }

    private function renderEditorialEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $journal = $this->toISO($d['journal'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $journal, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        if (!empty($d['role'])) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO($d['role']), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    // ===== New Pro Template Section Renderers =====

    private function renderAcademicAppointmentsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $position = $this->toISO($d['position'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $position, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['department'])) $subParts[] = $d['department'];
        if (!empty($d['institution'])) $subParts[] = $d['institution'];
        if (!empty($d['location'])) $subParts[] = $d['location'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['status'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO($d['status']), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderResearchExperienceEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $role = $this->toISO($d['role'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $role, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['lab_or_center'])) $subParts[] = $d['lab_or_center'];
        if (!empty($d['institution'])) $subParts[] = $d['institution'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['supervisor'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('Supervisor: ' . $d['supervisor']), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderAcademicServiceEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $activity = $this->toISO($d['activity'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $activity, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        if (!empty($d['organization'])) $subParts[] = $d['organization'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln($this->entrySpacing);
    }

    private function renderInvitedTalksEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['host'])) $subParts[] = $d['host'];
        if (!empty($d['event'])) $subParts[] = $d['event'];
        if (!empty($d['location'])) $subParts[] = $d['location'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['type'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('(' . $d['type'] . ')'), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderPatentsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m);
        $pdf->SetFont($f, 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont($f, '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        if (!empty($d['inventors'])) {
            $pdf->SetX($m);
            $pdf->SetFont($f, '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO($d['inventors']), 0, 1, 'L');
        }

        $subParts = [];
        if (!empty($d['patent_number'])) $subParts[] = $d['patent_number'];
        if (!empty($d['jurisdiction'])) $subParts[] = $d['jurisdiction'];
        if (!empty($d['status'])) $subParts[] = $d['status'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont($f, 'I', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode(' | ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderGenericEntry(FPDF $pdf, array $d, array $fields, float $w, float $m): void
    {
        $f = $this->fontFamily;
        $pdf->SetX($m + 3);
        $pdf->SetFont($f, '', 9);
        $parts = [];
        foreach ($fields as $field) {
            $val = $d[$field['name']] ?? '';
            if ($val !== '') $parts[] = $field['label'] . ': ' . $val;
        }
        $pdf->MultiCell($w - 3, 4, $this->toISO(implode(' | ', $parts)), 0, 'L');
        $pdf->Ln(1);
    }

    // ===== LaTeX rendering helpers (kept for pdflatex path) =====

    private function renderSection(string $latexCode, array $data): string
    {
        $result = $latexCode;
        foreach ($data as $key => $value) {
            $safeValue = $this->escapeLatex($value);
            $result = str_replace('{{' . $key . '}}', $safeValue, $result);
        }

        $result = preg_replace_callback(
            '/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/s',
            function ($matches) use ($data) {
                $field = $matches[1];
                $content = $matches[2];
                if (!empty($data[$field])) {
                    foreach ($data as $k => $v) {
                        $content = str_replace('{{' . $k . '}}', $this->escapeLatex($v), $content);
                    }
                    return $content;
                }
                return '';
            },
            $result
        );

        $result = preg_replace('/\{\{\w+\}\}/', '', $result);
        return $result;
    }

    private function renderRepeatingSection(string $latexCode, array $entries): string
    {
        if (preg_match('/^(.*?)\{\{#entries\}\}(.*?)\{\{\/entries\}\}(.*?)$/s', $latexCode, $matches)) {
            $header = $matches[1];
            $entryTemplate = $matches[2];
            $footer = $matches[3];

            $renderedEntries = '';
            foreach ($entries as $entry) {
                $entryData = $entry['data'] ?? [];
                $rendered = $entryTemplate;

                foreach ($entryData as $key => $value) {
                    $rendered = str_replace('{{' . $key . '}}', $this->escapeLatex($value), $rendered);
                }

                $rendered = preg_replace_callback(
                    '/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/s',
                    function ($m) use ($entryData) {
                        if (!empty($entryData[$m[1]])) {
                            $c = $m[2];
                            foreach ($entryData as $k => $v) {
                                $c = str_replace('{{' . $k . '}}', $this->escapeLatex($v), $c);
                            }
                            return $c;
                        }
                        return '';
                    },
                    $rendered
                );

                $rendered = preg_replace('/\{\{\w+\}\}/', '', $rendered);
                $renderedEntries .= $rendered;
            }

            return $header . $renderedEntries . $footer;
        }

        return $latexCode;
    }

    private function escapeLatex(string $text): string
    {
        $map = [
            '\\' => '\\textbackslash{}',
            '{'  => '\\{',
            '}'  => '\\}',
            '$'  => '\\$',
            '&'  => '\\&',
            '#'  => '\\#',
            '^'  => '\\^{}',
            '_'  => '\\_',
            '~'  => '\\~{}',
            '%'  => '\\%',
        ];
        return strtr($text, $map);
    }

    // ===== Utility helpers =====

    private function hexToRGB(string $hex): array
    {
        $hex = ltrim($hex, '#');
        return [
            hexdec(substr($hex, 0, 2)),
            hexdec(substr($hex, 2, 2)),
            hexdec(substr($hex, 4, 2)),
        ];
    }

    private function parseMargin(string $margin): float
    {
        $value = (float) $margin;
        if (str_contains($margin, 'in')) {
            return $value * 25.4; // inches to mm
        }
        if (str_contains($margin, 'cm')) {
            return $value * 10;   // cm to mm
        }
        return $value;
    }

    /**
     * Convert UTF-8 to ISO-8859-1 for FPDF compatibility
     */
    private function toISO(string $text): string
    {
        return iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $text) ?: $text;
    }

    private function cleanTempDir(string $dir): void
    {
        if (!is_dir($dir)) return;

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getPathname());
            } else {
                unlink($file->getPathname());
            }
        }
        rmdir($dir);
    }
}
