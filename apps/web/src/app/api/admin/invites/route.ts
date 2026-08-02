import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  createPlanInvitation,
  listPlanInvitations,
  sendInvitationEmail
} from "@/lib/billing/invitations";

const singleSchema = z.object({
  email: z.string().trim().email().max(200),
  emails: z.undefined().optional(),
  planKey: z.enum(["pdf_pass", "scholar_annual"]),
  expiresInDays: z.number().int().min(1).max(90).default(14),
  billingDays: z.number().int().min(1).max(730).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  sendEmail: z.boolean().optional().default(true)
});

const bulkSchema = z.object({
  emails: z.array(z.string().trim().email().max(200)).min(1).max(100),
  email: z.undefined().optional(),
  planKey: z.enum(["pdf_pass", "scholar_annual"]),
  expiresInDays: z.number().int().min(1).max(90).default(14),
  billingDays: z.number().int().min(1).max(730).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  sendEmail: z.boolean().optional().default(false)
});

const createSchema = z.union([bulkSchema, singleSchema]);

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("response" in admin && admin.response) return admin.response;

  const invitations = await listPlanInvitations(100);
  return NextResponse.json({ ok: true, invitations });
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  if ("response" in admin && admin.response) return admin.response;

  const raw = await request.json();
  // Normalize: accept `email` or `emails` (array or newline/comma string).
  const normalized = normalizeInviteBody(raw);
  const body = createSchema.parse(normalized);
  const adminEmail = admin.session!.user.email;

  if ("emails" in body && body.emails) {
    const results: Array<{
      email: string;
      redeemUrl: string;
      status: "created" | "error";
      error?: string;
    }> = [];
    let created = 0;
    let failed = 0;
    let emailed = 0;
    let emailSkipped = 0;

    for (const email of body.emails) {
      const inviteResult = await createPlanInvitation({
        email,
        planKey: body.planKey,
        expiresInDays: body.expiresInDays,
        billingDays: body.billingDays,
        note: body.note,
        createdByAdminEmail: adminEmail
      });

      if (!inviteResult.ok) {
        failed += 1;
        results.push({
          email,
          redeemUrl: "",
          status: "error",
          error: inviteResult.error
        });
        continue;
      }

      created += 1;
      results.push({
        email: inviteResult.invitation.email,
        redeemUrl: inviteResult.redeemUrl,
        status: "created"
      });

      if (body.sendEmail) {
        const emailResult = await sendInvitationEmail({
          to: inviteResult.invitation.email,
          planKey: inviteResult.invitation.planKey,
          redeemUrl: inviteResult.redeemUrl,
          expiresAt: new Date(inviteResult.invitation.expiresAt),
          adminEmail
        });
        if (emailResult.sent) emailed += 1;
        else emailSkipped += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      failed,
      results,
      email: body.sendEmail ? { sent: emailed, skipped: emailSkipped } : { sent: 0, skipped: created }
    });
  }

  const created = await createPlanInvitation({
    email: body.email,
    planKey: body.planKey,
    expiresInDays: body.expiresInDays,
    billingDays: body.billingDays,
    note: body.note,
    createdByAdminEmail: adminEmail
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
      adminEmail
    });
  }

  return NextResponse.json({
    ok: true,
    invitation: created.invitation,
    redeemUrl: created.redeemUrl,
    email: emailResult,
    results: [
      {
        email: created.invitation.email,
        redeemUrl: created.redeemUrl,
        status: "created" as const
      }
    ],
    created: 1,
    failed: 0
  });
}

function normalizeInviteBody(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const body = { ...(raw as Record<string, unknown>) };

  if (typeof body.emails === "string") {
    body.emails = String(body.emails)
      .split(/[\n,;]+/g)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (Array.isArray(body.emails) && body.emails.length > 0) {
    delete body.email;
    // Dedupe case-insensitively while preserving first casing for display via normalize in create.
    const seen = new Set<string>();
    body.emails = body.emails
      .map((value) => String(value).trim())
      .filter((email) => {
        const key = email.toLowerCase();
        if (!email || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 100);
  }

  return body;
}
