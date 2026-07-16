import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { retryWebsitePublishJobForAdmin } from "@/lib/website/admin-ops";
import { captureWebsiteException } from "@/lib/sentry";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  try {
    const { id } = await params;
    const result = await retryWebsitePublishJobForAdmin(id, admin.session.user.email || "admin");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await captureWebsiteException(error, { tags: { area: "admin_retry" } });
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not retry publish job." }, { status });
  }
}
