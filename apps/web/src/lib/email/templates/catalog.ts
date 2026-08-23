import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";
import {
  emailDetailRows,
  emailMuted,
  emailParagraphs,
  emailQuote,
  renderEmailLayout
} from "@/lib/email/templates/layout";

export type BuiltEmail = {
  subject: string;
  text: string;
  html: string;
  tags: string[];
};

function base() {
  return getSiteOrigin();
}

function textBlock(lines: string[]) {
  return lines.filter((l) => l !== undefined && l !== null).join("\n");
}

/** Admin-testable transactional email kinds. */
export const TRANSACTIONAL_EMAIL_KINDS = [
  "password_reset",
  "plan_granted",
  "plan_expiring",
  "plan_expired",
  "invitation",
  "support_ticket_received",
  "support_admin_new_ticket",
  "support_reply_to_user",
  "support_user_reply_to_admin",
  "website_contact",
  "mobile_handoff"
] as const;

export type TransactionalEmailKind = (typeof TRANSACTIONAL_EMAIL_KINDS)[number];

export const TRANSACTIONAL_EMAIL_LABELS: Record<TransactionalEmailKind, string> = {
  password_reset: "Password reset",
  plan_granted: "Plan granted / activated",
  plan_expiring: "Plan expiring soon",
  plan_expired: "Plan expired",
  invitation: "Package invitation",
  support_ticket_received: "Support — ticket received (user)",
  support_admin_new_ticket: "Support — new ticket (admin)",
  support_reply_to_user: "Support — admin reply to user",
  support_user_reply_to_admin: "Support — user reply (admin)",
  website_contact: "Website contact message",
  mobile_handoff: "Mobile → laptop handoff"
};

export function buildPasswordResetEmail(input: { name: string; url: string }): BuiltEmail {
  const subject = "CVScholar · Reset your password";
  const text = textBlock([
    `Hello ${input.name || "there"},`,
    "",
    "We received a request to reset your CVScholar password.",
    "Open this link to choose a new password (it expires soon):",
    "",
    input.url,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: "Reset your CVScholar password",
    title: "Reset your password",
    bodyHtml:
      emailParagraphs([
        `Hello ${input.name || "there"},`,
        "We received a request to reset your CVScholar password. Use the button below to choose a new one. The link expires soon."
      ]) + emailMuted("If you did not request this, you can ignore this email."),
    cta: { label: "Choose new password", url: input.url },
    footerNote: "For security, never share this link."
  });
  return { subject, text, html, tags: ["auth", "password_reset"] };
}

export function buildPlanGrantedEmail(input: {
  name: string;
  planName: string;
  expiresAt: Date | null;
  source: "admin" | "purchase" | "staging";
}): BuiltEmail {
  const until = input.expiresAt
    ? input.expiresAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";
  const sourceLine =
    input.source === "admin"
      ? "An administrator activated this plan on your account."
      : input.source === "staging"
        ? "Your staging plan activation was successful."
        : "Your payment was received and the plan is active.";
  const subject = `CVScholar · ${input.planName} is active`;
  const text = textBlock([
    `Hello ${input.name || "scholar"},`,
    "",
    sourceLine,
    "",
    `Plan: ${input.planName}`,
    input.expiresAt ? `Access until: ${until}` : "Access: ongoing free plan",
    "",
    `Manage billing: ${base()}/billing`,
    `Download PDFs: ${base()}/cv`,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: `${input.planName} is now active`,
    title: `${input.planName} is active`,
    bodyHtml:
      emailParagraphs([`Hello ${input.name || "scholar"},`, sourceLine]) +
      emailDetailRows([
        ["Plan", input.planName],
        ["Access until", input.expiresAt ? until : "Ongoing (free)"]
      ]),
    cta: { label: "Open billing", url: `${base()}/billing` }
  });
  return { subject, text, html, tags: ["billing", "plan_granted"] };
}

export function buildPlanExpiringEmail(input: {
  name: string;
  planName: string;
  daysRemaining: number;
  expiresAt: Date;
}): BuiltEmail {
  const until = input.expiresAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const days = `${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}`;
  const subject = `CVScholar · ${input.planName} expires in ${days}`;
  const text = textBlock([
    `Hello ${input.name || "scholar"},`,
    "",
    `Your ${input.planName} ends on ${until} (${days} left).`,
    "",
    "After that, PDF download locks again and free website branding returns.",
    "You can renew anytime from Billing — build and preview stay free.",
    "",
    `Renew: ${base()}/billing`,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: `${input.planName} ends in ${days}`,
    title: `Your plan ends in ${days}`,
    bodyHtml:
      emailParagraphs([
        `Hello ${input.name || "scholar"},`,
        `Your ${input.planName} ends on ${until}. After that, PDF download locks again and free website branding may return. Build and preview stay free.`
      ]) + emailDetailRows([
        ["Plan", input.planName],
        ["Ends", until],
        ["Remaining", days]
      ]),
    cta: { label: "Renew now", url: `${base()}/billing` }
  });
  return { subject, text, html, tags: ["billing", "plan_expiring"] };
}

export function buildPlanExpiredEmail(input: {
  name: string;
  previousPlanName: string;
}): BuiltEmail {
  const subject = `CVScholar · ${input.previousPlanName} has ended`;
  const text = textBlock([
    `Hello ${input.name || "scholar"},`,
    "",
    `Your ${input.previousPlanName} has ended. Your account is back on Free:`,
    "• Full editor and PDF preview — still free",
    "• PDF download — locked until you renew",
    "• Academic website — may show the CVScholar badge again",
    "",
    `Renew: ${base()}/billing`,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: `${input.previousPlanName} has ended`,
    title: `${input.previousPlanName} has ended`,
    bodyHtml:
      emailParagraphs([
        `Hello ${input.name || "scholar"},`,
        `Your ${input.previousPlanName} has ended. Your account is back on Free.`
      ]) +
      emailDetailRows([
        ["Editor & preview", "Still free"],
        ["PDF download", "Locked until renew"],
        ["Website badge", "May show CVScholar branding"]
      ]),
    cta: { label: "Renew plan", url: `${base()}/billing` }
  });
  return { subject, text, html, tags: ["billing", "plan_expired"] };
}

export function buildInvitationEmail(input: {
  planName: string;
  redeemUrl: string;
  expiresAt: Date;
  adminEmail: string;
  to: string;
}): BuiltEmail {
  const until = input.expiresAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const subject = `CVScholar invitation · ${input.planName}`;
  const text = textBlock([
    "Hello,",
    "",
    `You have been invited to activate ${input.planName} on CVScholar.`,
    `This link is for ${input.to} only and expires on ${until}.`,
    "",
    `Open the invitation: ${input.redeemUrl}`,
    "",
    "If you did not expect this email, you can ignore it.",
    "",
    `— CVScholar (sent by ${input.adminEmail})`
  ]);
  const html = renderEmailLayout({
    preheader: `Invitation to activate ${input.planName}`,
    title: "You have been invited",
    bodyHtml:
      emailParagraphs([
        "Hello,",
        `You have been invited to activate ${input.planName} on CVScholar.`
      ]) +
      emailDetailRows([
        ["Plan", input.planName],
        ["For", input.to],
        ["Expires", until]
      ]) +
      emailMuted(`Sent by ${input.adminEmail}. If you did not expect this, ignore the email.`),
    cta: { label: "Activate invitation", url: input.redeemUrl }
  });
  return { subject, text, html, tags: ["billing", "invitation"] };
}

export function buildSupportTicketReceivedEmail(input: {
  userName: string;
  ticketNumber: string;
  ticketId: string;
  subject: string;
  type: string;
  message: string;
}): BuiltEmail {
  const url = `${base()}/support?ticket=${input.ticketId}`;
  const preview = input.message.slice(0, 400);
  const subject = `CVScholar Support · ${input.ticketNumber} received`;
  const text = textBlock([
    `Hello ${input.userName || "there"},`,
    "",
    "We received your support request.",
    "",
    `Ticket: ${input.ticketNumber}`,
    `Subject: ${input.subject}`,
    `Type: ${input.type}`,
    "",
    "Message:",
    preview + (input.message.length > 400 ? "…" : ""),
    "",
    `View conversation: ${url}`,
    "",
    "— CVScholar Support"
  ]);
  const html = renderEmailLayout({
    preheader: `We received ticket ${input.ticketNumber}`,
    title: "We received your request",
    bodyHtml:
      emailParagraphs([`Hello ${input.userName || "there"},`, "We received your support request."]) +
      emailDetailRows([
        ["Ticket", input.ticketNumber],
        ["Subject", input.subject],
        ["Type", input.type]
      ]) +
      emailQuote(preview + (input.message.length > 400 ? "…" : "")),
    cta: { label: "View conversation", url }
  });
  return { subject, text, html, tags: ["support"] };
}

export function buildSupportAdminNewTicketEmail(input: {
  userName: string;
  userEmail: string;
  ticketNumber: string;
  ticketId: string;
  subject: string;
  type: string;
  message: string;
}): BuiltEmail {
  const url = `${base()}/admin/support?ticket=${input.ticketId}`;
  const preview = input.message.slice(0, 400);
  const subject = `[${input.ticketNumber}] New ${input.type}: ${input.subject}`;
  const text = textBlock([
    "New support ticket",
    "",
    `Ticket: ${input.ticketNumber}`,
    `From: ${input.userName} <${input.userEmail}>`,
    `Type: ${input.type}`,
    `Subject: ${input.subject}`,
    "",
    "Message:",
    preview + (input.message.length > 400 ? "…" : ""),
    "",
    `Open in admin: ${url}`,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: `New ticket ${input.ticketNumber}`,
    title: "New support ticket",
    bodyHtml:
      emailDetailRows([
        ["Ticket", input.ticketNumber],
        ["From", `${input.userName} <${input.userEmail}>`],
        ["Type", input.type],
        ["Subject", input.subject]
      ]) + emailQuote(preview + (input.message.length > 400 ? "…" : "")),
    cta: { label: "Open in admin", url }
  });
  return { subject, text, html, tags: ["support", "admin"] };
}

export function buildSupportReplyToUserEmail(input: {
  userName: string;
  ticketNumber: string;
  ticketId: string;
  subject: string;
  message: string;
  adminName?: string;
}): BuiltEmail {
  const url = `${base()}/support?ticket=${input.ticketId}`;
  const preview = input.message.slice(0, 400);
  const subject = `CVScholar Support · Reply on ${input.ticketNumber}`;
  const text = textBlock([
    `Hello ${input.userName || "there"},`,
    "",
    `${input.adminName || "Support"} replied to your ticket ${input.ticketNumber}.`,
    "",
    `Subject: ${input.subject}`,
    "",
    "Reply:",
    preview + (input.message.length > 400 ? "…" : ""),
    "",
    `View and reply: ${url}`,
    "",
    "— CVScholar Support"
  ]);
  const html = renderEmailLayout({
    preheader: `Reply on ${input.ticketNumber}`,
    title: "New reply on your ticket",
    bodyHtml:
      emailParagraphs([
        `Hello ${input.userName || "there"},`,
        `${input.adminName || "Support"} replied to your ticket ${input.ticketNumber}.`
      ]) +
      emailDetailRows([["Subject", input.subject]]) +
      emailQuote(preview + (input.message.length > 400 ? "…" : "")),
    cta: { label: "View and reply", url }
  });
  return { subject, text, html, tags: ["support"] };
}

export function buildSupportUserReplyToAdminEmail(input: {
  userName: string;
  userEmail: string;
  ticketNumber: string;
  ticketId: string;
  subject: string;
  message: string;
}): BuiltEmail {
  const url = `${base()}/admin/support?ticket=${input.ticketId}`;
  const preview = input.message.slice(0, 400);
  const subject = `[${input.ticketNumber}] User reply: ${input.subject}`;
  const text = textBlock([
    "User replied to a support ticket",
    "",
    `Ticket: ${input.ticketNumber}`,
    `From: ${input.userName} <${input.userEmail}>`,
    `Subject: ${input.subject}`,
    "",
    "Reply:",
    preview + (input.message.length > 400 ? "…" : ""),
    "",
    `Open in admin: ${url}`,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: `User reply on ${input.ticketNumber}`,
    title: "User replied",
    bodyHtml:
      emailDetailRows([
        ["Ticket", input.ticketNumber],
        ["From", `${input.userName} <${input.userEmail}>`],
        ["Subject", input.subject]
      ]) + emailQuote(preview + (input.message.length > 400 ? "…" : "")),
    cta: { label: "Open in admin", url }
  });
  return { subject, text, html, tags: ["support", "admin"] };
}

export function buildWebsiteContactEmail(input: {
  ownerName: string;
  username: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  message: string;
}): BuiltEmail {
  const subject = input.subject
    ? `[Website contact] ${input.subject}`
    : `[Website contact] Message for ${input.username}`;
  const text = textBlock([
    `Hello ${input.ownerName || "scholar"},`,
    "",
    `You received a contact message on your CVScholar website (${input.username}).`,
    "",
    `From: ${input.visitorName} <${input.visitorEmail}>`,
    input.subject ? `Subject: ${input.subject}` : "",
    "",
    input.message,
    "",
    "Reply directly to the visitor email above."
  ]);
  const html = renderEmailLayout({
    preheader: `Contact message for ${input.username}`,
    title: "New website message",
    bodyHtml:
      emailParagraphs([
        `Hello ${input.ownerName || "scholar"},`,
        `You received a contact message on your CVScholar website (${input.username}).`
      ]) +
      emailDetailRows([
        ["From", `${input.visitorName} <${input.visitorEmail}>`],
        ["Subject", input.subject || "—"]
      ]) +
      emailQuote(input.message) +
      emailMuted("Reply directly to the visitor email (Reply-To is set when possible).")
  });
  return { subject, text, html, tags: ["website", "contact"] };
}

export function buildMobileHandoffEmail(input: { name: string; link: string }): BuiltEmail {
  const subject = "CVScholar · Finish your CV on a laptop";
  const text = textBlock([
    `Hello ${input.name || "there"},`,
    "",
    "Your academic CV draft is ready to finish on a laptop.",
    "Open this link on a computer:",
    "",
    input.link,
    "",
    "— CVScholar"
  ]);
  const html = renderEmailLayout({
    preheader: "Continue your CV on a laptop",
    title: "Finish on a laptop",
    bodyHtml: emailParagraphs([
      `Hello ${input.name || "there"},`,
      "Your academic CV draft is ready to finish on a laptop. Open the link below on a computer for the full editor."
    ]),
    cta: { label: "Continue on laptop", url: input.link }
  });
  return { subject, text, html, tags: ["mobile", "handoff"] };
}

/** Sample payloads for admin test sends. */
export function buildTestEmail(kind: TransactionalEmailKind, to: string): BuiltEmail {
  const resetUrl = absoluteUrl("/reset-password?token=test-preview");
  const inviteUrl = absoluteUrl("/invite/test-token");
  const handoffUrl = absoluteUrl("/profile?from=mobile");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  switch (kind) {
    case "password_reset":
      return buildPasswordResetEmail({ name: "Test Scholar", url: resetUrl });
    case "plan_granted":
      return buildPlanGrantedEmail({
        name: "Test Scholar",
        planName: "Scholar Annual",
        expiresAt: expires,
        source: "admin"
      });
    case "plan_expiring":
      return buildPlanExpiringEmail({
        name: "Test Scholar",
        planName: "PDF Pass",
        daysRemaining: 3,
        expiresAt: expires
      });
    case "plan_expired":
      return buildPlanExpiredEmail({ name: "Test Scholar", previousPlanName: "PDF Pass" });
    case "invitation":
      return buildInvitationEmail({
        planName: "Scholar Annual",
        redeemUrl: inviteUrl,
        expiresAt: expires,
        adminEmail: "admin@cvscholar.com",
        to
      });
    case "support_ticket_received":
      return buildSupportTicketReceivedEmail({
        userName: "Test Scholar",
        ticketNumber: "CVS-TEST-1001",
        ticketId: "test-ticket-id",
        subject: "Cannot download PDF",
        type: "support",
        message: "This is a sample support message used for transactional email testing."
      });
    case "support_admin_new_ticket":
      return buildSupportAdminNewTicketEmail({
        userName: "Test Scholar",
        userEmail: to,
        ticketNumber: "CVS-TEST-1001",
        ticketId: "test-ticket-id",
        subject: "Cannot download PDF",
        type: "support",
        message: "This is a sample support message used for transactional email testing."
      });
    case "support_reply_to_user":
      return buildSupportReplyToUserEmail({
        userName: "Test Scholar",
        ticketNumber: "CVS-TEST-1001",
        ticketId: "test-ticket-id",
        subject: "Cannot download PDF",
        message: "Thanks for writing in. Here is a sample admin reply for design testing.",
        adminName: "CVScholar Support"
      });
    case "support_user_reply_to_admin":
      return buildSupportUserReplyToAdminEmail({
        userName: "Test Scholar",
        userEmail: to,
        ticketNumber: "CVS-TEST-1001",
        ticketId: "test-ticket-id",
        subject: "Cannot download PDF",
        message: "Thanks — that helped. Sample user follow-up for testing."
      });
    case "website_contact":
      return buildWebsiteContactEmail({
        ownerName: "Test Scholar",
        username: "test-scholar",
        visitorName: "Visitor Name",
        visitorEmail: "visitor@example.com",
        subject: "Collaboration inquiry",
        message: "Hello — this is a sample contact form message for email design testing."
      });
    case "mobile_handoff":
      return buildMobileHandoffEmail({ name: "Test Scholar", link: handoffUrl });
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
