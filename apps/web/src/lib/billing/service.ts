import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import {
  getPaidPlan,
  getPlanCatalog,
  isPaidPlanKey,
  planDisplayName,
  type BillingStatusPayload,
  type PaidPlanKey,
  type PlanKey
} from "@/lib/billing/plans";
import { entitlementsForPlan, getEntitlementsForWorkspace } from "@/lib/billing/entitlements";
import {
  billingDevSimulateEnabled,
  getPayHereConfig,
  payHereIsConfigured,
  verifyPayHereIp,
  verifyPayHereNotification
} from "@/lib/billing/payhere";

export type { BillingStatusPayload };
export { getEntitlementsForWorkspace };

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function ensureSubscription(workspaceId: string) {
  const existing = await prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
  if (existing) {
    // Auto-expire paid plans past expiry.
    if (
      existing.planKey !== "free" &&
      existing.expiresAt &&
      existing.expiresAt.getTime() < Date.now() &&
      existing.status === "active"
    ) {
      return prisma.workspaceSubscription.update({
        where: { workspaceId },
        data: {
          planKey: "free",
          status: "active",
          expiresAt: null,
          sourcePaymentId: null
        }
      });
    }
    return existing;
  }

  return prisma.workspaceSubscription.create({
    data: {
      workspaceId,
      planKey: "free",
      status: "active"
    }
  });
}

function cycleLabel(planKey: string, expiresAt: Date | null, isPaid: boolean) {
  if (!isPaid || planKey === "free") return "Free forever — no billing cycle";
  if (!expiresAt) return planDisplayName(planKey);
  const remaining = daysBetween(new Date(), expiresAt);
  if (planKey === "pdf_pass") return `30-day pass · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  if (planKey === "scholar_annual") return `Annual · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  return `${planDisplayName(planKey)} · ${remaining} days left`;
}

export async function getBillingStatusForUser(user: Pick<User, "id" | "name" | "email">): Promise<BillingStatusPayload> {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const sub = await ensureSubscription(workspace.id);
  const payhere = getPayHereConfig();
  const isPaid = sub.planKey !== "free" && (!sub.expiresAt || sub.expiresAt.getTime() > Date.now());
  const planKey = (isPaid ? sub.planKey : "free") as PlanKey;
  const expiresAt = isPaid ? sub.expiresAt : null;
  const daysRemaining = expiresAt ? daysBetween(new Date(), expiresAt) : null;
  const label = cycleLabel(planKey, expiresAt, isPaid);

  const recent = await prisma.billingPayment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return {
    plans: getPlanCatalog(),
    subscription: {
      planKey,
      planName: planDisplayName(planKey),
      status: isPaid ? sub.status : "active",
      isPaid,
      startsAt: sub.startsAt?.toISOString() ?? null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      daysRemaining,
      cycleLabel: label
    },
    entitlements: entitlementsForPlan(planKey, {
      expiresAt,
      daysRemaining,
      cycleLabel: label
    }),
    payment: {
      // Live charge is intentionally deferred — product flow stops at the last button.
      gatewayReady: false,
      configured: payHereIsConfigured(),
      sandbox: payhere?.sandbox ?? true,
      currency: payhere?.currency ?? "USD",
      devSimulate: billingDevSimulateEnabled()
    },
    recentPayments: recent.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      planKey: p.planKey,
      planName: planDisplayName(p.planKey),
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt.toISOString()
    }))
  };
}

export type CheckoutResult =
  | {
      ok: true;
      mode: "coming_soon";
      planKey: PaidPlanKey;
      planName: string;
      amount: number;
      currency: string;
      message: string;
    }
  | {
      ok: true;
      mode: "dev_simulate";
      orderId: string;
      planKey: PaidPlanKey;
      amount: number;
      currency: string;
    }
  | { ok: false; error: string; status: number };

/**
 * Checkout stops at the final pay button until the gateway is wired.
 * Staging can set CVSCHOLAR_BILLING_DEV_SIMULATE=1 to activate a plan without charging.
 */
export async function startCheckoutForUser(
  user: Pick<User, "id" | "name" | "email">,
  planKey: string
): Promise<CheckoutResult> {
  if (!isPaidPlanKey(planKey)) {
    return { ok: false, error: "Invalid plan selected.", status: 400 };
  }

  const plan = getPaidPlan(planKey);
  if (!plan || plan.billingDays == null) {
    return { ok: false, error: "Plan is not available for purchase.", status: 400 };
  }

  const { workspace } = await getOrCreateWorkspaceForUser(user);
  await ensureSubscription(workspace.id);

  const currency = getPayHereConfig()?.currency ?? "USD";

  // Dev / staging only: create a pending order that simulate can complete.
  if (billingDevSimulateEnabled()) {
    const orderId = `CVS-${workspace.id.slice(0, 8)}-${planKey}-${Date.now()}`;
    await prisma.billingPayment.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        orderId,
        planKey,
        amount: plan.priceUsd,
        currency,
        status: "pending",
        billingDays: plan.billingDays
      }
    });

    return {
      ok: true,
      mode: "dev_simulate",
      orderId,
      planKey,
      amount: plan.priceUsd,
      currency
    };
  }

  return {
    ok: true,
    mode: "coming_soon",
    planKey,
    planName: plan.name,
    amount: plan.priceUsd,
    currency,
    message: "Checkout is ready. Secure payment will open on this button in the next release."
  };
}

export async function applyCompletedPayment(orderId: string, extras?: {
  payherePaymentId?: string;
  gatewayResponse?: unknown;
}) {
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment) return { ok: false as const, error: "Payment not found" };
  if (payment.status === "completed") {
    return { ok: true as const, alreadyApplied: true, payment };
  }

  if (!isPaidPlanKey(payment.planKey) || payment.billingDays <= 0) {
    return { ok: false as const, error: "Invalid payment plan" };
  }

  const now = new Date();
  const sub = await ensureSubscription(payment.workspaceId);

  let base = now;
  // Stack time only when extending the same paid plan that is still active.
  if (
    sub.planKey === payment.planKey &&
    sub.expiresAt &&
    sub.expiresAt.getTime() > now.getTime()
  ) {
    base = sub.expiresAt;
  } else if (
    payment.planKey === "scholar_annual" &&
    sub.planKey === "pdf_pass" &&
    sub.expiresAt &&
    sub.expiresAt.getTime() > now.getTime()
  ) {
    // Upgrade: annual starts now (does not stack remaining pass days into annual).
    base = now;
  }

  const expiresAt = addDays(base, payment.billingDays);

  await prisma.$transaction([
    prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        payherePaymentId: extras?.payherePaymentId ?? payment.payherePaymentId,
        gatewayResponse: extras?.gatewayResponse
          ? (extras.gatewayResponse as object)
          : payment.gatewayResponse ?? undefined
      }
    }),
    prisma.workspaceSubscription.upsert({
      where: { workspaceId: payment.workspaceId },
      create: {
        workspaceId: payment.workspaceId,
        planKey: payment.planKey,
        status: "active",
        startsAt: now,
        expiresAt,
        sourcePaymentId: payment.id
      },
      update: {
        planKey: payment.planKey,
        status: "active",
        startsAt: now,
        expiresAt,
        sourcePaymentId: payment.id
      }
    })
  ]);

  const updated = await prisma.billingPayment.findUnique({ where: { id: payment.id } });
  return { ok: true as const, alreadyApplied: false, payment: updated! };
}

export async function simulateCompleteCheckout(
  user: Pick<User, "id" | "name" | "email">,
  orderId: string
) {
  if (!billingDevSimulateEnabled()) {
    return { ok: false as const, error: "Dev simulate is disabled.", status: 403 };
  }

  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment || payment.workspaceId !== workspace.id || payment.userId !== user.id) {
    return { ok: false as const, error: "Payment not found.", status: 404 };
  }

  const result = await applyCompletedPayment(orderId, {
    gatewayResponse: { simulated: true, at: new Date().toISOString() }
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error, status: 400 };
  }

  return { ok: true as const };
}

export async function getPaymentStatusForUser(
  user: Pick<User, "id" | "name" | "email">,
  orderId: string
) {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment || payment.workspaceId !== workspace.id) {
    return null;
  }

  // Client success path: if notify already completed, nothing to do; if still pending after popup,
  // do not auto-complete without gateway confirmation (except dev_simulate endpoint).
  return {
    orderId: payment.orderId,
    planKey: payment.planKey,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency
  };
}

export async function handlePayHereNotify(
  form: Record<string, string>,
  clientIp: string | null
): Promise<{ ok: boolean; message: string; status: number }> {
  const config = getPayHereConfig();
  if (!config) {
    return { ok: false, message: "Gateway not configured", status: 503 };
  }

  if (!verifyPayHereIp(clientIp, config.sandbox)) {
    return { ok: false, message: "Forbidden", status: 403 };
  }

  if (!verifyPayHereNotification(form, config)) {
    return { ok: false, message: "Invalid signature", status: 400 };
  }

  const orderId = form.order_id || "";
  const paymentId = form.payment_id || "";
  const statusCode = Number(form.status_code ?? -99);

  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment) {
    return { ok: false, message: "Payment not found", status: 404 };
  }

  if (statusCode === 2) {
    await applyCompletedPayment(orderId, {
      payherePaymentId: paymentId,
      gatewayResponse: form
    });
    return { ok: true, message: "OK", status: 200 };
  }

  const status =
    statusCode === 0
      ? "pending"
      : statusCode === -1
        ? "cancelled"
        : statusCode === -3
          ? "chargedback"
          : "failed";

  await prisma.billingPayment.update({
    where: { id: payment.id },
    data: {
      status,
      payherePaymentId: paymentId || payment.payherePaymentId,
      gatewayResponse: form
    }
  });

  return { ok: true, message: "OK", status: 200 };
}
