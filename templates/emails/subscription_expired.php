<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.w{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
.h{background:#6b7280;padding:24px 32px}.h h1{color:#fff;margin:0;font-size:20px}
.b{padding:32px;color:#374151;line-height:1.6}
.info{background:#f3f4f6;border-left:4px solid #6b7280;padding:14px 18px;border-radius:4px;margin:20px 0}
.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;margin-top:16px}
.f{background:#f8f9fa;padding:16px 32px;text-align:center;font-size:12px;color:#6b7280}
</style>
</head>
<body>
<div class="w">
  <div class="h"><h1>CVScholar</h1></div>
  <div class="b">
    <p>Hi <?= htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') ?>,</p>

    <div class="info">
      Your CVScholar Pro subscription has expired and your account has been moved to the Free plan.
    </div>

    <p>You still have access to:</p>
    <ul>
      <li>Your saved CV data and profiles</li>
      <li>Free templates and basic exports</li>
    </ul>

    <p>To regain access to all Pro features, templates, and unlimited exports, simply renew your subscription:</p>
    <a href="<?= htmlspecialchars($plansUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn">View Plans and Renew</a>

    <p style="margin-top:24px;font-size:13px;color:#6b7280">
      Your CV data is safe and will be there when you return. Visit your <a href="<?= htmlspecialchars($dashboardUrl, ENT_QUOTES, 'UTF-8') ?>">dashboard</a> anytime.
    </p>
  </div>
  <div class="f">&copy; CVScholar &mdash; Academic CV Builder</div>
</div>
</body>
</html>
