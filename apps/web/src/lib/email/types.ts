export type EmailSendResult =
  | { sent: true; provider: EmailProviderName; messageId?: string }
  | { sent: false; reason: "not_configured" | "provider_error" | "network_error" | "invalid_recipient" };

export type EmailProviderName = "brevo" | "resend";

export type TransactionalEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  /** Optional tags for provider logs / webhooks */
  tags?: string[];
  /** Override default EMAIL_FROM */
  from?: string;
};

export type ContactSyncInput = {
  email: string;
  name?: string | null;
  /** When true, add to marketing list; when false, remove from it. */
  marketingOptIn: boolean;
  /**
   * When true, add to BREVO_ALL_USERS_LIST_ID (registered accounts only).
   * Guests who only join marketing must leave this false/undefined.
   */
  isRegisteredUser?: boolean;
  attributes?: Record<string, string | number | boolean | null | undefined>;
};
