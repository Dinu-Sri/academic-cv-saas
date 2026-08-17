/** Standard + custom Meta event names used by CVScholar. */

export const MetaStandardEvent = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  CompleteRegistration: "CompleteRegistration",
  StartTrial: "StartTrial",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
  Subscribe: "Subscribe",
  Contact: "Contact"
} as const;

export const MetaCustomEvent = {
  CvGenerated: "CvGenerated",
  WebsitePublished: "WebsitePublished",
  CvShareCreated: "CvShareCreated",
  InviteRedeemed: "InviteRedeemed"
} as const;

export type MetaStandardEventName = (typeof MetaStandardEvent)[keyof typeof MetaStandardEvent];
export type MetaCustomEventName = (typeof MetaCustomEvent)[keyof typeof MetaCustomEvent];
export type MetaEventName = MetaStandardEventName | MetaCustomEventName;

export type MetaContentParams = {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: "product" | "product_group";
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  currency?: string;
  value?: number;
  num_items?: number;
  status?: boolean;
  predicted_ltv?: number;
  order_id?: string;
};

export function registrationEventId(userId: string) {
  return `reg_${userId}`;
}

export function trialEventId(userId: string) {
  return `trial_${userId}`;
}

export function purchaseEventId(orderId: string) {
  return orderId;
}

export function subscribeEventId(orderId: string) {
  return `${orderId}_subscribe`;
}

export function inviteRedeemedEventId(invitationId: string) {
  return `invite_${invitationId}`;
}
