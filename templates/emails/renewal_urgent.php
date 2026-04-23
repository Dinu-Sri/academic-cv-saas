<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.w{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
.h{background:#dc2626;padding:24px 32px}.h h1{color:#fff;margin:0;font-size:20px}
.b{padding:32px;color:#374151;line-height:1.6}
.alert{background:#fee2e2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:4px;margin:20px 0}
.btn{display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;margin-top:16px}
.f{background:#f8f9fa;padding:16px 32px;text-align:center;font-size:12px;color:#6b7280}
</style>
</head>
<body>
<div class="w">
  <div class="h"><h1>CVScholar — Urgent Notice</h1></div>
  <div class="b">
    <p>Hi <?= htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') ?>,</p>

    <div class="alert">
      <strong>Your Pro subscription expires tomorrow on <?= htmlspecialchars($expiresAt, ENT_QUOTES, 'UTF-8') ?>.</strong><br>
      This is your last chance to renew without interruption.
    </div>

    <p>After expiry your account will revert to the Free plan and you will lose access to:</p>
    <ul>
      <li>Premium CV templates</li>
      <li>Unlimited PDF exports</li>
      <li>Pro features and priority support</li>
    </ul>

    <p>Renew right now to keep everything running:</p>
    <a href="<?= htmlspecialchars($plansUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn">Renew Now — Don't Lose Access</a>

    <p style="margin-top:24px;font-size:13px;color:#6b7280">
      Manage your subscription from your <a href="<?= htmlspecialchars($dashboardUrl, ENT_QUOTES, 'UTF-8') ?>">dashboard</a>.
    </p>
  </div>
  <div class="f">&copy; CVScholar &mdash; Academic CV Builder</div>
</div>
</body>
</html>
