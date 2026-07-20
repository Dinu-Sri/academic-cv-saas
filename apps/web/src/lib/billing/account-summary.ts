import type { User } from "@/generated/prisma/client";
import { isPlatformAdmin } from "@/lib/admin";
import { getBillingStatusForUser } from "@/lib/billing/service";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

/** Lightweight summary for top-bar credit pill + plan chip + admin nav. */
export async function getAccountSummaryForUser(user: Pick<User, "id" | "name" | "email">) {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const wallet = await prisma.creditWallet.findUnique({ where: { workspaceId: workspace.id } });
  const billing = await getBillingStatusForUser(user);

  return {
    workspaceId: workspace.id,
    credits: wallet?.balance ?? 0,
    planKey: billing.subscription.planKey,
    planName: billing.subscription.planName,
    isPaid: billing.subscription.isPaid,
    daysRemaining: billing.subscription.daysRemaining,
    isExpiringSoon: billing.subscription.isExpiringSoon,
    canDownloadPdf: billing.entitlements.canDownloadPdf,
    isAdmin: isPlatformAdmin(user.email)
  };
}
