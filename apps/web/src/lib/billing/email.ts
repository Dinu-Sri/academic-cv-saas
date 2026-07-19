/**
 * Optional Resend emails for billing events.
 * No-ops when RESEND_API_KEY is missing (safe for local/staging without mail).
 */

type SendArgs = {
  to: string;
  subject: string;
  text: string;
};

async function sendBillingEmail(args: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "CVScholar <noreply@cvscholar.com>";
  if (!apiKey || !args.to.trim()) {
    return { sent: false as const, reason: "not_configured" as const };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text
      })
    });
    if (!response.ok) {
      console.error("[billing/email] Resend failed", response.status, await response.text().catch(() => ""));
      return { sent: false as const, reason: "provider_error" as const };
    }
    return { sent: true as const };
  } catch (error) {
    console.error("[billing/email]", error);
    return { sent: false as const, reason: "network_error" as const };
  }
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://rewrite.cvscholar.com").replace(
    /\/$/,
    ""
  );
}

export async function sendPlanGrantedEmail(input: {
  to: string;
  name: string;
  planName: string;
  expiresAt: Date | null;
  source: "admin" | "purchase" | "staging";
}) {
  const until = input.expiresAt
    ? input.expiresAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "n/a";
  const sourceLine =
    input.source === "admin"
      ? "An administrator activated this plan on your account."
      : input.source === "staging"
        ? "Your staging plan activation was successful."
        : "Your payment was received and the plan is active.";

  return sendBillingEmail({
    to: input.to,
    subject: `CVScholar · ${input.planName} is active`,
    text: [
      `Hello ${input.name || "scholar"},`,
      "",
      sourceLine,
      "",
      `Plan: ${input.planName}`,
      input.expiresAt ? `Access until: ${until}` : "Access: ongoing free plan",
      "",
      `Manage billing: ${appBaseUrl()}/billing`,
      `Download PDFs: ${appBaseUrl()}/cv`,
      "",
      "— CVScholar"
    ].join("\n")
  });
}

export async function sendPlanExpiringEmail(input: {
  to: string;
  name: string;
  planName: string;
  daysRemaining: number;
  expiresAt: Date;
}) {
  const until = input.expiresAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return sendBillingEmail({
    to: input.to,
    subject: `CVScholar · ${input.planName} expires in ${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}`,
    text: [
      `Hello ${input.name || "scholar"},`,
      "",
      `Your ${input.planName} ends on ${until} (${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"} left).`,
      "",
      "After that, PDF download locks again and free website branding returns.",
      "You can renew anytime from Billing — build and preview stay free.",
      "",
      `Renew: ${appBaseUrl()}/billing`,
      "",
      "— CVScholar"
    ].join("\n")
  });
}

export async function sendPlanExpiredEmail(input: {
  to: string;
  name: string;
  previousPlanName: string;
}) {
  return sendBillingEmail({
    to: input.to,
    subject: `CVScholar · ${input.previousPlanName} has ended`,
    text: [
      `Hello ${input.name || "scholar"},`,
      "",
      `Your ${input.previousPlanName} has ended. Your account is back on Free:`,
      "• Full editor and PDF preview — still free",
      "• PDF download — locked until you renew",
      "• Academic website — may show the CVScholar badge again",
      "",
      `Renew: ${appBaseUrl()}/billing`,
      "",
      "— CVScholar"
    ].join("\n")
  });
}
