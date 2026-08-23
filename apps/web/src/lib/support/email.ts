/**
 * Support ticket notification emails via shared email provider (Brevo / Resend).
 * No-ops when no provider is configured.
 */

import { getEmailFromDefault, sendTransactionalEmail } from "@/lib/email";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://rewrite.cvscholar.com").replace(
    /\/$/,
    ""
  );
}

/** Inbox for admin notifications — configure in Portainer as SUPPORT_EMAIL. */
export function supportInboxEmail() {
  const dedicated = (process.env.SUPPORT_EMAIL || process.env.CVSCHOLAR_SUPPORT_EMAIL || "").trim();
  if (dedicated) return dedicated;
  const admins = (process.env.CVSCHOLAR_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return admins[0] || "";
}

async function sendMail(args: { to: string; subject: string; text: string; replyTo?: string }) {
  return sendTransactionalEmail({
    to: args.to,
    subject: args.subject,
    text: args.text,
    replyTo: args.replyTo,
    from: getEmailFromDefault("CVScholar Support <noreply@cvscholar.com>"),
    tags: ["support"]
  });
}

export async function sendTicketCreatedEmails(input: {
  ticketNumber: string;
  ticketId: string;
  subject: string;
  type: string;
  message: string;
  userName: string;
  userEmail: string;
}) {
  const userUrl = `${appBaseUrl()}/support?ticket=${input.ticketId}`;
  const adminUrl = `${appBaseUrl()}/admin/support?ticket=${input.ticketId}`;
  const preview = input.message.slice(0, 400);

  await Promise.all([
    sendMail({
      to: input.userEmail,
      subject: `CVScholar Support · ${input.ticketNumber} received`,
      text: [
        `Hello ${input.userName || "there"},`,
        "",
        "We received your support request.",
        "",
        `Ticket: ${input.ticketNumber}`,
        `Subject: ${input.subject}`,
        `Type: ${input.type}`,
        "",
        "Message:",
        preview,
        input.message.length > 400 ? "…" : "",
        "",
        `View conversation: ${userUrl}`,
        "",
        "— CVScholar Support"
      ]
        .filter((line) => line !== "")
        .join("\n")
    }),
    sendMail({
      to: supportInboxEmail(),
      subject: `[${input.ticketNumber}] New ${input.type}: ${input.subject}`,
      replyTo: input.userEmail,
      text: [
        "New support ticket",
        "",
        `Ticket: ${input.ticketNumber}`,
        `From: ${input.userName} <${input.userEmail}>`,
        `Type: ${input.type}`,
        `Subject: ${input.subject}`,
        "",
        "Message:",
        preview,
        input.message.length > 400 ? "…" : "",
        "",
        `Open in admin: ${adminUrl}`,
        "",
        "— CVScholar"
      ]
        .filter((line) => line !== "")
        .join("\n")
    })
  ]);
}

export async function sendTicketReplyEmails(input: {
  ticketNumber: string;
  ticketId: string;
  subject: string;
  message: string;
  isAdminReply: boolean;
  userName: string;
  userEmail: string;
  adminName?: string;
}) {
  const preview = input.message.slice(0, 400);
  const userUrl = `${appBaseUrl()}/support?ticket=${input.ticketId}`;
  const adminUrl = `${appBaseUrl()}/admin/support?ticket=${input.ticketId}`;

  if (input.isAdminReply) {
    return sendMail({
      to: input.userEmail,
      subject: `CVScholar Support · Reply on ${input.ticketNumber}`,
      text: [
        `Hello ${input.userName || "there"},`,
        "",
        `${input.adminName || "Support"} replied to your ticket ${input.ticketNumber}.`,
        "",
        `Subject: ${input.subject}`,
        "",
        "Reply:",
        preview,
        input.message.length > 400 ? "…" : "",
        "",
        `View and reply: ${userUrl}`,
        "",
        "— CVScholar Support"
      ]
        .filter((line) => line !== "")
        .join("\n")
    });
  }

  return sendMail({
    to: supportInboxEmail(),
    subject: `[${input.ticketNumber}] User reply: ${input.subject}`,
    replyTo: input.userEmail,
    text: [
      "User replied to a support ticket",
      "",
      `Ticket: ${input.ticketNumber}`,
      `From: ${input.userName} <${input.userEmail}>`,
      `Subject: ${input.subject}`,
      "",
      "Reply:",
      preview,
      input.message.length > 400 ? "…" : "",
      "",
      `Open in admin: ${adminUrl}`,
      "",
      "— CVScholar"
    ]
      .filter((line) => line !== "")
      .join("\n")
  });
}
