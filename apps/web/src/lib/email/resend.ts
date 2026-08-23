import { getEmailFromDefault, getResendApiKey } from "@/lib/email/config";
import type { EmailSendResult, TransactionalEmailInput } from "@/lib/email/types";

export async function sendViaResend(input: TransactionalEmailInput): Promise<EmailSendResult> {
  const apiKey = getResendApiKey();
  const toList = (Array.isArray(input.to) ? input.to : [input.to]).map((e) => e.trim()).filter(Boolean);
  if (!apiKey) return { sent: false, reason: "not_configured" };
  if (toList.length === 0) return { sent: false, reason: "invalid_recipient" };
  if (!input.text?.trim() && !input.html?.trim()) {
    return { sent: false, reason: "provider_error" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: input.from || getEmailFromDefault(),
        to: toList,
        subject: input.subject,
        ...(input.html?.trim() ? { html: input.html } : { text: input.text || "" }),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {})
      })
    });
    if (!response.ok) {
      console.error("[email/resend] send failed", response.status, await response.text().catch(() => ""));
      return { sent: false, reason: "provider_error" };
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, provider: "resend", messageId: payload.id };
  } catch (error) {
    console.error("[email/resend] send", error);
    return { sent: false, reason: "network_error" };
  }
}
