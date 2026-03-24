<?php
/**
 * Ticket Controller — Support tickets for users and admin
 */
class TicketController
{
    private const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

    /**
     * Process an uploaded image file, returns filename or null
     */
    private function handleImageUpload(array $file): ?string
    {
        if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] === 0) {
            return null;
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_IMAGE_TYPES, true)) {
            return null;
        }

        if ($file['size'] > self::MAX_IMAGE_SIZE) {
            return null;
        }

        $ext = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $filename = 'tkt_' . bin2hex(random_bytes(12)) . '.' . $ext;
        $dest = STORAGE_PATH . '/uploads/tickets/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            return null;
        }

        return $filename;
    }

    /**
     * User inbox — list user's tickets
     */
    public function index(): void
    {
        Auth::requireLogin();

        $ticketModel = new Ticket();
        $tickets = $ticketModel->getByUser(Auth::id());
        $unreadCount = $ticketModel->countUnreadForUser(Auth::id());

        include TEMPLATE_PATH . '/tickets/index.php';
    }

    /**
     * Submit a new ticket (POST, AJAX)
     */
    public function store(): void
    {
        Auth::requireLogin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $type = $_POST['type'] ?? '';
        $subject = trim($_POST['subject'] ?? '');
        $message = trim($_POST['message'] ?? '');

        if (!in_array($type, ['support', 'bug', 'feature'])) {
            echo json_encode(['error' => 'Please select a valid ticket type.']);
            return;
        }
        if ($subject === '' || strlen($subject) < 5) {
            echo json_encode(['error' => 'Subject must be at least 5 characters.']);
            return;
        }
        if ($message === '' || strlen($message) < 10) {
            echo json_encode(['error' => 'Message must be at least 10 characters.']);
            return;
        }

        // Handle image attachment
        $attachment = null;
        if (!empty($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
            $attachment = $this->handleImageUpload($_FILES['attachment']);
            if ($attachment === null && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
                echo json_encode(['error' => 'Invalid image. Allowed: JPG, PNG, GIF, WebP (max 5MB).']);
                return;
            }
        }

        $ticketModel = new Ticket();
        $ticketId = $ticketModel->create(Auth::id(), $type, $subject, $message, $attachment);

        echo json_encode(['success' => true, 'ticket_id' => $ticketId]);
    }

    /**
     * View a ticket thread (user side)
     */
    public function view(): void
    {
        Auth::requireLogin();

        $id = (int) ($_GET['id'] ?? 0);
        $ticketModel = new Ticket();
        $ticket = $ticketModel->findById($id);

        if (!$ticket || $ticket['user_id'] !== Auth::id()) {
            $_SESSION['flash_error'] = 'Ticket not found.';
            header('Location: ' . APP_URL . '/support');
            exit;
        }

        // Mark admin replies as read
        $ticketModel->markAdminRepliesRead($id);

        $replies = $ticketModel->getReplies($id);

        include TEMPLATE_PATH . '/tickets/view.php';
    }

    /**
     * User replies to their ticket (POST)
     */
    public function reply(): void
    {
        Auth::requireLogin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/support');
            exit;
        }

        $ticketId = (int) ($_POST['ticket_id'] ?? 0);
        $message = trim($_POST['message'] ?? '');

        $ticketModel = new Ticket();
        $ticket = $ticketModel->findById($ticketId);

        if (!$ticket || $ticket['user_id'] !== Auth::id()) {
            $_SESSION['flash_error'] = 'Ticket not found.';
            header('Location: ' . APP_URL . '/support');
            exit;
        }

        if ($ticket['status'] === 'closed') {
            $_SESSION['flash_error'] = 'This ticket is closed.';
            header('Location: ' . APP_URL . '/support/view?id=' . $ticketId);
            exit;
        }

        if ($message === '' || strlen($message) < 5) {
            $_SESSION['flash_error'] = 'Reply must be at least 5 characters.';
            header('Location: ' . APP_URL . '/support/view?id=' . $ticketId);
            exit;
        }

        // Handle image attachment
        $attachment = null;
        if (!empty($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
            $attachment = $this->handleImageUpload($_FILES['attachment']);
        }

        $ticketModel->addReply($ticketId, Auth::id(), $message, false, $attachment);

        // Re-open if it was resolved
        if ($ticket['status'] === 'resolved') {
            $ticketModel->updateStatus($ticketId, 'open');
        }

        $_SESSION['flash_success'] = 'Reply sent.';
        header('Location: ' . APP_URL . '/support/view?id=' . $ticketId);
        exit;
    }

    /**
     * Count unread for notification badge (AJAX)
     */
    public function unreadCount(): void
    {
        Auth::requireLogin();

        $ticketModel = new Ticket();

        if (Auth::user()['is_admin'] ?? false) {
            $count = $ticketModel->countUnreadForAdmin();
        } else {
            $count = $ticketModel->countUnreadForUser(Auth::id());
        }

        header('Content-Type: application/json');
        echo json_encode(['count' => $count]);
    }

    // ---- Admin methods ----

    /**
     * Admin tickets list
     */
    public function adminIndex(): void
    {
        Auth::requireAdmin();

        $ticketModel = new Ticket();
        $status = $_GET['status'] ?? '';
        $type = $_GET['type'] ?? '';
        $search = $_GET['search'] ?? '';

        $tickets = $ticketModel->getAll($status, $type, $search);
        $ticketStats = $ticketModel->getStats();

        include TEMPLATE_PATH . '/admin/tickets.php';
    }

    /**
     * Admin view ticket thread
     */
    public function adminView(): void
    {
        Auth::requireAdmin();

        $id = (int) ($_GET['id'] ?? 0);
        $ticketModel = new Ticket();
        $ticket = $ticketModel->findById($id);

        if (!$ticket) {
            $_SESSION['flash_error'] = 'Ticket not found.';
            header('Location: ' . APP_URL . '/admin/tickets');
            exit;
        }

        // Mark user replies as read
        $ticketModel->markUserRepliesRead($id);

        $replies = $ticketModel->getReplies($id);

        include TEMPLATE_PATH . '/admin/ticket-view.php';
    }

    /**
     * Admin replies to a ticket (POST)
     */
    public function adminReply(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid token.';
            header('Location: ' . APP_URL . '/admin/tickets');
            exit;
        }

        $ticketId = (int) ($_POST['ticket_id'] ?? 0);
        $message = trim($_POST['message'] ?? '');
        $newStatus = $_POST['status'] ?? '';

        $ticketModel = new Ticket();
        $ticket = $ticketModel->findById($ticketId);

        if (!$ticket) {
            $_SESSION['flash_error'] = 'Ticket not found.';
            header('Location: ' . APP_URL . '/admin/tickets');
            exit;
        }

        // Handle image attachment
        $attachment = null;
        if (!empty($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
            $attachment = $this->handleImageUpload($_FILES['attachment']);
        }

        if ($message !== '' && strlen($message) >= 5) {
            $ticketModel->addReply($ticketId, Auth::id(), $message, true, $attachment);
        } elseif ($attachment !== null) {
            // Allow image-only replies from admin
            $ticketModel->addReply($ticketId, Auth::id(), '(image attached)', true, $attachment);
        }

        if ($newStatus !== '' && in_array($newStatus, ['open', 'in_progress', 'resolved', 'closed'])) {
            $ticketModel->updateStatus($ticketId, $newStatus);
        }

        $_SESSION['flash_success'] = 'Ticket updated.';
        header('Location: ' . APP_URL . '/admin/tickets/view?id=' . $ticketId);
        exit;
    }

    /**
     * Admin updates ticket status only (POST)
     */
    public function adminUpdateStatus(): void
    {
        Auth::requireAdmin();

        if (!Auth::verifyToken($_POST['_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }

        $ticketId = (int) ($_POST['ticket_id'] ?? 0);
        $newStatus = $_POST['status'] ?? '';

        if (!in_array($newStatus, ['open', 'in_progress', 'resolved', 'closed'])) {
            echo json_encode(['error' => 'Invalid status.']);
            return;
        }

        $ticketModel = new Ticket();
        $ticket = $ticketModel->findById($ticketId);

        if (!$ticket) {
            echo json_encode(['error' => 'Ticket not found.']);
            return;
        }

        $ticketModel->updateStatus($ticketId, $newStatus);
        echo json_encode(['success' => true]);
    }

    /**
     * Serve a ticket attachment image (requires login + ownership or admin)
     */
    public function attachment(): void
    {
        Auth::requireLogin();

        $filename = $_GET['file'] ?? '';
        if ($filename === '' || !preg_match('/^tkt_[a-f0-9]{24}\.(jpg|png|gif|webp)$/', $filename)) {
            http_response_code(404);
            echo 'Not found';
            return;
        }

        $path = STORAGE_PATH . '/uploads/tickets/' . $filename;
        if (!file_exists($path)) {
            http_response_code(404);
            echo 'Not found';
            return;
        }

        // Verify user owns the ticket or is admin
        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare(
            "SELECT t.user_id FROM ticket_replies r
             JOIN support_tickets t ON t.id = r.ticket_id
             WHERE r.attachment = ? LIMIT 1"
        );
        $stmt->execute([$filename]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo 'Not found';
            return;
        }

        $isAdmin = Auth::user()['is_admin'] ?? false;
        if (!$isAdmin && (int)$row['user_id'] !== Auth::id()) {
            http_response_code(403);
            echo 'Forbidden';
            return;
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($path);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=86400');
        readfile($path);
        exit;
    }
}
