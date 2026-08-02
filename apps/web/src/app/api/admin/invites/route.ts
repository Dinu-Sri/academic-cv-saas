import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  createPlanInvitation,
  listPlanInvitations,
  sendInvitationEmail
} from "@/lib/billing/invitations";

const createSchema = z.object({
  email: z.string().trim().email().max(200),
  planKey: z.enum(["pdf_pass", "scholar_annual"]),
  expiresInDays: z.number().int().min(1).max(90).default(14),
  billingDays: z.number().int().min(1).max(730).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  sendEmail: z.boolean().optional().default(true)
});

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("response" in admin && admin.response) return admin.response;

  const invitations = await listPlanInvitations(50);
  return NextResponse.json({ ok: true, invitations });
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  if ("response" in admin && admin.response) return admin.response;

  const body = createSchema.parse(await request.json());
  const created = await createPlanInvitation({
    email: body.email,
    planKey: body.planKey,
    expiresInDays: body.expiresInDays,
    billingDays: body.billingDays,
    note: body.note,
    createdByAdminEmail: admin.session!.user.email
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  let emailResult: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
  if (body.sendEmail) {
    emailResult = await sendInvitationEmail({
      to: created.invitation.email,
      planKey: created.invitation.planKey,
      redeemUrl: created.redeemUrl,
      expiresAt: new Date(created.invitation.expiresAt),
      adminEmail: admin.session!.user.email
    });
  }

  return NextResponse.json({
    ok: true,
    invitation: created.invitation,
    redeemUrl: created.redeemUrl,
    email: emailResult
  });
}
