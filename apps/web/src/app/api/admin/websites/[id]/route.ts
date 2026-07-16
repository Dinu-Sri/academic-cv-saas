import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  blockWebsiteForAdmin,
  listWebsiteSnapshotsForAdmin,
  unblockWebsiteForAdmin
} from "@/lib/website/admin-ops";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["block", "unblock", "snapshots"]),
  reason: z.string().max(500).optional()
});

export async function GET(_request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  try {
    const { id } = await params;
    const result = await listWebsiteSnapshotsForAdmin(id);
    return NextResponse.json(result);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load website." }, { status });
  }
}

export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  try {
    const { id } = await params;
    const payload = bodySchema.parse(await request.json());
    const adminEmail = admin.session.user.email || "admin";

    if (payload.action === "block") {
      const result = await blockWebsiteForAdmin(id, payload.reason || "", adminEmail);
      return NextResponse.json({ ok: true, website: result });
    }

    if (payload.action === "unblock") {
      const result = await unblockWebsiteForAdmin(id, adminEmail);
      return NextResponse.json({ ok: true, website: result });
    }

    const snapshots = await listWebsiteSnapshotsForAdmin(id);
    return NextResponse.json(snapshots);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update website." }, { status });
  }
}
