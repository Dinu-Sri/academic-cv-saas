import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { readStoredAsset } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; assetId: string }> };

/** Admin-only: stream a user's generated PDF asset for support review. */
export async function GET(_request: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const { id: userId, assetId } = await params;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "User workspace not found." }, { status: 404 });
  }

  const resolved = await prisma.fileAsset.findFirst({
    where: {
      id: assetId,
      workspaceId: membership.workspaceId,
      OR: [
        { kind: "generated_cv_pdf" },
        { mimeType: "application/pdf" },
        { filename: { endsWith: ".pdf" } }
      ]
    }
  });

  if (!resolved) {
    return NextResponse.json({ error: "PDF not found for this user." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(resolved);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": resolved.mimeType || "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${resolved.filename.replace(/"/g, "") || "cv.pdf"}"`,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (error) {
    console.error("[admin/user-pdf]", error);
    return NextResponse.json({ error: "Could not read PDF file." }, { status: 500 });
  }
}
