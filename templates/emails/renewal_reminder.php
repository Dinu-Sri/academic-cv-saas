<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.w{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
.h{background:#2563eb;padding:24px 32px}.h h1{color:#fff;margin:0;font-size:20px}
.b{padding:32px;color:#374151;line-height:1.6}
.alert{background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:20px 0}
.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;margin-top:16px}
.f{background:#f8f9fa;padding:16px 32px;text-align:center;font-size:12px;color:#6b7280}
</style>
</head>
<body>
<div class="w">
  <div class="h"><h1>CVScholar</h1></div>
  <div class="b">
    <p>Hi <?= htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') ?>,</p>

    <div class="alert">
      <strong>Your Pro subscription expires on <?= htmlspecialchars($expiresAt, ENT_QUOTES, 'UTF-8') ?>.</strong><br>
      Renew now to keep full access to all Pro features and templates.
    </div>

    <p>With CVScholar Pro you get:</p>
    <ul>
      <li>All 6 professional CV templates including premium designs</li>
      <li>Unlimited CV exports in PDF format</li>
      <li>Priority support</li>
    </ul>

    <p>Don't let your subscription lapse — renew in a few clicks:</p>
    <a href="<?= htmlspecialchars($plansUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn">Renew My Subscription</a>

    <p style="margin-top:24px;font-size:13px;color:#6b7280">
      Questions? Visit your <a href="<?= htmlspecialchars($dashboardUrl, ENT_QUOTES, 'UTF-8') ?>">dashboard</a> or reply to this email.
    </p>
  </div>
  <div class="f">&copy; CVScholar &mdash; Academic CV Builder</div>
</div>
</body>
</html>
