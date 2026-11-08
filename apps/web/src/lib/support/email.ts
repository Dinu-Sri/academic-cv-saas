/**
 * Support ticket notification emails via shared provider + HTML templates.
 */

import { getEmailFromDefault, sendTransactionalEmail } from "@/lib/email";
import {
  buildSupportAdminNewTicketEmail,
  buildSupportReplyToUserEmail,
  buildSupportTicketReceivedEmail,
  buildSupportUserReplyToAdminEmail
} from "@/lib/email/templates/catalog";
import { supportTypeLabel } from "@/lib/support/types";

function uniqueEmails(raw: string) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(",")) {
    const email = part.trim();
    const key = email.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

/** Inbox for ordinary support notifications — configure in Portainer as SUPPORT_EMAIL. */
export function supportInboxEmail() {
  const dedicated = (process.env.SUPPORT_EMAIL || process.env.CVSCHOLAR_SUPPORT_EMAIL || "").trim();
  if (dedicated) return dedicated;
  return uniqueEmails(process.env.CVSCHOLAR_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")[0] || "";
}

/** Every address in CVSCHOLAR_ADMIN_EMAILS, with ADMIN_EMAIL as the fallback list. */
export function configuredAdminEmails() {
  return uniqueEmails(process.env.CVSCHOLAR_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "");
}

/**
 * Peer feedback goes to every admin address. Other tickets stay on the single support inbox.
 * An empty admin list falls back to that inbox so the note is not dropped.
 */
export function adminNotificationRecipients(ticketType: string) {
  if (ticketType === "feedback") {
    const admins = configuredAdminEmails();
    if (admins.length > 0) return admins;
  }
  const inbox = supportInboxEmail();
  return inbox ? [inbox] : [];
}

async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  tags?: string[];
}) {
  return sendTransactionalEmail({
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: args.replyTo,
    from: getEmailFromDefault("CVScholar Support <noreply@cvscholar.com>"),
    tags: args.tags || ["support"]
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
  const displayType = input.type === "feedback" ? supportTypeLabel(input.type) : input.type;
  const userMail = buildSupportTicketReceivedEmail({
    userName: input.userName,
    ticketNumber: input.ticketNumber,
    ticketId: input.ticketId,
    subject: input.subject,
    type: displayType,
    message: input.message
  });
  const adminMail = buildSupportAdminNewTicketEmail({
    userName: input.userName,
    userEmail: input.userEmail,
    ticketNumber: input.ticketNumber,
    ticketId: input.ticketId,
    subject: input.subject,
    type: displayType,
    message: input.message
  });

  const recipients = adminNotificationRecipients(input.type);
  if (input.type === "feedback" && recipients.length === 0) {
    console.error("[support] peer feedback has no CVSCHOLAR_ADMIN_EMAILS recipient");
  }

  await Promise.all([
    sendMail({
      to: input.userEmail,
      subject: userMail.subject,
      text: userMail.text,
      html: userMail.html,
      tags: userMail.tags
    }),
    ...recipients.map((to) =>
      sendMail({
        to,
        subject: adminMail.subject,
        text: adminMail.text,
        html: adminMail.html,
        replyTo: input.userEmail,
        tags: adminMail.tags
      })
    )
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
  ticketType?: string;
}) {
  if (input.isAdminReply) {
    const built = buildSupportReplyToUserEmail({
      userName: input.userName,
      ticketNumber: input.ticketNumber,
      ticketId: input.ticketId,
      subject: input.subject,
      message: input.message,
      adminName: input.adminName
    });
    return sendMail({
      to: input.userEmail,
      subject: built.subject,
      text: built.text,
      html: built.html,
      tags: built.tags
    });
  }

  const built = buildSupportUserReplyToAdminEmail({
    userName: input.userName,
    userEmail: input.userEmail,
    ticketNumber: input.ticketNumber,
    ticketId: input.ticketId,
    subject: input.subject,
    message: input.message
  });
  const recipients = adminNotificationRecipients(input.ticketType || "");
  if (recipients.length === 0) return { sent: false, reason: "not_configured" as const };
  const results = await Promise.all(
    recipients.map((to) =>
      sendMail({
        to,
        subject: built.subject,
        text: built.text,
        html: built.html,
        replyTo: input.userEmail,
        tags: built.tags
      })
    )
  );
  return results[0];
}
