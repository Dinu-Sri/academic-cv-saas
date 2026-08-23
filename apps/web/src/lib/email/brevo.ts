import {
  getBrevoAllUsersListId,
  getBrevoApiKey,
  getBrevoMarketingListId,
  getEmailFromDefault,
  parseFromAddress
} from "@/lib/email/config";
import type { ContactSyncInput, EmailSendResult, TransactionalEmailInput } from "@/lib/email/types";

const BREVO_API = "https://api.brevo.com/v3";

function recipients(to: string | string[]): { email: string }[] {
  const list = (Array.isArray(to) ? to : [to])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
  return list;
}

export async function sendViaBrevo(input: TransactionalEmailInput): Promise<EmailSendResult> {
  const apiKey = getBrevoApiKey();
  const to = recipients(input.to);
  if (!apiKey) return { sent: false, reason: "not_configured" };
  if (to.length === 0) return { sent: false, reason: "invalid_recipient" };
  if (!input.text?.trim() && !input.html?.trim()) {
    return { sent: false, reason: "provider_error" };
  }

  const fromRaw = input.from || getEmailFromDefault();
  const sender = parseFromAddress(fromRaw);
  const body: Record<string, unknown> = {
    sender,
    to,
    subject: input.subject,
    ...(input.html?.trim()
      ? { htmlContent: input.html }
      : { textContent: input.text || "" }),
    ...(input.replyTo
      ? { replyTo: parseFromAddress(input.replyTo) }
      : {}),
    ...(input.tags?.length ? { tags: input.tags.slice(0, 10) } : {})
  };

  try {
    const response = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error("[email/brevo] send failed", response.status, await response.text().catch(() => ""));
      return { sent: false, reason: "provider_error" };
    }
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { sent: true, provider: "brevo", messageId: payload.messageId };
  } catch (error) {
    console.error("[email/brevo] send", error);
    return { sent: false, reason: "network_error" };
  }
}

function splitName(name: string | null | undefined): { FIRSTNAME?: string; LASTNAME?: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { FIRSTNAME: parts[0] };
  return { FIRSTNAME: parts[0], LASTNAME: parts.slice(1).join(" ") };
}

/**
 * Upsert a Brevo contact and manage list membership for marketing opt-in.
 * Fire-and-forget safe: never throws to callers that void it.
 */
export async function syncBrevoContact(input: ContactSyncInput): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = getBrevoApiKey();
  const email = input.email.trim().toLowerCase();
  if (!apiKey || !email.includes("@")) {
    return { ok: false, reason: "not_configured" };
  }

  const allListId = getBrevoAllUsersListId();
  const marketingListId = getBrevoMarketingListId();
  const listIds: number[] = [];
  // Users list = registered CVScholar accounts only (never guest newsletter leads).
  if (input.isRegisteredUser && allListId) listIds.push(allListId);
  if (input.marketingOptIn && marketingListId) listIds.push(marketingListId);

  const unlinkListIds: number[] = [];
  if (!input.marketingOptIn && marketingListId) unlinkListIds.push(marketingListId);

  const attributes: Record<string, string | number | boolean> = {
    ...splitName(input.name),
    ...(input.marketingOptIn ? { MARKETING_OPT_IN: true } : { MARKETING_OPT_IN: false }),
    ...(input.isRegisteredUser ? { HAS_ACCOUNT: true } : { HAS_ACCOUNT: false })
  };
  if (input.attributes) {
    for (const [key, value] of Object.entries(input.attributes)) {
      if (value === null || value === undefined || value === "") continue;
      attributes[key] = value;
    }
  }

  const payload: Record<string, unknown> = {
    email,
    attributes,
    updateEnabled: true,
    ...(listIds.length ? { listIds } : {}),
    ...(unlinkListIds.length ? { unlinkListIds } : {})
  };

  try {
    const response = await fetch(`${BREVO_API}/contacts`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    // 201 created, 204 updated (updateEnabled)
    if (response.status === 201 || response.status === 204 || response.ok) {
      return { ok: true };
    }

    // Duplicate without updateEnabled edge — try PUT update
    if (response.status === 400) {
      const errText = await response.text().catch(() => "");
      if (/duplicate|already exists/i.test(errText)) {
        const enc = encodeURIComponent(email);
        const put = await fetch(`${BREVO_API}/contacts/${enc}`, {
          method: "PUT",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": apiKey
          },
          body: JSON.stringify({
            attributes,
            ...(listIds.length ? { listIds } : {}),
            ...(unlinkListIds.length ? { unlinkListIds } : {})
          })
        });
        if (put.ok || put.status === 204) return { ok: true };
        console.error("[email/brevo] contact update failed", put.status, await put.text().catch(() => ""));
        return { ok: false, reason: "provider_error" };
      }
      console.error("[email/brevo] contact create failed", response.status, errText);
      return { ok: false, reason: "provider_error" };
    }

    console.error("[email/brevo] contact sync failed", response.status, await response.text().catch(() => ""));
    return { ok: false, reason: "provider_error" };
  } catch (error) {
    console.error("[email/brevo] contact sync", error);
    return { ok: false, reason: "network_error" };
  }
}
