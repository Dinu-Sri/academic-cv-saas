"use client";

import type { MetaContentParams, MetaEventName } from "@/lib/meta/events";

type FbqFn = (
  command: string,
  eventOrId?: string,
  params?: Record<string, unknown> | string,
  options?: { eventID?: string }
) => void;

declare global {
  interface Window {
    fbq?: FbqFn & { queue?: unknown[]; callMethod?: (...args: unknown[]) => void; loaded?: boolean; version?: string };
    _fbq?: Window["fbq"];
    __cvscholarMetaPixelReady?: boolean;
  }
}

export function isMetaPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function" && Boolean(window.__cvscholarMetaPixelReady);
}

export function trackMetaBrowser(
  eventName: MetaEventName | string,
  params: MetaContentParams = {},
  eventId?: string
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      clean[key] = value;
    }
  }

  try {
    if (eventId) {
      window.fbq("track", eventName, clean, { eventID: eventId });
    } else {
      window.fbq("track", eventName, clean);
    }
  } catch {
    // ignore ad-blocker / script errors
  }
}

export function trackMetaBrowserCustom(
  eventName: string,
  params: MetaContentParams = {},
  eventId?: string
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      clean[key] = value;
    }
  }

  try {
    if (eventId) {
      window.fbq("trackCustom", eventName, clean, { eventID: eventId });
    } else {
      window.fbq("trackCustom", eventName, clean);
    }
  } catch {
    // ignore
  }
}

/** Client helpers for common product milestones (dedup IDs must match server). */
export function trackBrowserCompleteRegistration(userId: string, value = 2) {
  trackMetaBrowser(
    "CompleteRegistration",
    {
      status: true,
      content_name: "AccountCreated",
      content_category: "auth",
      value,
      currency: "USD"
    },
    `reg_${userId}`
  );
}

export function trackBrowserStartTrial(userId: string, value = 3) {
  trackMetaBrowser(
    "StartTrial",
    {
      content_name: "FreePlan",
      content_category: "auth",
      value,
      currency: "USD"
    },
    `trial_${userId}`
  );
}

export function trackBrowserInitiateCheckout(args: {
  orderId: string;
  planKey: string;
  planName: string;
  value: number;
}) {
  trackMetaBrowser(
    "InitiateCheckout",
    {
      content_ids: [args.planKey],
      content_type: "product",
      content_name: args.planName,
      content_category: "billing",
      value: args.value,
      currency: "USD",
      num_items: 1
    },
    args.orderId
  );
}

export function trackBrowserPurchase(args: {
  orderId: string;
  planKey: string;
  planName: string;
  value: number;
}) {
  trackMetaBrowser(
    "Purchase",
    {
      content_ids: [args.planKey],
      content_type: "product",
      content_name: args.planName,
      content_category: "billing",
      value: args.value,
      currency: "USD",
      num_items: 1,
      order_id: args.orderId
    },
    args.orderId
  );

  if (args.planKey === "scholar_annual") {
    trackMetaBrowser(
      "Subscribe",
      {
        content_ids: [args.planKey],
        content_type: "product",
        content_name: args.planName,
        content_category: "billing",
        value: args.value,
        currency: "USD",
        predicted_ltv: args.value
      },
      `${args.orderId}_subscribe`
    );
  }
}

export function trackBrowserViewContent(args: {
  contentName: string;
  contentCategory: string;
  contentIds?: string[];
}) {
  trackMetaBrowser("ViewContent", {
    content_name: args.contentName,
    content_category: args.contentCategory,
    ...(args.contentIds?.length
      ? { content_ids: args.contentIds, content_type: "product" as const }
      : {})
  });
}
