<?php
/**
 * EmailService - Transactional email with cPanel SMTP or PHP mail() fallback.
 * All public methods are static for convenient call-site usage.
 */
class EmailService
{
    // -- Transactional senders ------------------------------------------------

    public static function sendWelcome(string $toEmail, string $fullName): bool
    {
        return self::sendTemplate($toEmail, 'Welcome to CVScholar - Build your first academic CV', 'welcome', [
            'fullName'     => $fullName,
            'dashboardUrl' => APP_URL . '/dashboard',
            'createCvUrl'  => APP_URL . '/cv/create',
        ]);
    }

    public static function sendFirstCvReminder(string $toEmail, string $fullName): bool
    {
        return self::sendTemplate($toEmail, 'Your academic CV is waiting - start in 2 minutes', 'first_cv_reminder', [
            'fullName'     => $fullName,
            'createCvUrl'  => APP_URL . '/cv/create',
            'dashboardUrl' => APP_URL . '/dashboard',
        ]);
    }

    public static function sendReEngagement(string $toEmail, string $fullName): bool
    {
        return self::sendTemplate($toEmail, 'Come back and finish your CV on CVScholar', 're_engagement', [
            'fullName'     => $fullName,
            'dashboardUrl' => APP_URL . '/dashboard',
        ]);
    }

    public static function sendRenewalReminder(string $toEmail, string $fullName, string $expiresAt): bool
    {
        return self::sendTemplate($toEmail, 'Your CVScholar Pro subscription expires soon', 'renewal_reminder', [
            'fullName'     => $fullName,
            'expiresAt'    => $expiresAt,
            'plansUrl'     => APP_URL . '/plans',
            'dashboardUrl' => APP_URL . '/dashboard',
        ]);
    }

    public static function sendRenewalUrgent(string $toEmail, string $fullName, string $expiresAt): bool
    {
        return self::sendTemplate($toEmail, 'Last day - CVScholar Pro expires tomorrow', 'renewal_urgent', [
            'fullName'     => $fullName,
            'expiresAt'    => $expiresAt,
            'plansUrl'     => APP_URL . '/plans',
            'dashboardUrl' => APP_URL . '/dashboard',
        ]);
    }

    public static function sendSubscriptionExpired(string $toEmail, string $fullName): bool
    {
        return self::sendTemplate($toEmail, 'Your CVScholar Pro access has ended', 'subscription_expired', [
            'fullName'     => $fullName,
            'plansUrl'     => APP_URL . '/plans',
            'dashboardUrl' => APP_URL . '/dashboard',
        ]);
    }

    /**
     * Send the desktop continuation link for a CV draft started on mobile.
     */
    public static function sendContinuationLink(string $toEmail, string $name, string $link): bool
    {
        $safeLink = htmlspecialchars($link, ENT_QUOTES, 'UTF-8');
        $body = "<p style='line-height:1.6'>Your CV draft is ready. Open this link on your laptop to finish "
            . "the remaining sections and download your final CV.</p>"
            . "<p style='margin:28px 0'>"
            . "<a href='{$safeLink}' style='background:#2B6CB0;color:#ffffff;text-decoration:none;"
            . "padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block'>Continue on Laptop</a>"
            . "</p>"
            . "<p style='line-height:1.6;font-size:13px;color:#555'>Or copy and paste this link into your laptop browser:<br>"
            . "<a href='{$safeLink}' style='color:#2B6CB0;word-break:break-all'>{$safeLink}</a></p>";
        $html = self::wrapInBaseLayout($name, 'Your CVScholar workspace is ready', $body);
        return self::dispatch($toEmail, 'Your CVScholar workspace is ready', $html);
    }

    /**
     * Notify a website owner of a new contact-form submission. The visitor's
     * email is set as Reply-To so the owner can reply to them directly.
     */
    public static function sendContactNotification(
        string $toEmail,
        string $ownerName,
        string $visitorName,
        string $visitorEmail,
        string $subject,
        string $messageBody,
        string $websiteUrl = ''
    ): bool {
        $safeVisitorName  = htmlspecialchars($visitorName, ENT_QUOTES, 'UTF-8');
        $safeVisitorEmail = htmlspecialchars($visitorEmail, ENT_QUOTES, 'UTF-8');
        $safeSubject      = htmlspecialchars($subject !== '' ? $subject : '(no subject)', ENT_QUOTES, 'UTF-8');
        $safeMessage      = nl2br(htmlspecialchars($messageBody, ENT_QUOTES, 'UTF-8'));

        $body = "<p style='line-height:1.6'>You received a new message through your CVScholar academic website.</p>"
            . "<table style='width:100%;border-collapse:collapse;margin:18px 0'>"
            . "<tr><td style='padding:6px 0;color:#555;width:90px'>From</td>"
            . "<td style='padding:6px 0;font-weight:600'>{$safeVisitorName}</td></tr>"
            . "<tr><td style='padding:6px 0;color:#555'>Email</td>"
            . "<td style='padding:6px 0'><a href='mailto:{$safeVisitorEmail}' style='color:#2B6CB0'>{$safeVisitorEmail}</a></td></tr>"
            . "<tr><td style='padding:6px 0;color:#555'>Subject</td>"
            . "<td style='padding:6px 0'>{$safeSubject}</td></tr>"
            . "</table>"
            . "<div style='background:#f8f9fa;border-radius:8px;padding:16px;line-height:1.6'>{$safeMessage}</div>"
            . "<p style='line-height:1.6;font-size:13px;color:#555;margin-top:20px'>"
            . "Reply directly to this email to respond to {$safeVisitorName}.</p>";

        if ($websiteUrl !== '') {
            $safeUrl = htmlspecialchars($websiteUrl, ENT_QUOTES, 'UTF-8');
            $body .= "<p style='font-size:13px;color:#555'>Your website: "
                . "<a href='{$safeUrl}' style='color:#2B6CB0;word-break:break-all'>{$safeUrl}</a></p>";
        }

        $emailSubject = 'New message from your academic website'
            . ($subject !== '' ? ': ' . $subject : '');
        $html = self::wrapInBaseLayout($ownerName, 'New website message', $body);

        $replyTo = self::isValidEmail($visitorEmail) ? $visitorEmail : '';
        return self::dispatch($toEmail, $emailSubject, $html, $replyTo, $visitorName);
    }

    /**
     * Send a plain-text campaign email. Body supports {{name}} and {{email}} placeholders.
     */
    public static function sendRaw(string $toEmail, string $toName, string $subject, string $plainTextBody): bool
    {
        $safeBody = nl2br(htmlspecialchars($plainTextBody, ENT_QUOTES, 'UTF-8'));
        $html = self::wrapInBaseLayout($toName, $subject, "<p style='line-height:1.6'>{$safeBody}</p>");
        return self::dispatch($toEmail, $subject, $html);
    }

    /**
     * Render a PHP template file and send.
     */
    public static function sendTemplate(string $toEmail, string $subject, string $templateName, array $data = []): bool
    {
        $templatePath = TEMPLATE_PATH . '/emails/' . $templateName . '.php';
        if (!file_exists($templatePath)) {
            return false;
        }
        $html = self::renderTemplate($templatePath, $data);
        return self::dispatch($toEmail, $subject, $html);
    }

    // -- Core dispatch: SMTP or mail() ---------------------------------------

    private static function dispatch(string $toEmail, string $subject, string $htmlBody, string $replyToEmail = '', string $replyToName = ''): bool
    {
        [$fromEmail, $fromName] = self::getFromAddress();
        $smtpConfig = self::getSmtpConfig();

        // Reply-To defaults to the from-address, but a caller (e.g. the website
        // contact form) may override it with the visitor's address.
        $replyTo = self::isValidEmail($replyToEmail) ? $replyToEmail : $fromEmail;
        $replyToDisplay = str_replace(["\r", "\n", '"'], '', $replyToName);

        if ($smtpConfig['enabled'] && !empty($smtpConfig['host'])) {
            return self::sendViaSMTP($toEmail, $subject, $htmlBody, $fromEmail, $fromName, $smtpConfig, $replyTo, $replyToDisplay);
        }

        // Fallback: PHP mail()
        $safeName = str_replace(["\r", "\n"], '', $fromName);
        $replyToHeader = $replyToDisplay !== ''
            ? 'Reply-To: "' . $replyToDisplay . '" <' . $replyTo . '>'
            : 'Reply-To: ' . $replyTo;
        $headers  = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: "' . $safeName . '" <' . $fromEmail . '>',
            $replyToHeader,
            'X-Mailer: PHP/' . PHP_VERSION,
        ]);
        return @mail($toEmail, $subject, $htmlBody, $headers);
    }

    private static function isValidEmail(string $email): bool
    {
        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Send via SMTP using stream_socket_client (no PHPMailer/Composer needed).
     * Supports: port 465 SSL (implicit), port 587 STARTTLS, port 25 plain.
     */
    private static function sendViaSMTP(
        string $toEmail, string $subject, string $htmlBody,
        string $fromEmail, string $fromName, array $cfg,
        string $replyToEmail = '', string $replyToName = ''
    ): bool {
        $host       = $cfg['host'];
        $port       = (int) $cfg['port'];
        $username   = $cfg['username'];
        $password   = $cfg['password'];
        $encryption = $cfg['encryption']; // ssl | tls | none

        $context = stream_context_create(['ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ]]);

        $address = ($encryption === 'ssl') ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
        $socket  = @stream_socket_client($address, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) {
            return false;
        }

        $readLine = static function () use ($socket): string {
            return (string) fgets($socket, 515);
        };
        $sendCmd = static function (string $cmd) use ($socket): void {
            fwrite($socket, $cmd . "\r\n");
        };

        $readLine(); // 220 banner

        $myHost = gethostname() ?: 'localhost';
        $sendCmd("EHLO {$myHost}");
        while ($line = fgets($socket, 515)) {
            if ($line[3] === ' ') break;
        }

        // STARTTLS upgrade for port 587
        if ($encryption === 'tls') {
            $sendCmd('STARTTLS');
            $readLine();
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $sendCmd("EHLO {$myHost}");
            while ($line = fgets($socket, 515)) {
                if ($line[3] === ' ') break;
            }
        }

        // AUTH LOGIN
        $sendCmd('AUTH LOGIN');
        $readLine();
        $sendCmd(base64_encode($username));
        $readLine();
        $sendCmd(base64_encode($password));
        $authResp = $readLine();
        if (!str_starts_with($authResp, '235')) {
            fclose($socket);
            return false;
        }

        // Envelope
        $sendCmd("MAIL FROM:<{$fromEmail}>");
        $readLine();
        $sendCmd("RCPT TO:<{$toEmail}>");
        $rcptResp = $readLine();
        if (!str_starts_with($rcptResp, '250')) {
            fclose($socket);
            return false;
        }

        $sendCmd('DATA');
        $readLine(); // 354

        $safeName       = str_replace(["\r", "\n", '"'], '', $fromName);
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $message        = "From: \"{$safeName}\" <{$fromEmail}>\r\n";
        $message       .= "To: <{$toEmail}>\r\n";
        if ($replyToEmail !== '') {
            $message   .= $replyToName !== ''
                ? "Reply-To: \"{$replyToName}\" <{$replyToEmail}>\r\n"
                : "Reply-To: {$replyToEmail}\r\n";
        }
        $message       .= "Subject: {$encodedSubject}\r\n";
        $message       .= "MIME-Version: 1.0\r\n";
        $message       .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message       .= "X-Mailer: CVScholar/1.0\r\n";
        $message       .= "\r\n";
        $message       .= $htmlBody . "\r\n";
        $message       .= "\r\n.\r\n";

        fwrite($socket, $message);
        $dataResp = $readLine();

        $sendCmd('QUIT');
        fclose($socket);

        return str_starts_with($dataResp, '250');
    }

    // -- Helpers --------------------------------------------------------------

    private static function getSmtpConfig(): array
    {
        try {
            $sm = new SiteSetting();
            $s  = $sm->getMultiple([
                'smtp_enabled', 'smtp_host', 'smtp_port',
                'smtp_username', 'smtp_password', 'smtp_encryption',
            ]);
            return [
                'enabled'    => ($s['smtp_enabled'] ?? '0') === '1',
                'host'       => $s['smtp_host'] ?? '',
                'port'       => (int) ($s['smtp_port'] ?? 465),
                'username'   => $s['smtp_username'] ?? '',
                'password'   => $s['smtp_password'] ?? '',
                'encryption' => in_array($s['smtp_encryption'] ?? 'ssl', ['ssl', 'tls', 'none'])
                    ? ($s['smtp_encryption'] ?? 'ssl') : 'ssl',
            ];
        } catch (Throwable $e) {
            return ['enabled' => false, 'host' => '', 'port' => 465, 'username' => '', 'password' => '', 'encryption' => 'ssl'];
        }
    }

    private static function getFromAddress(): array
    {
        try {
            $sm   = new SiteSetting();
            $addr = $sm->get('smtp_from_address') ?: (getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@cvscholar.com');
            $name = $sm->get('smtp_from_name')    ?: (getenv('MAIL_FROM_NAME')    ?: (defined('APP_NAME') ? APP_NAME : 'CVScholar'));
            return [$addr, $name];
        } catch (Throwable $e) {
            return [getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@cvscholar.com', defined('APP_NAME') ? APP_NAME : 'CVScholar'];
        }
    }

    private static function renderTemplate(string $templatePath, array $data): string
    {
        extract($data, EXTR_SKIP);
        ob_start();
        include $templatePath;
        return (string) ob_get_clean();
    }

    private static function wrapInBaseLayout(string $name, string $heading, string $bodyHtml): string
    {
        $appName = defined('APP_NAME') ? APP_NAME : 'CVScholar';
        $appUrl  = defined('APP_URL')  ? APP_URL  : '#';
        return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
            . '<style>body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}'
            . '.w{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}'
            . '.h{background:#2563eb;padding:24px 32px}.h h1{color:#fff;margin:0;font-size:20px}'
            . '.b{padding:32px}.f{background:#f8f9fa;padding:16px 32px;text-align:center;font-size:12px;color:#6b7280}'
            . '</style></head><body><div class="w">'
            . '<div class="h"><h1>' . htmlspecialchars($appName, ENT_QUOTES, 'UTF-8') . '</h1></div>'
            . '<div class="b"><p>Hi ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ',</p>'
            . $bodyHtml . '</div>'
            . '<div class="f">&copy; ' . htmlspecialchars($appName, ENT_QUOTES, 'UTF-8')
            . ' &mdash; <a href="' . htmlspecialchars($appUrl, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($appUrl, ENT_QUOTES, 'UTF-8') . '</a></div>'
            . '</div></body></html>';
    }
}
