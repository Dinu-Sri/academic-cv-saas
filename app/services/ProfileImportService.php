<?php
/**
 * Profile Import Service
 * Fetches academic profile data from ORCID and Google Scholar
 */
class ProfileImportService
{
    /**
     * Import from ORCID using their public API
     */
    public function importFromOrcid(string $orcidId): array
    {
        // Clean ORCID ID - accept URL or plain ID
        $orcidId = $this->parseOrcidId($orcidId);
        if (!$orcidId) {
            return ['success' => false, 'error' => 'Invalid ORCID ID format. Use format: 0000-0000-0000-0000'];
        }

        $url = "https://pub.orcid.org/v3.0/{$orcidId}";
        $data = $this->fetchJson($url, ['Accept: application/json']);

        if (!$data) {
            return ['success' => false, 'error' => 'Could not fetch ORCID profile. Check the ID and try again.'];
        }

        $result = [
            'success' => true,
            'source'  => 'orcid',
            'profile' => $this->parseOrcidProfile($data, $orcidId),
            'works'   => $this->fetchOrcidWorks($orcidId),
            'education'  => $this->parseOrcidEducation($data),
            'employment' => $this->parseOrcidEmployment($data),
        ];

        return $result;
    }

    /**
     * Import from Google Scholar by scraping the public profile page
     */
    public function importFromScholar(string $scholarInput): array
    {
        $scholarId = $this->parseScholarId($scholarInput);
        if (!$scholarId) {
            return ['success' => false, 'error' => 'Invalid Google Scholar profile URL or ID.'];
        }

        $url = "https://scholar.google.com/citations?user={$scholarId}&hl=en&cstart=0&pagesize=100";
        $html = $this->fetchHtml($url);

        if (!$html) {
            return ['success' => false, 'error' => 'Could not fetch Google Scholar profile. The profile may be private or the ID incorrect.'];
        }

        $profile = $this->parseScholarProfile($html, $scholarId);
        $publications = $this->parseScholarPublications($html);

        return [
            'success'      => true,
            'source'       => 'google_scholar',
            'profile'      => $profile,
            'publications' => $publications,
        ];
    }

    // ===== ORCID Parsing =====

    private function parseOrcidId(string $input): ?string
    {
        $input = trim($input);

        // Match ORCID pattern: 0000-0000-0000-000X
        if (preg_match('/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/', $input, $m)) {
            return $m[1];
        }

        return null;
    }

    private function parseOrcidProfile(array $data, string $orcidId): array
    {
        $person = $data['person'] ?? [];
        $name = $person['name'] ?? [];

        $profile = [
            'orcid_id'    => $orcidId,
            'full_name'   => trim(($name['given-names']['value'] ?? '') . ' ' . ($name['family-name']['value'] ?? '')),
            'affiliation' => '',
            'title'       => '',
        ];

        // Get affiliations from employment
        $activities = $data['activities-summary'] ?? [];
        $employments = $activities['employments']['affiliation-group'] ?? [];

        if (!empty($employments)) {
            $latest = $employments[0]['summaries'][0]['employment-summary'] ?? [];
            $profile['affiliation'] = $latest['organization']['name'] ?? '';
            $profile['title'] = $latest['role-title'] ?? '';
        }

        // Get emails
        $emails = $person['emails']['email'] ?? [];
        foreach ($emails as $email) {
            if (!empty($email['email'])) {
                $profile['email'] = $email['email'];
                break;
            }
        }

        // Get URLs
        $urls = $person['researcher-urls']['researcher-url'] ?? [];
        foreach ($urls as $url) {
            if (!empty($url['url']['value'])) {
                $profile['website'] = $url['url']['value'];
                break;
            }
        }

        return $profile;
    }

    private function fetchOrcidWorks(string $orcidId): array
    {
        $url = "https://pub.orcid.org/v3.0/{$orcidId}/works";
        $data = $this->fetchJson($url, ['Accept: application/json']);

        if (!$data) return [];

        $works = [];
        $groups = $data['group'] ?? [];

        foreach ($groups as $group) {
            $summary = $group['work-summary'][0] ?? [];

            $work = [
                'title'   => $summary['title']['title']['value'] ?? '',
                'year'    => $summary['publication-date']['year']['value'] ?? '',
                'venue'   => $summary['journal-title']['value'] ?? '',
                'doi'     => '',
                'authors' => '',
                'source'  => 'orcid',
            ];

            // Get DOI from external IDs
            $extIds = $summary['external-ids']['external-id'] ?? [];
            foreach ($extIds as $extId) {
                if (($extId['external-id-type'] ?? '') === 'doi') {
                    $work['doi'] = $extId['external-id-value'] ?? '';
                    break;
                }
            }

            if (!empty($work['title'])) {
                $works[] = $work;
            }
        }

        return $works;
    }

    // ===== Google Scholar Parsing =====

    private function parseOrcidEducation(array $data): array
    {
        $activities = $data['activities-summary'] ?? [];
        $eduGroups = $activities['educations']['affiliation-group'] ?? [];
        $education = [];

        foreach ($eduGroups as $group) {
            $summary = $group['summaries'][0]['education-summary'] ?? [];
            $entry = [
                'degree'      => $summary['role-title'] ?? '',
                'institution' => $summary['organization']['name'] ?? '',
                'location'    => '',
                'year_start'  => $summary['start-date']['year']['value'] ?? '',
                'year_end'    => $summary['end-date']['year']['value'] ?? 'Present',
            ];

            // Build location from org address
            $addr = $summary['organization']['address'] ?? [];
            $parts = array_filter([$addr['city'] ?? '', $addr['country'] ?? '']);
            $entry['location'] = implode(', ', $parts);

            if (!empty($entry['institution'])) {
                $education[] = $entry;
            }
        }

        return $education;
    }

    private function parseOrcidEmployment(array $data): array
    {
        $activities = $data['activities-summary'] ?? [];
        $empGroups = $activities['employments']['affiliation-group'] ?? [];
        $employment = [];

        foreach ($empGroups as $group) {
            $summary = $group['summaries'][0]['employment-summary'] ?? [];
            $entry = [
                'position'     => $summary['role-title'] ?? '',
                'organization' => $summary['organization']['name'] ?? '',
                'location'     => '',
                'year_start'   => $summary['start-date']['year']['value'] ?? '',
                'year_end'     => $summary['end-date']['year']['value'] ?? 'Present',
            ];

            $addr = $summary['organization']['address'] ?? [];
            $parts = array_filter([$addr['city'] ?? '', $addr['country'] ?? '']);
            $entry['location'] = implode(', ', $parts);

            if (!empty($entry['organization'])) {
                $employment[] = $entry;
            }
        }

        return $employment;
    }

    private function parseScholarId(string $input): ?string
    {
        $input = trim($input);

        // Extract user ID from URL
        if (preg_match('/[?&]user=([a-zA-Z0-9_-]+)/', $input, $m)) {
            return $m[1];
        }

        // Plain ID (12 chars, alphanumeric)
        if (preg_match('/^[a-zA-Z0-9_-]{10,14}$/', $input)) {
            return $input;
        }

        return null;
    }

    private function parseScholarProfile(string $html, string $scholarId): array
    {
        $profile = [
            'google_scholar_id' => $scholarId,
            'full_name'         => '',
            'affiliation'       => '',
            'title'             => '',
        ];

        // Name
        if (preg_match('/<div id="gsc_prf_in"[^>]*>(.*?)<\/div>/s', $html, $m)) {
            $profile['full_name'] = html_entity_decode(strip_tags(trim($m[1])), ENT_QUOTES, 'UTF-8');
        }

        // Affiliation
        if (preg_match('/<div class="gsc_prf_il"[^>]*>(.*?)<\/div>/s', $html, $m)) {
            $profile['affiliation'] = html_entity_decode(strip_tags(trim($m[1])), ENT_QUOTES, 'UTF-8');
        }

        // Interests/keywords
        if (preg_match_all('/<a class="gsc_prf_inta[^"]*"[^>]*>(.*?)<\/a>/s', $html, $m)) {
            $profile['interests'] = array_map(function ($t) {
                return html_entity_decode(strip_tags(trim($t)), ENT_QUOTES, 'UTF-8');
            }, $m[1]);
        }

        // Citation stats
        if (preg_match_all('/<td class="gsc_rsb_std">([\d,]+)<\/td>/', $html, $m)) {
            $stats = $m[1];
            $profile['citation_stats'] = [
                'total_citations' => (int) str_replace(',', '', $stats[0] ?? '0'),
                'h_index'         => (int) str_replace(',', '', $stats[2] ?? '0'),
                'i10_index'       => (int) str_replace(',', '', $stats[4] ?? '0'),
            ];
        }

        return $profile;
    }

    private function parseScholarPublications(string $html): array
    {
        $publications = [];

        // Match publication rows
        if (preg_match_all('/<tr class="gsc_a_tr">(.*?)<\/tr>/s', $html, $rows)) {
            foreach ($rows[1] as $row) {
                $pub = ['source' => 'google_scholar'];

                // Title
                if (preg_match('/<a[^>]*class="gsc_a_at"[^>]*>(.*?)<\/a>/s', $row, $m)) {
                    $pub['title'] = html_entity_decode(strip_tags(trim($m[1])), ENT_QUOTES, 'UTF-8');
                }

                // Authors and venue (in gsc_a_t div, after the title link)
                if (preg_match_all('/<div class="gs_gray">(.*?)<\/div>/s', $row, $m)) {
                    if (!empty($m[1][0])) {
                        $pub['authors'] = html_entity_decode(strip_tags(trim($m[1][0])), ENT_QUOTES, 'UTF-8');
                    }
                    if (!empty($m[1][1])) {
                        $pub['venue'] = html_entity_decode(strip_tags(trim($m[1][1])), ENT_QUOTES, 'UTF-8');
                    }
                }

                // Citation count
                if (preg_match('/<a[^>]*class="gsc_a_ac[^"]*"[^>]*>([\d,]*)<\/a>/s', $row, $m)) {
                    $pub['citation_count'] = (int) str_replace(',', '', $m[1]);
                } else {
                    $pub['citation_count'] = 0;
                }

                // Year
                if (preg_match('/<span class="gsc_a_h gsc_a_hc[^"]*"[^>]*>(\d{4})<\/span>/s', $row, $m)) {
                    $pub['year'] = $m[1];
                } elseif (preg_match('/<td class="gsc_a_y"[^>]*><span[^>]*>(\d{4})<\/span>/s', $row, $m)) {
                    $pub['year'] = $m[1];
                }

                if (!empty($pub['title'])) {
                    $publications[] = $pub;
                }
            }
        }

        return $publications;
    }

    // ===== HTTP helpers =====

    private function fetchJson(string $url, array $headers = []): ?array
    {
        $content = $this->httpGet($url, $headers);
        if (!$content) return null;

        $data = json_decode($content, true);
        return is_array($data) ? $data : null;
    }

    private function fetchHtml(string $url): ?string
    {
        $headers = [
            'Accept: text/html,application/xhtml+xml',
            'Accept-Language: en-US,en;q=0.9',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ];
        return $this->httpGet($url, $headers);
    }

    private function httpGet(string $url, array $headers = []): ?string
    {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && $response !== false) {
            return $response;
        }

        return null;
    }

    /**
     * Save imported publications to database
     */
    public function savePublications(int $userId, array $publications, string $source): int
    {
        $db = Database::getInstance()->getConnection();
        $saved = 0;

        foreach ($publications as $pub) {
            // Skip if already exists (by title + user)
            $stmt = $db->prepare(
                "SELECT COUNT(*) FROM publications WHERE user_id = ? AND title = ?"
            );
            $stmt->execute([$userId, $pub['title'] ?? '']);
            if ((int) $stmt->fetchColumn() > 0) continue;

            $stmt = $db->prepare(
                "INSERT INTO publications (user_id, title, authors, year, venue, doi, citation_count, source, is_verified, is_included) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)"
            );
            $stmt->execute([
                $userId,
                $pub['title'] ?? '',
                $pub['authors'] ?? '',
                !empty($pub['year']) ? (int) $pub['year'] : null,
                $pub['venue'] ?? '',
                $pub['doi'] ?? '',
                (int) ($pub['citation_count'] ?? 0),
                $source,
            ]);
            $saved++;
        }

        return $saved;
    }

    /**
     * Get pending (unverified) publications for review
     */
    public function getPendingPublications(int $userId): array
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "SELECT * FROM publications WHERE user_id = ? AND is_verified = 0 ORDER BY year DESC, title ASC"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get approved publications
     */
    public function getApprovedPublications(int $userId): array
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "SELECT * FROM publications WHERE user_id = ? AND is_verified = 1 ORDER BY year DESC, title ASC"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Approve selected publications
     */
    public function approvePublications(int $userId, array $publicationIds): int
    {
        if (empty($publicationIds)) return 0;

        $db = Database::getInstance()->getConnection();
        $placeholders = implode(',', array_fill(0, count($publicationIds), '?'));
        $params = array_merge($publicationIds, [$userId]);

        $stmt = $db->prepare(
            "UPDATE publications SET is_verified = 1, is_included = 1 WHERE id IN ({$placeholders}) AND user_id = ?"
        );
        $stmt->execute($params);

        return $stmt->rowCount();
    }

    /**
     * Sync all approved publications to CV entries (catches publications that were
     * approved but never added as cv_entries due to previous bugs).
     */
    public function syncApprovedPublicationsToCV(int $userId): int
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "SELECT title, authors, year, venue, doi, url FROM publications WHERE user_id = ? AND is_verified = 1 AND is_included = 1"
        );
        $stmt->execute([$userId]);
        $pubEntries = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $pubEntries[] = [
                'title'   => $row['title'],
                'authors' => $row['authors'],
                'year'    => (string) ($row['year'] ?? ''),
                'venue'   => $row['venue'] ?? '',
                'doi'     => $row['doi'] ?? '',
                'url'     => $row['url'] ?? '',
            ];
        }
        return $this->addEntriesToCvSection($userId, 'publications', $pubEntries, 'title');
    }

    /**
     * Reject (delete) selected publications
     */
    public function rejectPublications(int $userId, array $publicationIds): int
    {
        if (empty($publicationIds)) return 0;

        $db = Database::getInstance()->getConnection();
        $placeholders = implode(',', array_fill(0, count($publicationIds), '?'));
        $params = array_merge($publicationIds, [$userId]);

        $stmt = $db->prepare(
            "DELETE FROM publications WHERE id IN ({$placeholders}) AND user_id = ?"
        );
        $stmt->execute($params);

        return $stmt->rowCount();
    }

    /**
     * Add entries to a user's CV section, skipping duplicates by matching a key field.
     * Returns the count of newly added entries.
     */
    public function addEntriesToCvSection(int $userId, string $sectionKey, array $entries, string $dedupeField = 'title'): int
    {
        if (empty($entries)) return 0;

        $db = Database::getInstance()->getConnection();

        // Find user's CV profile
        $stmt = $db->prepare("SELECT id FROM cv_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$profile) return 0;

        $profileId = (int) $profile['id'];

        // Find or create the section
        $stmt = $db->prepare("SELECT id FROM cv_sections WHERE profile_id = ? AND section_key = ?");
        $stmt->execute([$profileId, $sectionKey]);
        $section = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$section) {
            // Create the section
            $stmt = $db->prepare("INSERT INTO cv_sections (profile_id, section_key, section_order, is_visible) VALUES (?, ?, 99, 1)");
            $stmt->execute([$profileId, $sectionKey]);
            $sectionId = (int) $db->lastInsertId();
        } else {
            $sectionId = (int) $section['id'];
        }

        // Get current max entry_order
        $stmt = $db->prepare("SELECT COALESCE(MAX(entry_order), 0) FROM cv_entries WHERE section_id = ?");
        $stmt->execute([$sectionId]);
        $maxOrder = (int) $stmt->fetchColumn();

        // Get existing entries for dedup
        $stmt = $db->prepare("SELECT data FROM cv_entries WHERE section_id = ?");
        $stmt->execute([$sectionId]);
        $existing = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $d = json_decode($row['data'], true);
            if ($d && isset($d[$dedupeField])) {
                $existing[] = strtolower(trim($d[$dedupeField]));
            }
        }

        $added = 0;
        foreach ($entries as $entry) {
            $val = strtolower(trim($entry[$dedupeField] ?? ''));
            if ($val !== '' && in_array($val, $existing)) continue;

            $maxOrder++;
            $stmt = $db->prepare("INSERT INTO cv_entries (section_id, entry_order, data) VALUES (?, ?, ?)");
            $stmt->execute([$sectionId, $maxOrder, json_encode($entry)]);
            $added++;

            if ($val !== '') $existing[] = $val;
        }

        return $added;
    }

    /**
     * Log the sync operation
     */
    public function logSync(int $userId, string $source, string $status, int $itemsSynced, ?string $error = null): void
    {
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "INSERT INTO sync_logs (user_id, source, status, items_synced, error_message) VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$userId, $source, $status, $itemsSynced, $error]);
    }
}
