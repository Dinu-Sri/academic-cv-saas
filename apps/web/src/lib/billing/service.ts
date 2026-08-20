import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import {
  getPaidPlan,
  getPlanCatalog,
  isPaidPlanKey,
  planDisplayName,
  type BillingInvoiceInput,
  type BillingStatusPayload,
  type PaidPlanKey,
  type PayHereCheckoutPayload,
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
import {
  sendPlanExpiredEmail,
  sendPlanExpiringEmail,
  sendPlanGrantedEmail
} from "@/lib/billing/email";
import {
  consumeDiscountCodeUse,
  previewDiscountCode,
  type AppliedDiscount
} from "@/lib/billing/discount-codes";

export type { BillingStatusPayload, PayHereCheckoutPayload };
export { getEntitlementsForWorkspace };

const EXPIRY_REMINDER_DAYS = 7;

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type ExpireNotify = {
  previousPlanKey: string;
  workspaceId: string;
};

async function ensureSubscription(workspaceId: string): Promise<{
  sub: Awaited<ReturnType<typeof prisma.workspaceSubscription.create>>;
  justExpired: ExpireNotify | null;
}> {
  const existing = await prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
  if (existing) {
    // Auto-expire paid plans past expiry.
    if (
      existing.planKey !== "free" &&
      existing.expiresAt &&
      existing.expiresAt.getTime() < Date.now()
    ) {
      const previousPlanKey = existing.planKey;
      const sub = await prisma.workspaceSubscription.update({
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
      if (previousPlanKey === "scholar_annual") {
        const { disableCustomDomainsForWorkspace } = await import("@/lib/website/custom-domain");
        await disableCustomDomainsForWorkspace(
          workspaceId,
          "Scholar Annual ended — custom domain paused until you renew."
        ).catch(() => undefined);
      }
      return { sub, justExpired: { previousPlanKey, workspaceId } };
    }
    return { sub: existing, justExpired: null };
  }

  const sub = await prisma.workspaceSubscription.create({
    data: {
      workspaceId,
      planKey: "free",
      status: "active"
    }
  });
  return { sub, justExpired: null };
}

function cycleLabel(planKey: string, expiresAt: Date | null, isPaid: boolean) {
  if (!isPaid || planKey === "free") return "Free forever — no billing cycle";
  if (!expiresAt) return planDisplayName(planKey);
  const remaining = daysBetween(new Date(), expiresAt);
  if (planKey === "pdf_pass") return `30-day pass · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  if (planKey === "scholar_annual") return `Annual · ${remaining} day${remaining === 1 ? "" : "s"} left`;
  return `${planDisplayName(planKey)} · ${remaining} days left`;
}

async function maybeSendExpiryReminder(
  user: Pick<User, "id" | "name" | "email">,
  workspaceId: string,
  planKey: PlanKey,
  daysRemaining: number | null,
  expiresAt: Date | null,
  reminderSentAt: Date | null
) {
  if (!expiresAt || daysRemaining == null) return;
  if (daysRemaining > EXPIRY_REMINDER_DAYS || daysRemaining < 1) return;
  if (reminderSentAt) return;

  await sendPlanExpiringEmail({
    to: user.email,
    name: user.name,
    planName: planDisplayName(planKey),
    daysRemaining,
    expiresAt
  });

  await prisma.workspaceSubscription.update({
    where: { workspaceId },
    data: { expiryReminderSentAt: new Date() }
  });
}

export async function getBillingStatusForUser(user: Pick<User, "id" | "name" | "email">): Promise<BillingStatusPayload> {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const { sub, justExpired } = await ensureSubscription(workspace.id);

  if (justExpired) {
    void sendPlanExpiredEmail({
      to: user.email,
      name: user.name,
      previousPlanName: planDisplayName(justExpired.previousPlanKey)
    });
  }

  const payhere = getPayHereConfig();
  const isPaid = sub.planKey !== "free" && (!sub.expiresAt || sub.expiresAt.getTime() > Date.now());
  const planKey = (isPaid ? sub.planKey : "free") as PlanKey;
  const expiresAt = isPaid ? sub.expiresAt : null;
  const daysRemaining = expiresAt ? daysBetween(new Date(), expiresAt) : null;
  const label = cycleLabel(planKey, expiresAt, isPaid);
  const isExpiringSoon =
    isPaid && daysRemaining != null && daysRemaining <= EXPIRY_REMINDER_DAYS && daysRemaining >= 0;
  const previousPlanKey = sub.previousPlanKey ?? justExpired?.previousPlanKey ?? null;
  const justExpiredFlag = Boolean(!isPaid && previousPlanKey && previousPlanKey !== "free");

  if (isExpiringSoon) {
    void maybeSendExpiryReminder(
      user,
      workspace.id,
      planKey,
      daysRemaining,
      expiresAt,
      sub.expiryReminderSentAt
    );
  }

  const recent = await prisma.billingPayment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 12
  });

  const lastInvoice = recent.find((p) => p.invoiceName || p.invoiceEmail);

  return {
    plans: getPlanCatalog(),
    subscription: {
      planKey,
      planName: planDisplayName(planKey),
      status: isPaid ? "active" : justExpiredFlag ? "expired" : sub.status === "expired" ? "expired" : "active",
      isPaid,
      startsAt: sub.startsAt?.toISOString() ?? null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      daysRemaining,
      cycleLabel: label,
      isExpiringSoon,
      justExpired: justExpiredFlag,
      previousPlanKey,
      previousPlanName: previousPlanKey ? planDisplayName(previousPlanKey) : null
    },
    entitlements: entitlementsForPlan(planKey, {
      expiresAt,
      daysRemaining,
      cycleLabel: label
    }),
    payment: {
      gatewayReady: payHereIsConfigured() && !billingDevSimulateEnabled(),
      configured: payHereIsConfigured(),
      sandbox: payhere?.sandbox ?? true,
      currency: payhere?.currency ?? "USD",
      devSimulate: billingDevSimulateEnabled()
    },
    recentPayments: recent.map((p) => {
      const status = p.status;
      const canDismiss = status === "pending" || status === "cancelled" || status === "failed";
      const canRetry =
        (status === "pending" || status === "cancelled" || status === "failed") &&
        isPaidPlanKey(p.planKey) &&
        Number(p.amount) > 0;
      const gateway =
        p.gatewayResponse && typeof p.gatewayResponse === "object"
          ? (p.gatewayResponse as Record<string, unknown>)
          : {};
      const complimentary =
        gateway.source === "admin_grant" ||
        gateway.complimentary === true ||
        (status === "completed" && Number(p.amount) === 0 && !p.discountCode);
      return {
        id: p.id,
        orderId: p.orderId,
        planKey: p.planKey,
        planName: planDisplayName(p.planKey),
        amount: Number(p.amount),
        currency: p.currency,
        status,
        createdAt: p.createdAt.toISOString(),
        invoiceName: p.invoiceName,
        invoiceEmail: p.invoiceEmail,
        canDownloadInvoice: status === "completed",
        canDismiss,
        canRetry,
        complimentary,
        discountCode: p.discountCode || null
      };
    }),
    invoiceDefaults: {
      name: (lastInvoice?.invoiceName || user.name || "").trim(),
      email: (lastInvoice?.invoiceEmail || user.email || "").trim(),
      phone: (lastInvoice?.invoicePhone || "").trim(),
      address: (lastInvoice?.invoiceAddress || "").trim(),
      city: (lastInvoice?.invoiceCity || "").trim(),
      country: (lastInvoice?.invoiceCountry || "").trim()
    }
  };
}

export type CheckoutResult =
  | {
      ok: true;
      mode: "payhere";
      orderId: string;
      planKey: PaidPlanKey;
      planName: string;
      amount: number;
      currency: string;
      discount?: AppliedDiscount | null;
      payhere: PayHereCheckoutPayload;
    }
  | {
      ok: true;
      mode: "coming_soon";
      /** Ephemeral id for Meta InitiateCheckout until gateway is configured. */
      orderId: string;
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
      planName: string;
      amount: number;
      currency: string;
      discount?: AppliedDiscount | null;
    }
  | {
      ok: true;
      mode: "discount_free";
      orderId: string;
      planKey: PaidPlanKey;
      planName: string;
      amount: number;
      currency: string;
      discount: AppliedDiscount;
      expiresAt: string | null;
    }
  | { ok: false; error: string; status: number };

function splitCustomerName(fullName: string | null | undefined) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "CVScholar" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "User" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Start checkout for a paid plan.
 * - CVSCHOLAR_BILLING_DEV_SIMULATE=1 → staging activate without charge
 * - PayHere merchant configured → live/sandbox popup payload
 * - Otherwise → coming_soon message
 */
function normalizeInvoiceInput(
  invoice: BillingInvoiceInput | undefined,
  user: Pick<User, "name" | "email">
): BillingInvoiceInput | null {
  const name = (invoice?.name || user.name || "").trim();
  const email = (invoice?.email || user.email || "").trim();
  const address = (invoice?.address || "").trim();
  const city = (invoice?.city || "").trim();
  const country = (invoice?.country || "").trim();
  const phone = (invoice?.phone || "").trim();
  if (!name || !email || !address || !city || !country) return null;
  if (!email.includes("@")) return null;
  return { name, email, phone, address, city, country };
}

export async function startCheckoutForUser(
  user: Pick<User, "id" | "name" | "email">,
  planKey: string,
  invoice?: BillingInvoiceInput,
  discountCodeRaw?: string | null
): Promise<CheckoutResult> {
  if (!isPaidPlanKey(planKey)) {
    return { ok: false, error: "Invalid plan selected.", status: 400 };
  }

  const plan = getPaidPlan(planKey);
  if (!plan || plan.billingDays == null) {
    return { ok: false, error: "Plan is not available for purchase.", status: 400 };
  }

  const normalizedInvoice = normalizeInvoiceInput(invoice, user);
  if (!normalizedInvoice) {
    return {
      ok: false,
      error: "Please enter billing name, email, address, city, and country for your invoice.",
      status: 400
    };
  }

  const { workspace } = await getOrCreateWorkspaceForUser(user);
  await ensureSubscription(workspace.id); // side-effect: expire if needed

  // Abandon stale open checkouts so the sidebar does not fill with pending rows.
  await prisma.billingPayment.updateMany({
    where: {
      workspaceId: workspace.id,
      status: "pending",
      createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) }
    },
    data: { status: "cancelled" }
  });

  const payhereConfig = getPayHereConfig();
  const currency = payhereConfig?.currency ?? "USD";
  const invoiceFields = {
    invoiceName: normalizedInvoice.name,
    invoiceEmail: normalizedInvoice.email,
    invoicePhone: normalizedInvoice.phone || null,
    invoiceAddress: normalizedInvoice.address,
    invoiceCity: normalizedInvoice.city,
    invoiceCountry: normalizedInvoice.country
  };

  let appliedDiscount: AppliedDiscount | null = null;
  const codeRaw = (discountCodeRaw || "").trim();
  if (codeRaw) {
    const preview = await previewDiscountCode({
      code: codeRaw,
      planKey,
      originalAmount: plan.priceUsd
    });
    if (!preview.ok) {
      return { ok: false, error: preview.error, status: 400 };
    }
    appliedDiscount = preview.discount;
  }

  const chargeAmount = appliedDiscount ? appliedDiscount.finalAmount : plan.priceUsd;
  const discountFields = appliedDiscount
    ? {
        discountCodeId: appliedDiscount.id,
        discountCode: appliedDiscount.code,
        discountAmount: appliedDiscount.discountAmount,
        originalAmount: appliedDiscount.originalAmount
      }
    : {
        discountCodeId: null as string | null,
        discountCode: null as string | null,
        discountAmount: null as number | null,
        originalAmount: null as number | null
      };

  // 100% discount (or free after discount): activate without PayHere.
  if (chargeAmount <= 0 && appliedDiscount) {
    const orderId = `CVS-${workspace.id.slice(0, 8)}-${planKey}-${Date.now()}`;
    await prisma.billingPayment.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        orderId,
        planKey,
        amount: 0,
        currency,
        status: "pending",
        billingDays: plan.billingDays,
        ...invoiceFields,
        ...discountFields,
        gatewayResponse: {
          source: "discount_free",
          discountCode: appliedDiscount.code
        }
      }
    });

    const applied = await applyCompletedPayment(orderId, {
      gatewayResponse: {
        source: "discount_free",
        discountCode: appliedDiscount.code
      }
    });
    if (!applied.ok) {
      return { ok: false, error: applied.error || "Could not apply discount.", status: 500 };
    }

    return {
      ok: true,
      mode: "discount_free",
      orderId,
      planKey,
      planName: plan.name,
      amount: 0,
      currency,
      discount: appliedDiscount,
      expiresAt: "expiresAt" in applied && applied.expiresAt ? applied.expiresAt.toISOString() : null
    };
  }

  // Dev / staging only: create a pending order that simulate can complete.
  if (billingDevSimulateEnabled()) {
    const orderId = `CVS-${workspace.id.slice(0, 8)}-${planKey}-${Date.now()}`;
    await prisma.billingPayment.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        orderId,
        planKey,
        amount: chargeAmount,
        currency,
        status: "pending",
        billingDays: plan.billingDays,
        ...invoiceFields,
        ...discountFields
      }
    });

    void import("@/lib/meta/track").then(({ trackMetaInitiateCheckout }) =>
      trackMetaInitiateCheckout({
        user,
        orderId,
        planKey,
        amountUsd: chargeAmount
      })
    );

    return {
      ok: true,
      mode: "dev_simulate",
      orderId,
      planKey,
      planName: plan.name,
      amount: chargeAmount,
      currency,
      discount: appliedDiscount
    };
  }

  if (!payhereConfig) {
    const orderId = `CHK-${workspace.id.slice(0, 8)}-${planKey}-${Date.now()}`;
    void import("@/lib/meta/track").then(({ trackMetaInitiateCheckout }) =>
      trackMetaInitiateCheckout({
        user,
        orderId,
        planKey,
        amountUsd: chargeAmount
      })
    );

    return {
      ok: true,
      mode: "coming_soon",
      orderId,
      planKey,
      planName: plan.name,
      amount: chargeAmount,
      currency,
      message:
        "Payment gateway is not configured. Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET in Portainer."
    };
  }

  const orderId = `CVS-${workspace.id.slice(0, 8)}-${planKey}-${Date.now()}`;
  await prisma.billingPayment.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      orderId,
      planKey,
      amount: chargeAmount,
      currency,
      status: "pending",
      billingDays: plan.billingDays,
      ...invoiceFields,
      ...discountFields
    }
  });

  void import("@/lib/meta/track").then(({ trackMetaInitiateCheckout }) =>
    trackMetaInitiateCheckout({
      user,
      orderId,
      planKey,
      amountUsd: chargeAmount
    })
  );

  const { absoluteUrl } = await import("@/lib/content/site-url");
  const { generatePayHereHash } = await import("@/lib/billing/payhere");
  const amountStr = chargeAmount.toFixed(2);
  const hash = generatePayHereHash(orderId, chargeAmount, currency, payhereConfig);
  const { firstName, lastName } = splitCustomerName(normalizedInvoice.name);

  return {
    ok: true,
    mode: "payhere",
    orderId,
    planKey,
    planName: plan.name,
    amount: chargeAmount,
    currency,
    discount: appliedDiscount,
    payhere: {
      sandbox: payhereConfig.sandbox,
      merchant_id: payhereConfig.merchantId,
      notify_url: absoluteUrl("/api/billing/notify"),
      order_id: orderId,
      items: plan.name,
      amount: amountStr,
      currency,
      hash,
      first_name: firstName,
      last_name: lastName,
      email: normalizedInvoice.email,
      phone: normalizedInvoice.phone || "",
      address: normalizedInvoice.address,
      city: normalizedInvoice.city,
      country: normalizedInvoice.country,
      custom_1: user.id,
      custom_2: planKey
    }
  };
}

/** Mark an open checkout as cancelled (PayHere dismiss / user abort). */
export async function cancelBillingPaymentForUser(
  user: Pick<User, "id" | "name" | "email">,
  orderId: string
) {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment || payment.workspaceId !== workspace.id || payment.userId !== user.id) {
    return { ok: false as const, error: "Payment not found.", status: 404 };
  }
  if (payment.status === "completed") {
    return { ok: false as const, error: "Completed payments cannot be cancelled.", status: 400 };
  }
  if (payment.status !== "cancelled") {
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: { status: "cancelled" }
    });
  }
  return { ok: true as const };
}

/** Remove a non-completed payment from the recent list (dismiss abandoned checkout). */
export async function dismissBillingPaymentForUser(
  user: Pick<User, "id" | "name" | "email">,
  orderId: string
) {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment || payment.workspaceId !== workspace.id || payment.userId !== user.id) {
    return { ok: false as const, error: "Payment not found.", status: 404 };
  }
  if (payment.status === "completed") {
    return { ok: false as const, error: "Completed payments cannot be removed.", status: 400 };
  }
  await prisma.billingPayment.delete({ where: { id: payment.id } });
  return { ok: true as const };
}

export async function getBillingPaymentForUserInvoice(
  user: Pick<User, "id" | "name" | "email">,
  orderId: string
) {
  const { workspace } = await getOrCreateWorkspaceForUser(user);
  const payment = await prisma.billingPayment.findUnique({ where: { orderId } });
  if (!payment || payment.workspaceId !== workspace.id || payment.userId !== user.id) {
    return null;
  }
  if (payment.status !== "completed") return null;
  return payment;
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
  const { sub } = await ensureSubscription(payment.workspaceId);

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
        sourcePaymentId: payment.id,
        previousPlanKey: null,
        expiryReminderSentAt: null
      },
      update: {
        planKey: payment.planKey,
        status: "active",
        startsAt: now,
        expiresAt,
        sourcePaymentId: payment.id,
        previousPlanKey: null,
        expiryReminderSentAt: null
      }
    })
  ]);

  if (payment.discountCodeId) {
    await consumeDiscountCodeUse(payment.discountCodeId).catch((error) => {
      console.error("[billing/discount] consume failed", error);
    });
  }

  const updated = await prisma.billingPayment.findUnique({ where: { id: payment.id } });

  // Meta Purchase (CAPI authority). Skip free / complimentary / alreadyApplied.
  const amountUsd = Number(payment.amount);
  const gateway =
    payment.gatewayResponse && typeof payment.gatewayResponse === "object"
      ? (payment.gatewayResponse as Record<string, unknown>)
      : {};
  const skipPurchase =
    !Number.isFinite(amountUsd) ||
    amountUsd <= 0 ||
    gateway.source === "admin_grant" ||
    gateway.source === "discount_free";

  if (!skipPurchase) {
    try {
      const payer = await prisma.user.findUnique({
        where: { id: payment.userId },
        select: { id: true, email: true }
      });
      if (payer) {
        void import("@/lib/meta/track").then(({ trackMetaPurchase }) =>
          trackMetaPurchase({
            user: payer,
            orderId: payment.orderId,
            planKey: payment.planKey,
            amountUsd
          })
        );
      }
    } catch (error) {
      console.error("[billing/meta] Purchase tracking failed", error);
    }
  }

  return { ok: true as const, alreadyApplied: false, payment: updated!, expiresAt };
}

/** Admin (or support) grants a plan without payment gateway. */
export async function grantPlanForWorkspace(input: {
  workspaceId: string;
  planKey: PlanKey;
  billingDays?: number | null;
  adminEmail: string;
  note?: string;
  notifyUser?: boolean;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    include: {
      members: {
        where: { role: "owner" },
        take: 1,
        include: { user: true }
      }
    }
  });
  if (!workspace) {
    return { ok: false as const, error: "Workspace not found.", status: 404 };
  }

  const now = new Date();
  await ensureSubscription(workspace.id);

  if (input.planKey === "free") {
    await prisma.workspaceSubscription.update({
      where: { workspaceId: workspace.id },
      data: {
        planKey: "free",
        status: "active",
        expiresAt: null,
        sourcePaymentId: null,
        previousPlanKey: null,
        expiryReminderSentAt: null
      }
    });

    const freeOwner = workspace.members[0]?.user;
    const orderId = `ADMIN-FREE-${workspace.id.slice(0, 8)}-${Date.now()}`;
    await prisma.billingPayment.create({
      data: {
        workspaceId: workspace.id,
        userId: freeOwner?.id || workspace.members[0]?.userId || "admin",
        orderId,
        planKey: "free",
        amount: 0,
        currency: "USD",
        status: "completed",
        billingDays: 0,
        invoiceName: freeOwner?.name || null,
        invoiceEmail: freeOwner?.email || null,
        gatewayResponse: {
          source: "admin_grant",
          complimentary: true,
          adminEmail: input.adminEmail,
          note: input.note || "Set to Free by Clossyan Technologies (Pvt) Ltd"
        }
      }
    });

    const { disableCustomDomainsForWorkspace } = await import("@/lib/website/custom-domain");
    await disableCustomDomainsForWorkspace(
      workspace.id,
      "Plan set to Free — custom domain paused."
    ).catch(() => undefined);

    return { ok: true as const, planKey: "free" as PlanKey, expiresAt: null as Date | null };
  }

  if (!isPaidPlanKey(input.planKey)) {
    return { ok: false as const, error: "Invalid plan.", status: 400 };
  }

  const catalog = getPaidPlan(input.planKey);
  const days = input.billingDays && input.billingDays > 0 ? input.billingDays : catalog?.billingDays || 30;
  const { sub } = await ensureSubscription(workspace.id);

  let base = now;
  if (sub.planKey === input.planKey && sub.expiresAt && sub.expiresAt.getTime() > now.getTime()) {
    base = sub.expiresAt;
  }

  const expiresAt = addDays(base, days);
  const orderId = `ADMIN-${input.planKey}-${workspace.id.slice(0, 8)}-${Date.now()}`;
  const owner = workspace.members[0]?.user;

  const complimentaryNote =
    input.note?.trim() ||
    `Awarded by Clossyan Technologies (Pvt) Ltd free of charge (${planDisplayName(input.planKey)}).`;

  const payment = await prisma.billingPayment.create({
    data: {
      workspaceId: workspace.id,
      userId: owner?.id || "admin",
      orderId,
      planKey: input.planKey,
      amount: 0,
      currency: "USD",
      status: "completed",
      billingDays: days,
      invoiceName: owner?.name || null,
      invoiceEmail: owner?.email || null,
      gatewayResponse: {
        source: "admin_grant",
        complimentary: true,
        adminEmail: input.adminEmail,
        note: complimentaryNote
      }
    }
  });

  await prisma.workspaceSubscription.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      planKey: input.planKey,
      status: "active",
      startsAt: now,
      expiresAt,
      sourcePaymentId: payment.id,
      previousPlanKey: null,
      expiryReminderSentAt: null
    },
    update: {
      planKey: input.planKey,
      status: "active",
      startsAt: now,
      expiresAt,
      sourcePaymentId: payment.id,
      previousPlanKey: null,
      expiryReminderSentAt: null
    }
  });

  if (input.planKey === "scholar_annual") {
    const { reactivateCustomDomainsForWorkspace } = await import("@/lib/website/custom-domain");
    await reactivateCustomDomainsForWorkspace(workspace.id).catch(() => undefined);
  } else if (input.planKey === "pdf_pass") {
    const { disableCustomDomainsForWorkspace } = await import("@/lib/website/custom-domain");
    await disableCustomDomainsForWorkspace(
      workspace.id,
      "Custom domains require Scholar Annual."
    ).catch(() => undefined);
  }

  if (input.notifyUser !== false && owner?.email) {
    void sendPlanGrantedEmail({
      to: owner.email,
      name: owner.name,
      planName: planDisplayName(input.planKey),
      expiresAt,
      source: "admin"
    });
  }

  return { ok: true as const, planKey: input.planKey, expiresAt, paymentId: payment.id };
}

export async function listRecentBillingPaymentsForAdmin(limit = 40) {
  const payments = await prisma.billingPayment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          members: {
            where: { role: "owner" },
            take: 1,
            include: { user: { select: { id: true, name: true, email: true } } }
          }
        }
      }
    }
  });

  return payments.map((p) => {
    const owner = p.workspace.members[0]?.user;
    return {
      id: p.id,
      orderId: p.orderId,
      planKey: p.planKey,
      planName: planDisplayName(p.planKey),
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      billingDays: p.billingDays,
      createdAt: p.createdAt.toISOString(),
      workspaceId: p.workspaceId,
      workspaceName: p.workspace.name,
      workspaceSlug: p.workspace.slug,
      ownerName: owner?.name || "",
      ownerEmail: owner?.email || "",
      source:
        p.gatewayResponse && typeof p.gatewayResponse === "object" && "source" in p.gatewayResponse
          ? String((p.gatewayResponse as { source?: string }).source || "checkout")
          : "checkout"
    };
  });
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

  if (result.ok && !result.alreadyApplied && isPaidPlanKey(payment.planKey)) {
    void sendPlanGrantedEmail({
      to: user.email,
      name: user.name,
      planName: planDisplayName(payment.planKey),
      expiresAt: "expiresAt" in result ? result.expiresAt ?? null : null,
      source: "staging"
    });
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
    const applied = await applyCompletedPayment(orderId, {
      payherePaymentId: paymentId,
      gatewayResponse: form
    });
    // Match legacy: grant entitlement on notify, then email the customer.
    if (applied.ok && !applied.alreadyApplied && isPaidPlanKey(payment.planKey)) {
      const payer = await prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, name: true }
      });
      if (payer?.email) {
        void sendPlanGrantedEmail({
          to: payer.email,
          name: payer.name,
          planName: planDisplayName(payment.planKey),
          expiresAt: "expiresAt" in applied ? applied.expiresAt ?? null : null,
          source: "purchase"
        });
      }
    }
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
