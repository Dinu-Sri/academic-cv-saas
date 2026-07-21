export const SUPPORT_TICKET_TYPES = ["support", "bug", "feature"] as const;
export type SupportTicketType = (typeof SUPPORT_TICKET_TYPES)[number];

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_PRIORITIES = ["low", "medium", "high"] as const;
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];

export const SUPPORT_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
export const SUPPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORT_MAX_IMAGES_PER_MESSAGE = 3;

export type SupportAttachmentDto = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  url: string;
};

export type SupportMessageDto = {
  id: string;
  body: string;
  isAdminReply: boolean;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  attachments: SupportAttachmentDto[];
};

export type SupportTicketListItem = {
  id: string;
  ticketNumber: string;
  type: string;
  subject: string;
  status: string;
  priority: string;
  hasUnreadAdminReply: boolean;
  hasUnreadUserReply: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

export type SupportUserContext = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  accountCreatedAt: string;
  isGuest: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceSlug: string | null;
  planKey: string;
  planName: string;
  planStatus: string;
  isPaid: boolean;
  planExpiresAt: string | null;
  daysRemaining: number | null;
  paymentCount: number;
  lastPaymentAt: string | null;
  profileDisplayName: string | null;
  cvDocumentCount: number;
  websiteStatus: string | null;
  websiteUsername: string | null;
};

export type SupportTicketDetail = SupportTicketListItem & {
  messages: SupportMessageDto[];
  userContext?: SupportUserContext | null;
};

export function isSupportTicketType(value: string): value is SupportTicketType {
  return (SUPPORT_TICKET_TYPES as readonly string[]).includes(value);
}

export function isSupportTicketStatus(value: string): value is SupportTicketStatus {
  return (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}

export function isSupportTicketPriority(value: string): value is SupportTicketPriority {
  return (SUPPORT_TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function supportTypeLabel(type: string) {
  switch (type) {
    case "bug":
      return "Bug report";
    case "feature":
      return "Feature request";
    default:
      return "Support";
  }
}

export function supportStatusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}
