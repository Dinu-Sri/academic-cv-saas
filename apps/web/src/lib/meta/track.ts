/**
 * Server-side Meta conversion helpers for product hooks.
 * Safe to call fire-and-forget; never throws to callers.
 */

import { META_CURRENCY, META_SOFT_VALUES } from "@/lib/meta/config";
import { sendMetaCapiEvent, sendMetaCapiEvents, type MetaCapiEventInput } from "@/lib/meta/capi";
import {
  inviteRedeemedEventId,
  MetaCustomEvent,
  MetaStandardEvent,
  purchaseEventId,
  registrationEventId,
  subscribeEventId,
  trialEventId
} from "@/lib/meta/events";
import type { MetaRequestContext } from "@/lib/meta/request-context";
import { getPaidPlan, planDisplayName } from "@/lib/billing/plans";

type UserBits = {
  id: string;
  email?: string | null;
};

function safeUrl(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined;
  try {
    if (pathOrUrl.startsWith("http")) return pathOrUrl;
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      "https://cvscholar.com"
    ).replace(/\/$/, "");
    return `${base}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  } catch {
    return undefined;
  }
}

export async function trackMetaCompleteRegistration(args: {
  user: UserBits;
  request?: MetaRequestContext;
  marketingConsent?: boolean | null;
}) {
  try {
    await sendMetaCapiEvent({
      eventName: MetaStandardEvent.CompleteRegistration,
      eventId: registrationEventId(args.user.id),
      eventSourceUrl: safeUrl("/"),
      customData: {
        status: true,
        content_name: "AccountCreated",
        content_category: "auth",
        value: META_SOFT_VALUES.completeRegistration,
        currency: META_CURRENCY
      },
      user: {
        userId: args.user.id,
        email: args.user.email,
        marketingConsent: args.marketingConsent
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] CompleteRegistration", error);
  }
}

/** Once per user after free account creation (not guest-only). */
export async function trackMetaStartTrial(args: {
  user: UserBits;
  request?: MetaRequestContext;
  marketingConsent?: boolean | null;
}) {
  try {
    await sendMetaCapiEvent({
      eventName: MetaStandardEvent.StartTrial,
      eventId: trialEventId(args.user.id),
      eventSourceUrl: safeUrl("/"),
      customData: {
        content_name: "FreePlan",
        content_category: "auth",
        value: META_SOFT_VALUES.startTrial,
        currency: META_CURRENCY
      },
      user: {
        userId: args.user.id,
        email: args.user.email,
        marketingConsent: args.marketingConsent
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] StartTrial", error);
  }
}

export async function trackMetaInitiateCheckout(args: {
  user: UserBits;
  orderId: string;
  planKey: string;
  amountUsd: number;
  request?: MetaRequestContext;
  marketingConsent?: boolean | null;
}) {
  try {
    const planName = planDisplayName(args.planKey);
    await sendMetaCapiEvent({
      eventName: MetaStandardEvent.InitiateCheckout,
      eventId: args.orderId,
      eventSourceUrl: safeUrl("/billing"),
      customData: {
        content_ids: [args.planKey],
        content_type: "product",
        content_name: planName,
        content_category: "billing",
        value: args.amountUsd,
        currency: META_CURRENCY,
        num_items: 1
      },
      user: {
        userId: args.user.id,
        email: args.user.email,
        marketingConsent: args.marketingConsent
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] InitiateCheckout", error);
  }
}

/**
 * Authority Purchase (+ Subscribe for scholar_annual).
 * Call only when payment is newly completed (not alreadyApplied).
 */
export async function trackMetaPurchase(args: {
  user: UserBits;
  orderId: string;
  planKey: string;
  amountUsd: number;
  request?: MetaRequestContext;
  marketingConsent?: boolean | null;
}) {
  try {
    const plan = getPaidPlan(args.planKey);
    const planName = plan?.name || planDisplayName(args.planKey);
    const value = Number.isFinite(args.amountUsd) ? args.amountUsd : plan?.priceUsd || 0;

    const userPayload = {
      userId: args.user.id,
      email: args.user.email,
      marketingConsent: args.marketingConsent
    };

    const events: MetaCapiEventInput[] = [
      {
        eventName: MetaStandardEvent.Purchase,
        eventId: purchaseEventId(args.orderId),
        eventSourceUrl: safeUrl("/billing"),
        customData: {
          content_ids: [args.planKey],
          content_type: "product",
          content_name: planName,
          content_category: "billing",
          value,
          currency: META_CURRENCY,
          num_items: 1,
          order_id: args.orderId
        },
        user: userPayload,
        request: args.request
      }
    ];

    if (args.planKey === "scholar_annual") {
      events.push({
        eventName: MetaStandardEvent.Subscribe,
        eventId: subscribeEventId(args.orderId),
        eventSourceUrl: safeUrl("/billing"),
        customData: {
          content_ids: [args.planKey],
          content_type: "product",
          content_name: planName,
          content_category: "billing",
          value,
          currency: META_CURRENCY,
          predicted_ltv: value
        },
        user: userPayload,
        request: args.request
      });
    }

    await sendMetaCapiEvents(events);
  } catch (error) {
    console.error("[meta] Purchase", error);
  }
}

/** Free invite / admin grant — never Purchase. */
export async function trackMetaInviteRedeemed(args: {
  user: UserBits;
  invitationId: string;
  planKey: string;
  request?: MetaRequestContext;
}) {
  try {
    await sendMetaCapiEvent({
      eventName: MetaCustomEvent.InviteRedeemed,
      eventId: inviteRedeemedEventId(args.invitationId),
      eventSourceUrl: safeUrl("/invite"),
      customData: {
        content_name: args.planKey,
        content_category: "billing",
        value: 0,
        currency: META_CURRENCY
      },
      user: {
        userId: args.user.id,
        email: args.user.email
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] InviteRedeemed", error);
  }
}

export async function trackMetaWebsitePublished(args: {
  user: UserBits;
  websiteId: string;
  request?: MetaRequestContext;
}) {
  try {
    await sendMetaCapiEvent({
      eventName: MetaCustomEvent.WebsitePublished,
      eventId: `webpub_${args.websiteId}_${Math.floor(Date.now() / 1000)}`,
      eventSourceUrl: safeUrl("/website"),
      customData: {
        content_name: "PublishWebsite",
        content_category: "website",
        value: META_SOFT_VALUES.websitePublished,
        currency: META_CURRENCY
      },
      user: {
        userId: args.user.id,
        email: args.user.email
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] WebsitePublished", error);
  }
}

export async function trackMetaCvGenerated(args: {
  user: UserBits;
  documentId?: string;
  request?: MetaRequestContext;
}) {
  try {
    const onceId = args.documentId
      ? `cvgen_${args.user.id}_${args.documentId}`
      : `cvgen_${args.user.id}`;
    await sendMetaCapiEvent({
      eventName: MetaCustomEvent.CvGenerated,
      eventId: onceId,
      eventSourceUrl: safeUrl("/cv"),
      customData: {
        content_name: "GenerateMyCV",
        content_category: "cv",
        value: META_SOFT_VALUES.cvGenerated,
        currency: META_CURRENCY
      },
      user: {
        userId: args.user.id,
        email: args.user.email
      },
      request: args.request
    });
  } catch (error) {
    console.error("[meta] CvGenerated", error);
  }
}
