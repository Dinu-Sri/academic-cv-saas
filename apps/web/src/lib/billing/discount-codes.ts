import { prisma } from "@/lib/prisma";
import type { PaidPlanKey } from "@/lib/billing/plans";
import { isPaidPlanKey } from "@/lib/billing/plans";

export type DiscountType = "percent" | "fixed";

export type AppliedDiscount = {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
};

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeDiscountAmount(
  originalAmount: number,
  discountType: DiscountType,
  value: number
) {
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) return 0;
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (discountType === "percent") {
    const pct = Math.min(100, Math.max(0, value));
    return roundMoney(Math.min(originalAmount, (originalAmount * pct) / 100));
  }
  return roundMoney(Math.min(originalAmount, value));
}

/**
 * Validate a discount code for a plan/price without consuming a use.
 */
export async function previewDiscountCode(input: {
  code: string;
  planKey: string;
  originalAmount: number;
}): Promise<{ ok: true; discount: AppliedDiscount } | { ok: false; error: string }> {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a discount code." };
  if (!isPaidPlanKey(input.planKey)) return { ok: false, error: "Invalid plan." };

  const row = await prisma.discountCode.findUnique({ where: { code } });
  if (!row || !row.active) {
    return { ok: false, error: "This discount code is not valid." };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This discount code has expired." };
  }
  if (row.maxUses != null && row.usedCount >= row.maxUses) {
    return { ok: false, error: "This discount code has reached its usage limit." };
  }
  if (row.planKey && row.planKey !== input.planKey) {
    return { ok: false, error: "This discount code does not apply to the selected plan." };
  }

  const discountType = row.discountType === "fixed" ? "fixed" : "percent";
  const value = Number(row.value);
  const discountAmount = computeDiscountAmount(input.originalAmount, discountType, value);
  if (discountAmount <= 0) {
    return { ok: false, error: "This discount code does not change the total." };
  }

  const finalAmount = roundMoney(Math.max(0, input.originalAmount - discountAmount));
  return {
    ok: true,
    discount: {
      id: row.id,
      code: row.code,
      discountType,
      value,
      discountAmount,
      originalAmount: roundMoney(input.originalAmount),
      finalAmount
    }
  };
}

/** Atomically increment usedCount after a successful checkout that used the code. */
export async function consumeDiscountCodeUse(discountCodeId: string) {
  await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: { usedCount: { increment: 1 } }
  });
}

export async function listDiscountCodesForAdmin() {
  const rows = await prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return rows.map(serializeDiscountCode);
}

export function serializeDiscountCode(row: {
  id: string;
  code: string;
  discountType: string;
  value: { toString(): string } | number;
  planKey: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  active: boolean;
  note: string;
  createdByAdminEmail: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType as DiscountType,
    value: Number(row.value),
    planKey: (row.planKey || "") as "" | PaidPlanKey,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    active: row.active,
    note: row.note,
    createdByAdminEmail: row.createdByAdminEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function createDiscountCode(input: {
  code: string;
  discountType: DiscountType;
  value: number;
  planKey?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
  note?: string;
  active?: boolean;
  adminEmail: string;
}) {
  const code = normalizeCode(input.code);
  if (!code || code.length < 3 || code.length > 40) {
    return { ok: false as const, error: "Code must be 3–40 characters.", status: 400 };
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return {
      ok: false as const,
      error: "Code may only contain letters, numbers, hyphens, and underscores.",
      status: 400
    };
  }
  if (input.discountType !== "percent" && input.discountType !== "fixed") {
    return { ok: false as const, error: "Invalid discount type.", status: 400 };
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { ok: false as const, error: "Enter a positive discount value.", status: 400 };
  }
  if (input.discountType === "percent" && input.value > 100) {
    return { ok: false as const, error: "Percent discount cannot exceed 100.", status: 400 };
  }
  const planKey = (input.planKey || "").trim();
  if (planKey && !isPaidPlanKey(planKey)) {
    return { ok: false as const, error: "Invalid plan restriction.", status: 400 };
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false as const, error: "Invalid expiry date.", status: 400 };
    }
    expiresAt = d;
  }

  const maxUses =
    input.maxUses == null || input.maxUses === undefined
      ? null
      : Number.isFinite(input.maxUses) && input.maxUses > 0
        ? Math.floor(input.maxUses)
        : null;

  try {
    const row = await prisma.discountCode.create({
      data: {
        code,
        discountType: input.discountType,
        value: input.value,
        planKey,
        maxUses,
        expiresAt,
        note: (input.note || "").trim().slice(0, 500),
        active: input.active !== false,
        createdByAdminEmail: input.adminEmail
      }
    });
    return { ok: true as const, discount: serializeDiscountCode(row) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || msg.includes("discount_codes_code_key")) {
      return { ok: false as const, error: "That code already exists.", status: 409 };
    }
    throw error;
  }
}

export async function updateDiscountCode(
  id: string,
  patch: {
    active?: boolean;
    note?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  }
) {
  const existing = await prisma.discountCode.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "Discount code not found.", status: 404 };

  let expiresAt: Date | null | undefined = undefined;
  if (patch.expiresAt === null) expiresAt = null;
  else if (typeof patch.expiresAt === "string") {
    const d = new Date(patch.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false as const, error: "Invalid expiry date.", status: 400 };
    }
    expiresAt = d;
  }

  const maxUses =
    patch.maxUses === undefined
      ? undefined
      : patch.maxUses == null
        ? null
        : Number.isFinite(patch.maxUses) && patch.maxUses > 0
          ? Math.floor(patch.maxUses)
          : null;

  const row = await prisma.discountCode.update({
    where: { id },
    data: {
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.note !== undefined ? { note: patch.note.trim().slice(0, 500) } : {}),
      ...(maxUses !== undefined ? { maxUses } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    }
  });
  return { ok: true as const, discount: serializeDiscountCode(row) };
}
