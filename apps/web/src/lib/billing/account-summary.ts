import type { User } from "@/generated/prisma/client";
import { isPlatformAdmin } from "@/lib/admin";
import { getBillingStatusForUser } from "@/lib/billing/service";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

/** Lightweight summary for header sales CTA + admin nav. */
export async function getAccountSummaryForUser(user: Pick<User, "id" | "name" | "email">) {
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const billing = await getBillingStatusForUser(user);

  const readyPdf = await prisma.cvDocument.findFirst({
    where: {
      profileId: profile.id,
      OR: [{ pdfPath: { not: "" } }, { lastCompiledAt: { not: null } }]
    },
    select: { id: true }
  });

  // Prefer file-asset truth when available (rewrite pipeline stores generated_cv_pdf).
  const readyAsset = readyPdf
    ? await prisma.fileAsset.findFirst({
        where: {
          profileId: profile.id,
          kind: "generated_cv_pdf"
        },
        select: { id: true }
      })
    : null;

  const hasPdfReady = Boolean(readyAsset || readyPdf);

  return {
    workspaceId: workspace.id,
    planKey: billing.subscription.planKey,
    planName: billing.subscription.planName,
    isPaid: billing.subscription.isPaid,
    daysRemaining: billing.subscription.daysRemaining,
    isExpiringSoon: billing.subscription.isExpiringSoon,
    canDownloadPdf: billing.entitlements.canDownloadPdf,
    hasPdfReady,
    unlockPriceUsd: Number(process.env.CVSCHOLAR_BILLING_PDF_PASS_USD || "5") || 5,
    isAdmin: isPlatformAdmin(user.email)
  };
}
