import type { PlanEntitlements, PlanKey } from "@/lib/billing/plans";
import { planDisplayName } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";

export type { PlanEntitlements };
export { PDF_DOWNLOAD_LOCKED_CODE, CUSTOM_DOMAIN_LOCKED_CODE } from "@/lib/billing/plans";

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function cycleLabel(planKey: PlanKey, expiresAt: Date | null, isPaid: boolean) {
  if (!isPaid || planKey === "free") return "Free forever — no billing cycle";
  if (!expiresAt) return planDisplayName(planKey);
  const remaining = daysBetween(new Date(), expiresAt);
  if (planKey === "pdf_pass") return `30-day pass · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  if (planKey === "scholar_annual") return `Annual · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  return `${planDisplayName(planKey)} · ${remaining} days left`;
}

export function entitlementsForPlan(
  planKey: PlanKey,
  options?: {
    expiresAt?: Date | null;
    daysRemaining?: number | null;
    cycleLabel?: string;
  }
): PlanEntitlements {
  const isPaid = planKey === "pdf_pass" || planKey === "scholar_annual";
  const canDownloadPdf = isPaid;
  const showPlatformBranding = planKey !== "scholar_annual";
  const canConnectCustomDomain = planKey === "scholar_annual";

  return {
    planKey,
    planName: planDisplayName(planKey),
    isPaid,
    canDownloadPdf,
    showPlatformBranding,
    canConnectCustomDomain,
    canEnablePublicCvDownload: canDownloadPdf,
    expiresAt: options?.expiresAt ? options.expiresAt.toISOString() : null,
    daysRemaining: options?.daysRemaining ?? null,
    cycleLabel:
      options?.cycleLabel ??
      (isPaid ? `${planDisplayName(planKey)} active` : "Free forever — no billing cycle")
  };
}

/** Resolve active plan for a workspace (auto-expires paid plans). */
export async function resolveWorkspacePlanKey(workspaceId: string): Promise<{
  planKey: PlanKey;
  expiresAt: Date | null;
  daysRemaining: number | null;
  cycleLabel: string;
}> {
  let sub = await prisma.workspaceSubscription.findUnique({ where: { workspaceId } });

  if (!sub) {
    sub = await prisma.workspaceSubscription.create({
      data: { workspaceId, planKey: "free", status: "active" }
    });
  }

  const expired =
    sub.planKey !== "free" &&
    sub.expiresAt != null &&
    sub.expiresAt.getTime() < Date.now();

  if (expired) {
    const previousPlanKey = sub.planKey;
    sub = await prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        previousPlanKey,
        planKey: "free",
        status: "expired",
        expiresAt: null,
        sourcePaymentId: null,
        expiryReminderSentAt: null
      }
    });
    // Pause custom domains when Scholar Annual (or other paid plan) lapses.
    if (previousPlanKey === "scholar_annual") {
      const { disableCustomDomainsForWorkspace } = await import("@/lib/website/custom-domain");
      await disableCustomDomainsForWorkspace(
        workspaceId,
        "Scholar Annual ended — custom domain paused until you renew."
      ).catch(() => undefined);
    }
  }

  const isPaid = sub.planKey !== "free" && (!sub.expiresAt || sub.expiresAt.getTime() > Date.now());
  const planKey = (isPaid ? sub.planKey : "free") as PlanKey;
  const expiresAt = isPaid ? sub.expiresAt : null;
  const remaining = expiresAt ? daysBetween(new Date(), expiresAt) : null;

  return {
    planKey,
    expiresAt,
    daysRemaining: remaining,
    cycleLabel: cycleLabel(planKey, expiresAt, isPaid)
  };
}

export async function getEntitlementsForWorkspace(workspaceId: string): Promise<PlanEntitlements> {
  const resolved = await resolveWorkspacePlanKey(workspaceId);
  return entitlementsForPlan(resolved.planKey, {
    expiresAt: resolved.expiresAt,
    daysRemaining: resolved.daysRemaining,
    cycleLabel: resolved.cycleLabel
  });
}

/** Public sites: look up entitlements by published website workspace. */
export async function getEntitlementsForWebsiteWorkspace(workspaceId: string): Promise<PlanEntitlements> {
  return getEntitlementsForWorkspace(workspaceId);
}
