<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Welcome to CVScholar</title>
</head>
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e6ebf2;border-radius:10px;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 28px;background:#0d6efd;color:#fff;">
                            <h1 style="margin:0;font-size:22px;">Welcome to CVScholar</h1>
                            <p style="margin:8px 0 0 0;opacity:.9;">Build an academic CV that is ready to share and submit.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 28px;">
                            <p style="margin-top:0;">Hi <?= e($fullName ?: 'there') ?>,</p>
                            <p>Your account is ready. Start your first CV in three quick steps:</p>
                            <ol style="padding-left:20px;">
                                <li>Create your first CV</li>
                                <li>Fill your core sections</li>
                                <li>Compile and download the PDF</li>
                            </ol>
                            <p style="margin:22px 0;">
                                <a href="<?= e($createCvUrl) ?>" style="display:inline-block;padding:10px 16px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px;">Create Your First CV</a>
                            </p>
                            <p style="margin-bottom:0;">You can also open your dashboard anytime: <a href="<?= e($dashboardUrl) ?>"><?= e($dashboardUrl) ?></a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
