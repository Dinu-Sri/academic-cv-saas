import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin";
import { grantPlanForWorkspace } from "@/lib/billing/service";

const bodySchema = z.object({
  workspaceId: z.string().min(1),
  planKey: z.enum(["free", "pdf_pass", "scholar_annual"]),
  billingDays: z.number().int().positive().max(3650).optional().nullable(),
  note: z.string().max(500).optional(),
  notifyUser: z.boolean().optional()
});

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  try {
    const body = bodySchema.parse(await request.json());
    const result = await grantPlanForWorkspace({
      workspaceId: body.workspaceId,
      planKey: body.planKey,
      billingDays: body.billingDays,
      adminEmail: admin.session.user.email,
      note: body.note,
      notifyUser: body.notifyUser
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      planKey: result.planKey,
      expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid grant request." }, { status: 400 });
    }
    console.error("[admin/billing/grant]", error);
    return NextResponse.json({ error: "Grant failed." }, { status: 500 });
  }
}
