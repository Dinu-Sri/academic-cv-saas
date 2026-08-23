/**
 * Billing event emails via the shared email provider (Brevo preferred, Resend fallback).
 * No-ops when no provider API key is configured.
 */

import { sendTransactionalEmail } from "@/lib/email";

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

  return sendTransactionalEmail({
    to: input.to,
    subject: `CVScholar · ${input.planName} is active`,
    tags: ["billing", "plan_granted"],
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

  return sendTransactionalEmail({
    to: input.to,
    subject: `CVScholar · ${input.planName} expires in ${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}`,
    tags: ["billing", "plan_expiring"],
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
  return sendTransactionalEmail({
    to: input.to,
    subject: `CVScholar · ${input.previousPlanName} has ended`,
    tags: ["billing", "plan_expired"],
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
