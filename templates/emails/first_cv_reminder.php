<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Start your first CV</title>
</head>
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e6ebf2;border-radius:10px;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 28px;background:#198754;color:#fff;">
                            <h1 style="margin:0;font-size:22px;">Your CV is waiting</h1>
                            <p style="margin:8px 0 0 0;opacity:.9;">Most users finish their first draft in under 15 minutes.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 28px;">
                            <p style="margin-top:0;">Hi <?= e($fullName ?: 'there') ?>,</p>
                            <p>You signed up recently but have not created your first CV yet. We saved your account, so you can continue instantly.</p>
                            <p style="margin:22px 0;">
                                <a href="<?= e($createCvUrl) ?>" style="display:inline-block;padding:10px 16px;background:#198754;color:#fff;text-decoration:none;border-radius:6px;">Start My First CV</a>
                            </p>
                            <p style="margin-bottom:0;">Dashboard: <a href="<?= e($dashboardUrl) ?>"><?= e($dashboardUrl) ?></a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
