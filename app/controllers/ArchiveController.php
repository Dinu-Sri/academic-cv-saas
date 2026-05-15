<?php

class ArchiveController
{
    public function index(): void
    {
        Auth::requireLogin();

        $user = Auth::user();
        $userModel = new User();
        $fullUser = $userModel->findById((int) $user['id']) ?: $user;
        $personalInfo = [];
        if (!empty($fullUser['personal_info'])) {
            $decoded = json_decode((string) $fullUser['personal_info'], true);
            if (is_array($decoded)) $personalInfo = $decoded;
        }

        $entries = (new CVProfile())->getUserEntries((int) $user['id']);
        $entriesBySection = [];
        foreach ($entries as $entry) {
            $sectionKey = (string) ($entry['section_key'] ?? 'other');
            $entriesBySection[$sectionKey][] = $entry;
        }

        $approvedPublications = (new ProfileImportService())->getApprovedPublications((int) $user['id']);
        $sectionLabels = $this->sectionLabels();
        $activeSection = trim((string) ($_GET['section'] ?? ''));

        include TEMPLATE_PATH . '/archive/index.php';
    }

    public function updatePersonal(): void
    {
        Auth::requireLogin();
        if (!$this->validToken()) return;

        $userId = (int) Auth::id();
        $fields = ['full_name', 'title', 'affiliation', 'email', 'phone', 'location', 'website', 'linkedin', 'orcid', 'google_scholar'];
        $personalInfo = [];
        foreach ($fields as $field) {
            $value = trim((string) ($_POST['personal_info'][$field] ?? ''));
            if ($value !== '') $personalInfo[$field] = $value;
        }

        (new User())->update($userId, [
            'full_name' => $personalInfo['full_name'] ?? null,
            'title' => $personalInfo['title'] ?? null,
            'affiliation' => $personalInfo['affiliation'] ?? null,
            'orcid_id' => $personalInfo['orcid'] ?? null,
            'google_scholar_id' => $personalInfo['google_scholar'] ?? null,
            'personal_info' => json_encode($personalInfo, JSON_UNESCAPED_UNICODE),
        ]);

        $_SESSION['flash_success'] = 'Archive profile details updated.';
        $this->redirectArchive();
    }

    public function updateEntry(): void
    {
        Auth::requireLogin();
        if (!$this->validToken()) return;

        $entryId = (int) ($_POST['entry_id'] ?? 0);
        $entry = $this->findOwnedUserEntry($entryId);
        if (!$entry) {
            $_SESSION['flash_error'] = 'Archive entry not found.';
            $this->redirectArchive();
        }

        $data = [];
        foreach (($_POST['data'] ?? []) as $key => $value) {
            $key = trim((string) $key);
            if ($key === '') continue;
            $data[$key] = trim((string) $value);
        }

        (new CVProfile())->updateUserEntry($entryId, $data);
        $_SESSION['flash_success'] = 'Archive entry updated.';
        $this->redirectArchive((string) ($entry['section_key'] ?? ''));
    }

    public function deleteEntry(): void
    {
        Auth::requireLogin();
        if (!$this->validToken()) return;

        $entryId = (int) ($_POST['entry_id'] ?? 0);
        $entry = $this->findOwnedUserEntry($entryId);
        if (!$entry) {
            $_SESSION['flash_error'] = 'Archive entry not found.';
            $this->redirectArchive();
        }

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare('DELETE FROM user_entries WHERE id = ? AND user_id = ?');
        $stmt->execute([$entryId, Auth::id()]);

        $_SESSION['flash_success'] = 'Archive entry deleted. Existing CVs are unchanged.';
        $this->redirectArchive((string) ($entry['section_key'] ?? ''));
    }

    public function updatePublication(): void
    {
        Auth::requireLogin();
        if (!$this->validToken()) return;

        $publicationId = (int) ($_POST['publication_id'] ?? 0);
        $old = $this->findOwnedPublication($publicationId);
        if (!$old) {
            $_SESSION['flash_error'] = 'Publication not found.';
            $this->redirectArchive('publications');
        }

        $data = [
            'title' => trim((string) ($_POST['title'] ?? '')),
            'authors' => trim((string) ($_POST['authors'] ?? '')),
            'year' => trim((string) ($_POST['year'] ?? '')),
            'venue' => trim((string) ($_POST['venue'] ?? '')),
            'doi' => trim((string) ($_POST['doi'] ?? '')),
            'url' => trim((string) ($_POST['url'] ?? '')),
        ];
        if ($data['title'] === '') {
            $_SESSION['flash_error'] = 'Publication title is required.';
            $this->redirectArchive('publications');
        }

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare('UPDATE publications SET title = ?, authors = ?, year = ?, venue = ?, doi = ?, url = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([
            $data['title'],
            $data['authors'],
            $data['year'] !== '' ? (int) $data['year'] : null,
            $data['venue'],
            $data['doi'],
            $data['url'],
            $publicationId,
            Auth::id(),
        ]);
        $this->syncPublicationMasterEntry((int) Auth::id(), $old, $data);

        $_SESSION['flash_success'] = 'Publication updated.';
        $this->redirectArchive('publications');
    }

    public function deletePublication(): void
    {
        Auth::requireLogin();
        if (!$this->validToken()) return;

        $publicationId = (int) ($_POST['publication_id'] ?? 0);
        $publication = $this->findOwnedPublication($publicationId);
        if (!$publication) {
            $_SESSION['flash_error'] = 'Publication not found.';
            $this->redirectArchive('publications');
        }

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare('DELETE FROM publications WHERE id = ? AND user_id = ?');
        $stmt->execute([$publicationId, Auth::id()]);
        $this->deletePublicationMasterEntry((int) Auth::id(), $publication);

        $_SESSION['flash_success'] = 'Publication deleted from your archive. Existing CVs are unchanged.';
        $this->redirectArchive('publications');
    }

    private function findOwnedUserEntry(int $entryId): ?array
    {
        $stmt = Database::getInstance()->getConnection()->prepare('SELECT * FROM user_entries WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$entryId, Auth::id()]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function findOwnedPublication(int $publicationId): ?array
    {
        $stmt = Database::getInstance()->getConnection()->prepare('SELECT * FROM publications WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$publicationId, Auth::id()]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function syncPublicationMasterEntry(int $userId, array $oldPublication, array $newData): void
    {
        $entry = [
            'title' => $newData['title'],
            'authors' => $newData['authors'],
            'year' => $newData['year'],
            'venue' => $newData['venue'],
            'doi' => $newData['doi'],
            'url' => $newData['url'],
        ];
        $entryId = $this->matchingPublicationUserEntryId($userId, $oldPublication);
        if ($entryId) {
            (new CVProfile())->updateUserEntry($entryId, $entry);
            return;
        }
        (new ProfileImportService())->addEntriesToUserMasterData($userId, 'publications', [$entry], $entry['doi'] !== '' ? 'doi' : 'title');
    }

    private function deletePublicationMasterEntry(int $userId, array $publication): void
    {
        $entryId = $this->matchingPublicationUserEntryId($userId, $publication);
        if (!$entryId) return;

        $stmt = Database::getInstance()->getConnection()->prepare('DELETE FROM user_entries WHERE id = ? AND user_id = ?');
        $stmt->execute([$entryId, $userId]);
    }

    private function matchingPublicationUserEntryId(int $userId, array $publication): ?int
    {
        $doi = strtolower(trim((string) ($publication['doi'] ?? '')));
        $title = strtolower(trim((string) ($publication['title'] ?? '')));
        $stmt = Database::getInstance()->getConnection()->prepare("SELECT id, data FROM user_entries WHERE user_id = ? AND section_key = 'publications' ORDER BY id DESC");
        $stmt->execute([$userId]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data = json_decode((string) ($row['data'] ?? ''), true);
            if (!is_array($data)) continue;
            $entryDoi = strtolower(trim((string) ($data['doi'] ?? '')));
            $entryTitle = strtolower(trim((string) ($data['title'] ?? '')));
            if ($doi !== '' && $entryDoi !== '' && $doi === $entryDoi) return (int) $row['id'];
            if ($title !== '' && $entryTitle !== '' && $title === $entryTitle) return (int) $row['id'];
        }
        return null;
    }

    private function validToken(): bool
    {
        if (Auth::verifyToken($_POST['_token'] ?? '')) return true;
        $_SESSION['flash_error'] = 'Invalid request.';
        $this->redirectArchive();
        return false;
    }

    private function redirectArchive(string $section = ''): void
    {
        $url = APP_URL . '/archive';
        if ($section !== '') $url .= '?section=' . urlencode($section);
        header('Location: ' . $url);
        exit;
    }

    private function sectionLabels(): array
    {
        return [
            'education' => 'Education',
            'experience' => 'Experience',
            'publications' => 'Publications',
            'skills' => 'Skills',
            'awards' => 'Awards',
            'references' => 'References',
            'research_interests' => 'Research Interests',
            'projects' => 'Projects',
            'teaching' => 'Teaching',
            'supervision' => 'Supervision',
            'grants' => 'Grants',
            'conferences' => 'Conferences',
            'academic_service' => 'Academic Service',
            'memberships' => 'Memberships',
            'languages' => 'Languages',
            'declaration' => 'Declaration',
        ];
    }
}