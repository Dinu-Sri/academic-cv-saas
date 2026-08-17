import {
  getMetaCapiAccessToken,
  getMetaCapiPixelId,
  getMetaCapiTestEventCode,
  isMetaAdvancedMatchingEnabled,
  isMetaCapiEnabled,
  META_GRAPH_API_VERSION
} from "@/lib/meta/config";
import { allowsMetaAdvancedMatching, type MetaConsentSnapshot } from "@/lib/meta/consent";
import type { MetaContentParams, MetaEventName } from "@/lib/meta/events";
import { hashEmail, hashExternalId } from "@/lib/meta/hash";
import type { MetaRequestContext } from "@/lib/meta/request-context";

export type MetaCapiUserInput = {
  email?: string | null;
  userId?: string | null;
  /** When false, skip hashed PII even if Advanced Matching is on. */
  marketingConsent?: boolean | MetaConsentSnapshot | null;
};

export type MetaCapiEventInput = {
  eventName: MetaEventName | string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: "website" | "other";
  customData?: MetaContentParams;
  user?: MetaCapiUserInput;
  request?: MetaRequestContext;
};

type GraphUserData = {
  em?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
};

function consentAllowsMatching(user?: MetaCapiUserInput): boolean {
  if (!isMetaAdvancedMatchingEnabled()) return false;
  if (user?.marketingConsent === undefined || user.marketingConsent === null) {
    // Server hooks without consent snapshot: still send hashed ids when AM enabled
    // (logged-in conversion truth). Prefer explicit consent when available.
    return true;
  }
  if (typeof user.marketingConsent === "boolean") return user.marketingConsent;
  return allowsMetaAdvancedMatching(user.marketingConsent);
}

function buildUserData(input: MetaCapiEventInput): GraphUserData | undefined {
  const data: GraphUserData = {};
  const req = input.request;

  if (req?.clientIpAddress) data.client_ip_address = req.clientIpAddress;
  if (req?.clientUserAgent) data.client_user_agent = req.clientUserAgent;
  if (req?.fbp) data.fbp = req.fbp;
  if (req?.fbc) data.fbc = req.fbc;

  if (consentAllowsMatching(input.user)) {
    const email = (input.user?.email || "").trim();
    if (email) data.em = [hashEmail(email)];
    const userId = (input.user?.userId || "").trim();
    if (userId) data.external_id = [hashExternalId(userId)];
  }

  if (
    !data.em &&
    !data.external_id &&
    !data.client_ip_address &&
    !data.client_user_agent &&
    !data.fbp &&
    !data.fbc
  ) {
    return undefined;
  }
  return data;
}

function toGraphEvent(input: MetaCapiEventInput) {
  const userData = buildUserData(input);
  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource || "website"
  };

  const sourceUrl = input.eventSourceUrl || input.request?.eventSourceUrl;
  if (sourceUrl) event.event_source_url = sourceUrl;
  if (userData) event.user_data = userData;
  if (input.customData && Object.keys(input.customData).length > 0) {
    event.custom_data = input.customData;
  }
  return event;
}

/**
 * Send one or more events to Meta Conversions API.
 * Failures are logged and swallowed so product flows never break.
 */
export async function sendMetaCapiEvents(events: MetaCapiEventInput[]): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isMetaCapiEnabled() || events.length === 0) {
    return { ok: true, skipped: true };
  }

  const pixelId = getMetaCapiPixelId();
  const token = getMetaCapiAccessToken();
  const testCode = getMetaCapiTestEventCode();

  const body: Record<string, unknown> = {
    data: events.map(toGraphEvent)
  };
  if (testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Avoid hanging product paths
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[meta/capi] Graph error", response.status, text.slice(0, 500));
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error("[meta/capi]", error);
    return { ok: false };
  }
}

export async function sendMetaCapiEvent(event: MetaCapiEventInput) {
  return sendMetaCapiEvents([event]);
}
