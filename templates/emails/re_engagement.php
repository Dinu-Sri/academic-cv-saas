<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Come back to CVScholar</title>
</head>
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e6ebf2;border-radius:10px;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 28px;background:#6c757d;color:#fff;">
                            <h1 style="margin:0;font-size:22px;">Pick up where you left off</h1>
                            <p style="margin:8px 0 0 0;opacity:.9;">Your CV can be finished in a single session.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 28px;">
                            <p style="margin-top:0;">Hi <?= e($fullName ?: 'there') ?>,</p>
                            <p>It has been a while since your last visit. Your CV data is still here and ready for you.</p>
                            <p style="margin:22px 0;">
                                <a href="<?= e($dashboardUrl) ?>" style="display:inline-block;padding:10px 16px;background:#212529;color:#fff;text-decoration:none;border-radius:6px;">Return to Dashboard</a>
                            </p>
                            <p style="margin-bottom:0;">Need help? Reply to this email and we will assist.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
