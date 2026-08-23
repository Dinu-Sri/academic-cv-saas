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
  const userMail = buildSupportTicketReceivedEmail({
    userName: input.userName,
    ticketNumber: input.ticketNumber,
    ticketId: input.ticketId,
    subject: input.subject,
    type: input.type,
    message: input.message
  });
  const adminMail = buildSupportAdminNewTicketEmail({
    userName: input.userName,
    userEmail: input.userEmail,
    ticketNumber: input.ticketNumber,
    ticketId: input.ticketId,
    subject: input.subject,
    type: input.type,
    message: input.message
  });

  await Promise.all([
    sendMail({
      to: input.userEmail,
      subject: userMail.subject,
      text: userMail.text,
      html: userMail.html,
      tags: userMail.tags
    }),
    sendMail({
      to: supportInboxEmail(),
      subject: adminMail.subject,
      text: adminMail.text,
      html: adminMail.html,
      replyTo: input.userEmail,
      tags: adminMail.tags
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
  return sendMail({
    to: supportInboxEmail(),
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: input.userEmail,
    tags: built.tags
  });
}
