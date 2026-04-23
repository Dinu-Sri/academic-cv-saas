<?php
/**
 * EmailService
 * Simple transactional email sender backed by PHP mail().
 */
class EmailService
{
    private string $fromEmail;
    private string $fromName;

    public function __construct()
    {
        $this->fromEmail = getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@cvscholar.com';
        $this->fromName = getenv('MAIL_FROM_NAME') ?: APP_NAME;
    }

    public function sendWelcome(string $toEmail, string $fullName): bool
    {
        return $this->sendTemplate(
            $toEmail,
            'Welcome to CVScholar - Build your first academic CV',
            'welcome',
            [
                'fullName' => $fullName,
                'dashboardUrl' => APP_URL . '/dashboard',
                'createCvUrl' => APP_URL . '/cv/create',
            ]
        );
    }

    public function sendFirstCvReminder(string $toEmail, string $fullName): bool
    {
        return $this->sendTemplate(
            $toEmail,
            'Your academic CV is waiting - start in 2 minutes',
            'first_cv_reminder',
            [
                'fullName' => $fullName,
                'createCvUrl' => APP_URL . '/cv/create',
                'dashboardUrl' => APP_URL . '/dashboard',
            ]
        );
    }

    public function sendReEngagement(string $toEmail, string $fullName): bool
    {
        return $this->sendTemplate(
            $toEmail,
            'Come back and finish your CV on CVScholar',
            're_engagement',
            [
                'fullName' => $fullName,
                'dashboardUrl' => APP_URL . '/dashboard',
            ]
        );
    }

    public function sendTemplate(string $toEmail, string $subject, string $templateName, array $data = []): bool
    {
        $templatePath = TEMPLATE_PATH . '/emails/' . $templateName . '.php';
        if (!file_exists($templatePath)) {
            return false;
        }

        $htmlBody = $this->renderTemplate($templatePath, $data);

        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: ' . $this->formatFromHeader(),
            'Reply-To: ' . $this->fromEmail,
            'X-Mailer: PHP/' . phpversion(),
        ];

        return @mail($toEmail, $subject, $htmlBody, implode("\r\n", $headers));
    }

    private function renderTemplate(string $templatePath, array $data): string
    {
        extract($data, EXTR_SKIP);
        ob_start();
        include $templatePath;
        return (string) ob_get_clean();
    }

    private function formatFromHeader(): string
    {
        $safeName = str_replace(['\r', '\n'], '', $this->fromName);
        return sprintf('"%s" <%s>', $safeName, $this->fromEmail);
    }
}
