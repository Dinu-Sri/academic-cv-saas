import { resolveEmailProvider } from "@/lib/email/config";
import { sendViaBrevo } from "@/lib/email/brevo";
import { sendViaResend } from "@/lib/email/resend";
import type { EmailSendResult, TransactionalEmailInput } from "@/lib/email/types";

/**
 * Provider-agnostic transactional send.
 * Prefer Brevo when BREVO_API_KEY is set; fall back to Resend.
 * No-ops with reason not_configured when neither key is present.
 */
export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<EmailSendResult> {
  const provider = resolveEmailProvider();
  if (!provider) {
    return { sent: false, reason: "not_configured" };
  }
  if (provider === "brevo") {
    return sendViaBrevo(input);
  }
  return sendViaResend(input);
}
