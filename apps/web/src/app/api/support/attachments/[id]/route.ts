import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/admin";
import { readStoredAsset } from "@/lib/file-storage";
import { resolveRequestActor } from "@/lib/request-user";
import { getAttachmentForAccess } from "@/lib/support/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await getAttachmentForAccess(id, {
    userId: actor.user.id,
    isAdmin: isPlatformAdmin(actor.user.email)
  });

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(attachment);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${attachment.filename.replace(/"/g, "")}"`
      }
    });
  } catch (error) {
    console.error("[support/attachment]", error);
    return NextResponse.json({ error: "Could not load attachment." }, { status: 500 });
  }
}
