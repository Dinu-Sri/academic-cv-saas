/**
 * Billing event emails via shared provider + minimal HTML templates.
 */

import { sendTransactionalEmail } from "@/lib/email";
import {
  buildPlanExpiredEmail,
  buildPlanExpiringEmail,
  buildPlanGrantedEmail
} from "@/lib/email/templates/catalog";

export async function sendPlanGrantedEmail(input: {
  to: string;
  name: string;
  planName: string;
  expiresAt: Date | null;
  source: "admin" | "purchase" | "staging";
}) {
  const built = buildPlanGrantedEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    tags: built.tags
  });
}

export async function sendPlanExpiringEmail(input: {
  to: string;
  name: string;
  planName: string;
  daysRemaining: number;
  expiresAt: Date;
}) {
  const built = buildPlanExpiringEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    tags: built.tags
  });
}

export async function sendPlanExpiredEmail(input: {
  to: string;
  name: string;
  previousPlanName: string;
}) {
  const built = buildPlanExpiredEmail(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    tags: built.tags
  });
}
