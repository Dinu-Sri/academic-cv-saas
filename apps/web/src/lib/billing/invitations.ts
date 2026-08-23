import { createHash, randomBytes } from "node:crypto";
import type { PaidPlanKey } from "@/lib/billing/plans";
import { isPaidPlanKey, planDisplayName } from "@/lib/billing/plans";
import { grantPlanForWorkspace } from "@/lib/billing/service";
import { absoluteUrl } from "@/lib/content/site-url";
import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function newToken() {
  return randomBytes(24).toString("base64url");
}

export function invitationRedeemUrl(token: string) {
  return absoluteUrl(`/invite/${encodeURIComponent(token)}`);
}

export async function createPlanInvitation(input: {
  email: string;
  planKey: PaidPlanKey;
  expiresInDays: number;
  billingDays?: number | null;
  note?: string;
  createdByAdminEmail: string;
}) {
  if (!isPaidPlanKey(input.planKey)) {
    return { ok: false as const, error: "Choose PDF Pass or Scholar Annual.", status: 400 };
  }

  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "Enter a valid email address.", status: 400 };
  }

  const days = Math.max(1, Math.min(90, Math.floor(input.expiresInDays || 14)));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = newToken();

  const invite = await prisma.planInvitation.create({
    data: {
      token,
      email,
      planKey: input.planKey,
      billingDays: input.billingDays && input.billingDays > 0 ? input.billingDays : null,
      expiresAt,
      createdByAdminEmail: input.createdByAdminEmail,
      note: (input.note || "").trim().slice(0, 500)
    }
  });

  return {
    ok: true as const,
    invitation: serializeInvitation(invite),
    redeemUrl: invitationRedeemUrl(token)
  };
}

export async function listPlanInvitations(limit = 40) {
  const rows = await prisma.planInvitation.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit))
  });
  return rows.map(serializeInvitation);
}

export async function getPlanInvitationByToken(token: string) {
  const invite = await prisma.planInvitation.findUnique({ where: { token: token.trim() } });
  if (!invite) return null;
  return invite;
}

export function invitationStatus(invite: {
  expiresAt: Date;
  usedAt: Date | null;
  maxUses: number;
}) {
  if (invite.usedAt) return "used" as const;
  if (invite.expiresAt.getTime() <= Date.now()) return "expired" as const;
  return "open" as const;
}

export async function redeemPlanInvitation(input: {
  token: string;
  user: { id: string; email: string; name: string };
  workspaceId: string;
}) {
  const invite = await getPlanInvitationByToken(input.token);
  if (!invite) {
    return { ok: false as const, error: "This invitation link is invalid.", status: 404 };
  }

  const status = invitationStatus(invite);
  if (status === "used") {
    return { ok: false as const, error: "This invitation has already been used.", status: 410 };
  }
  if (status === "expired") {
    return { ok: false as const, error: "This invitation has expired.", status: 410 };
  }

  const userEmail = normalizeEmail(input.user.email);
  if (userEmail !== invite.email) {
    return {
      ok: false as const,
      error: `This invitation is for ${invite.email}. Sign in with that email to redeem it.`,
      status: 403,
      expectedEmail: invite.email
    };
  }

  if (!isPaidPlanKey(invite.planKey)) {
    return { ok: false as const, error: "Invitation plan is invalid.", status: 400 };
  }

  // Atomic claim: only one concurrent redeem wins.
  const claimed = await prisma.planInvitation.updateMany({
    where: {
      id: invite.id,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    data: {
      usedAt: new Date(),
      usedByUserId: input.user.id
    }
  });

  if (claimed.count !== 1) {
    return { ok: false as const, error: "This invitation is no longer available.", status: 410 };
  }

  const grant = await grantPlanForWorkspace({
    workspaceId: input.workspaceId,
    planKey: invite.planKey,
    billingDays: invite.billingDays,
    adminEmail: invite.createdByAdminEmail,
    note: invite.note || `Invite redeem ${invite.id}`,
    notifyUser: true
  });

  if (!grant.ok) {
    // Roll back claim so the user can retry after an admin fix.
    await prisma.planInvitation
      .update({
        where: { id: invite.id },
        data: { usedAt: null, usedByUserId: null }
      })
      .catch(() => undefined);
    return { ok: false as const, error: grant.error || "Could not apply the plan.", status: grant.status || 500 };
  }

  // Meta: free grant is InviteRedeemed only — never Purchase (protects ROAS).
  void import("@/lib/meta/track").then(({ trackMetaInviteRedeemed }) =>
    trackMetaInviteRedeemed({
      user: input.user,
      invitationId: invite.id,
      planKey: invite.planKey
    })
  );

  return {
    ok: true as const,
    planKey: grant.planKey,
    planName: planDisplayName(grant.planKey),
    expiresAt: grant.expiresAt
  };
}

export async function sendInvitationEmail(input: {
  to: string;
  planKey: string;
  redeemUrl: string;
  expiresAt: Date;
  adminEmail: string;
}) {
  const { sendTransactionalEmail } = await import("@/lib/email");
  const { buildInvitationEmail } = await import("@/lib/email/templates/catalog");
  const built = buildInvitationEmail({
    planName: planDisplayName(input.planKey),
    redeemUrl: input.redeemUrl,
    expiresAt: input.expiresAt,
    adminEmail: input.adminEmail,
    to: input.to
  });

  return sendTransactionalEmail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    tags: built.tags
  });
}

function serializeInvitation(invite: {
  id: string;
  token: string;
  email: string;
  planKey: string;
  billingDays: number | null;
  expiresAt: Date;
  maxUses: number;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdByAdminEmail: string;
  note: string;
  createdAt: Date;
}) {
  return {
    id: invite.id,
    token: invite.token,
    email: invite.email,
    planKey: invite.planKey,
    planName: planDisplayName(invite.planKey),
    billingDays: invite.billingDays,
    expiresAt: invite.expiresAt.toISOString(),
    maxUses: invite.maxUses,
    usedAt: invite.usedAt?.toISOString() ?? null,
    usedByUserId: invite.usedByUserId,
    createdByAdminEmail: invite.createdByAdminEmail,
    note: invite.note,
    createdAt: invite.createdAt.toISOString(),
    status: invitationStatus(invite),
    redeemUrl: invitationRedeemUrl(invite.token),
    /** Stable id for UI lists without exposing token elsewhere if needed. */
    fingerprint: createHash("sha256").update(invite.token).digest("hex").slice(0, 12)
  };
}
