export {
  getBrevoApiKey,
  getBrevoAllUsersListId,
  getBrevoMarketingListId,
  getEmailFromDefault,
  isBrevoContactSyncEnabled,
  isEmailSendingConfigured,
  resolveEmailProvider
} from "@/lib/email/config";
export { sendTransactionalEmail } from "@/lib/email/send";
export { syncMarketingContact, syncUserContactOnSignup } from "@/lib/email/contacts";
export type {
  ContactSyncInput,
  EmailProviderName,
  EmailSendResult,
  TransactionalEmailInput
} from "@/lib/email/types";
