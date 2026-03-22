<?php
/**
 * LaTeX Service - Generates and compiles LaTeX documents
 * Falls back to FPDF when pdflatex is not available
 */

require_once APP_PATH . '/lib/fpdf.php';

class LatexService
{
    private CVProfile $cvModel;
    private Template $templateModel;

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

        // Parse primary color from hex
        $primaryColor = $this->hexToRGB($styleConfig['primaryColor'] ?? '#003366');

        $pdf = new FPDF('P', 'mm', 'A4');
        $pdf->SetAutoPageBreak(true, 20);

        // Load Computer Modern Unicode fonts (classical LaTeX look)
        $fontPath = APP_PATH . '/lib/font/cmfonts/';
        $pdf->AddFont('CMUSerif', '', 'cmunrm.php');
        $pdf->AddFont('CMUSerif', 'B', 'cmunbx.php');
        $pdf->AddFont('CMUSerif', 'I', 'cmunti.php');
        $pdf->AddFont('CMUSerif', 'BI', 'cmunbi.php');
        $pdf->AddFont('CMUSans', '', 'cmunss.php');
        $pdf->AddFont('CMUSans', 'B', 'cmunsx.php');
        $pdf->AddFont('CMUMono', '', 'cmuntt.php');

        $pdf->AddPage();

        // Margins
        $marginStr = $styleConfig['margins'] ?? '1in';
        $marginMM = $this->parseMargin($marginStr);
        $pdf->SetMargins($marginMM, $marginMM, $marginMM);
        $pdf->SetX($marginMM);
        $pdf->SetY($marginMM);

        $pageWidth = 210 - (2 * $marginMM);

        // === PERSONAL INFO HEADER ===
        $fullName = $personalInfo['full_name'] ?? '';
        $title = $personalInfo['title'] ?? '';
        $affiliation = $personalInfo['affiliation'] ?? '';
        $email = $personalInfo['email'] ?? '';
        $phone = $personalInfo['phone'] ?? '';
        $website = $personalInfo['website'] ?? '';
        $orcid = $personalInfo['orcid'] ?? '';
        $address = $personalInfo['address'] ?? '';

        // Name - large, bold, centered
        $pdf->SetFont('CMUSerif', 'B', 22);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->Cell($pageWidth, 10, $this->toISO($fullName), 0, 1, 'C');
        $pdf->Ln(1);

        // Thin rule under name
        $pdf->SetDrawColor(0, 0, 0);
        $pdf->SetLineWidth(0.3);
        $y = $pdf->GetY();
        $pdf->Line($marginMM, $y, $marginMM + $pageWidth, $y);
        $pdf->Ln(3);

        // Title & Affiliation
        if ($title || $affiliation) {
            $pdf->SetFont('CMUSerif', '', 11);
            $pdf->SetTextColor(0, 0, 0);
            $titleLine = $title;
            if ($affiliation) $titleLine .= ($title ? ', ' : '') . $affiliation;
            $pdf->Cell($pageWidth, 6, $this->toISO($titleLine), 0, 1, 'C');
        }

        // Address line
        if ($address) {
            $pdf->SetFont('CMUSerif', '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($pageWidth, 5, $this->toISO($address), 0, 1, 'C');
        }

        // Contact line
        $contactParts = [];
        if ($email) $contactParts[] = $email;
        if ($phone) $contactParts[] = $phone;
        if (!empty($contactParts)) {
            $pdf->SetFont('CMUSerif', '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($pageWidth, 5, $this->toISO(implode('  |  ', $contactParts)), 0, 1, 'C');
        }

        // Second contact line (web, ORCID)
        $webParts = [];
        if ($website) $webParts[] = $website;
        if ($orcid) $webParts[] = 'ORCID: ' . $orcid;
        if (!empty($webParts)) {
            $pdf->SetFont('CMUSerif', '', 10);
            $pdf->SetTextColor(0, 0, 0);
            $pdf->Cell($pageWidth, 5, $this->toISO(implode('  |  ', $webParts)), 0, 1, 'C');
        }

        $pdf->Ln(6);

        // Publication counter for numbered lists
        $this->pubCounter = 0;

        // === SECTIONS ===
        foreach ($sections as $section) {
            if (empty($section['is_visible'])) continue;
            if ($section['section_key'] === 'personal_info') continue;
            if (empty($section['entries'])) continue;

            // Check page space
            if ($pdf->GetY() > 260) {
                $pdf->AddPage();
                $pdf->SetY($marginMM);
            }

            // Section header with line
            $this->renderSectionHeader($pdf, $section['display_name'], $primaryColor, $pageWidth, $marginMM);

            // Section entries
            $this->renderSectionEntries($pdf, $section, $pageWidth, $marginMM);

            $pdf->Ln(4);
        }

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
     * Render a section header with underline (classical style)
     */
    private function renderSectionHeader(FPDF $pdf, string $title, array $color, float $pageWidth, float $margin): void
    {
        $pdf->Ln(2);
        $pdf->SetFont('CMUSerif', 'B', 12);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetX($margin);
        $pdf->Cell($pageWidth, 7, $this->toISO(strtoupper($title)), 0, 1, 'L');

        // Draw thin rule under section title
        $pdf->SetDrawColor(0, 0, 0);
        $pdf->SetLineWidth(0.25);
        $y = $pdf->GetY();
        $pdf->Line($margin, $y, $margin + $pageWidth, $y);
        $pdf->Ln(4);
    }

    /**
     * Render entries for a section
     */
    private function renderSectionEntries(FPDF $pdf, array $section, float $pageWidth, float $margin): void
    {
        $key = $section['section_key'];
        $pdf->SetTextColor(40, 40, 40);

        // Reset publication counter at start of publications section
        if ($key === 'publications') {
            $this->pubCounter = 0;
        }

        foreach ($section['entries'] as $entry) {
            $data = $entry['data'] ?? [];

            // Check page space
            if ($pdf->GetY() > 265) {
                $pdf->AddPage();
                $pdf->SetY(25);
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
                default:
                    $this->renderGenericEntry($pdf, $data, $section['fields_schema'] ?? [], $pageWidth, $margin);
                    break;
            }
        }
    }

    private function renderEducationEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $degree = $this->toISO($d['degree'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $degree, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'I', 10);
        $institution = $this->toISO($d['institution'] ?? '');
        $location = $this->toISO($d['location'] ?? '');
        $instLine = $institution;
        if ($location) $instLine .= ', ' . $location;
        $pdf->Cell($w, 5, $instLine, 0, 1, 'L');

        if (!empty($d['thesis'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', 'I', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO('Thesis: ' . $d['thesis']), 0, 'L');
        }

        if (!empty($d['gpa'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO('GPA: ' . $d['gpa']), 0, 1, 'L');
        }
        $pdf->Ln(4);
    }

    private function renderExperienceEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $position = $this->toISO($d['position'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $position, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'I', 10);
        $org = $this->toISO($d['organization'] ?? '');
        $location = $this->toISO($d['location'] ?? '');
        $orgLine = $org;
        if ($location) $orgLine .= ', ' . $location;
        $pdf->Cell($w, 5, $orgLine, 0, 1, 'L');

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln(4);
    }

    private int $pubCounter = 0;

    private function renderPublicationEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $this->pubCounter++;
        $numLabel = '[' . $this->pubCounter . ']';
        $indent = 12; // mm for hanging indent

        // Number label
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 9.5);
        $pdf->Cell($indent, 5, $this->toISO($numLabel), 0, 0, 'L');

        // Build citation text: Authors (Year). "Title." Venue. DOI: xxx
        $pdf->SetFont('CMUSerif', '', 9.5);
        $text = '';
        if (!empty($d['authors'])) $text .= $d['authors'];
        if (!empty($d['year'])) $text .= ' (' . $d['year'] . '). ';
        else $text .= '. ';
        if (!empty($d['title'])) $text .= chr(34) . $d['title'] . '.' . chr(34) . ' ';
        if (!empty($d['venue'])) $text .= $d['venue'] . '. ';
        if (!empty($d['doi'])) $text .= 'DOI: ' . $d['doi'];

        $pdf->MultiCell($w - $indent, 4.5, $this->toISO(trim($text)), 0, 'L');
        $pdf->Ln(2.5);
    }

    private function renderSkillsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10);
        $cat = $this->toISO($d['category'] ?? '');
        $catWidth = $pdf->GetStringWidth($cat . ': ') + 2;
        $pdf->Cell($catWidth, 5.5, $cat . ':', 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->MultiCell($w - $catWidth, 5.5, $this->toISO($d['skills'] ?? ''), 0, 'L');
        $pdf->Ln(2);
    }

    private function renderAwardsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $org = $this->toISO($d['organization'] ?? '');

        $left = $title;
        if ($org) $left .= ' -- ' . $org;
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderReferencesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10);
        $pdf->Cell($w, 5, $this->toISO($d['name'] ?? ''), 0, 1, 'L');

        $details = [];
        if (!empty($d['title'])) $details[] = $d['title'];
        if (!empty($d['affiliation'])) $details[] = $d['affiliation'];
        if (!empty($details)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode(', ', $details)), 0, 1, 'L');
        }

        $contact = [];
        if (!empty($d['email'])) $contact[] = $d['email'];
        if (!empty($d['phone'])) $contact[] = $d['phone'];
        if (!empty($contact)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode('  |  ', $contact)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderResearchInterestsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10);
        $area = $this->toISO($d['area'] ?? '');
        $pdf->Cell($w, 5.5, $area, 0, 1, 'L');

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }

        if (!empty($d['keywords'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', 'I', 9);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO('Keywords: ' . $d['keywords']), 0, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderProjectsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        $org = $d['organization'] ?? $d['funding_agency'] ?? '';
        if ($org) $subParts[] = $org;
        if (!empty($d['amount'])) $subParts[] = $d['amount'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln(4);
    }

    private function renderTeachingEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $course = $this->toISO($d['course'] ?? '');
        if (!empty($d['code'])) $course .= ' (' . $this->toISO($d['code']) . ')';
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $course, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        if (!empty($d['institution'])) $subParts[] = $d['institution'];
        if (!empty($d['level'])) $subParts[] = $d['level'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }

        if (!empty($d['description'])) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->MultiCell($w - 3, 4.5, $this->toISO($d['description']), 0, 'L');
        }
        $pdf->Ln(4);
    }

    private function renderSupervisionEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $name = $this->toISO($d['student_name'] ?? '');
        $degree = $this->toISO($d['degree'] ?? '');
        $left = $name;
        if ($degree) $left .= ' (' . $degree . ')';
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Ongoing'));
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        if (!empty($d['thesis_title'])) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 9.5);
            $pdf->MultiCell($w, 4.5, $this->toISO($d['thesis_title']), 0, 'L');
        }

        $subParts = [];
        if (!empty($d['role'])) $subParts[] = $d['role'];
        if (!empty($d['status'])) $subParts[] = $d['status'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->Cell($w, 4.5, $this->toISO(implode(' | ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderGrantsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['agency'])) $subParts[] = $d['agency'];
        if (!empty($d['amount'])) $subParts[] = $d['amount'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(' -- ', $subParts)), 0, 1, 'L');
        }

        $extraParts = [];
        if (!empty($d['role'])) $extraParts[] = 'Role: ' . $d['role'];
        if (!empty($d['status'])) $extraParts[] = 'Status: ' . $d['status'];
        if (!empty($extraParts)) {
            $pdf->SetX($m + 3);
            $pdf->SetFont('CMUSerif', '', 9.5);
            $pdf->Cell($w - 3, 4.5, $this->toISO(implode(' | ', $extraParts)), 0, 1, 'L');
        }
        $pdf->Ln(4);
    }

    private function renderConferencesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['conference'])) $subParts[] = $d['conference'];
        if (!empty($d['location'])) $subParts[] = $d['location'];
        if (!empty($d['type'])) $subParts[] = '(' . $d['type'] . ')';
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(', ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderCertificationsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $title = $this->toISO($d['title'] ?? '');
        $year = $this->toISO($d['year'] ?? '');
        $pdf->Cell($w * 0.75, 6, $title, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $year, 0, 1, 'R');

        $subParts = [];
        if (!empty($d['issuer'])) $subParts[] = $d['issuer'];
        if (!empty($d['credential_id'])) $subParts[] = 'ID: ' . $d['credential_id'];
        if (!empty($d['expiry'])) $subParts[] = 'Expires: ' . $d['expiry'];
        if (!empty($subParts)) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO(implode(' | ', $subParts)), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderLanguagesEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10);
        $lang = $this->toISO($d['language'] ?? '');
        $langWidth = $pdf->GetStringWidth($lang . ': ') + 2;
        $pdf->Cell($langWidth, 5.5, $lang . ':', 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w - $langWidth, 5.5, $this->toISO($d['proficiency'] ?? ''), 0, 1, 'L');
        $pdf->Ln(2);
    }

    private function renderMembershipsEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $org = $this->toISO($d['organization'] ?? '');
        $role = $this->toISO($d['role'] ?? '');
        $left = $org;
        if ($role) $left .= ' -- ' . $role;
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $left, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');
        $pdf->Ln(3);
    }

    private function renderEditorialEntry(FPDF $pdf, array $d, float $w, float $m): void
    {
        $pdf->SetX($m);
        $pdf->SetFont('CMUSerif', 'B', 10.5);
        $journal = $this->toISO($d['journal'] ?? '');
        $years = $this->toISO(($d['year_start'] ?? '') . ' -- ' . ($d['year_end'] ?? 'Present'));
        $pdf->Cell($w * 0.75, 6, $journal, 0, 0, 'L');
        $pdf->SetFont('CMUSerif', '', 10);
        $pdf->Cell($w * 0.25, 6, $years, 0, 1, 'R');

        if (!empty($d['role'])) {
            $pdf->SetX($m);
            $pdf->SetFont('CMUSerif', 'I', 10);
            $pdf->Cell($w, 5, $this->toISO($d['role']), 0, 1, 'L');
        }
        $pdf->Ln(3);
    }

    private function renderGenericEntry(FPDF $pdf, array $d, array $fields, float $w, float $m): void
    {
        $pdf->SetX($m + 3);
        $pdf->SetFont('CMUSerif', '', 9);
        $parts = [];
        foreach ($fields as $f) {
            $val = $d[$f['name']] ?? '';
            if ($val !== '') $parts[] = $f['label'] . ': ' . $val;
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
