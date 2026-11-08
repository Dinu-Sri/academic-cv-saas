import { NextResponse } from "next/server";
import { PDF_FEEDBACK_REQUIRED_CODE, userNeedsPdfDownloadFeedback } from "@/lib/feedback/service";
import { readStoredAsset } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before downloading your CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  if (!actor.isGuest && (await userNeedsPdfDownloadFeedback(actor.user.id))) {
    return NextResponse.json(
      {
        error: "Share a short peer review to download your PDF. You only need to do this once.",
        code: PDF_FEEDBACK_REQUIRED_CODE
      },
      { status: 403 }
    );
  }
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId") || "";
  const document = documentId
    ? await prisma.cvDocument.findFirst({
        where: {
          id: documentId,
          profileId: profile.id
        },
        select: { id: true }
      })
    : await prisma.cvDocument.findFirst({
        where: { profileId: profile.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true }
      });

  if (!document) {
    return NextResponse.json({ error: "CV version was not found." }, { status: 404 });
  }

  const asset = await prisma.fileAsset.findFirst({
    where: {
      profileId: profile.id,
      documentId: document.id,
      kind: "generated_cv_pdf"
    },
    orderBy: { updatedAt: "desc" }
  });

  if (!asset) {
    return NextResponse.json({ error: "Generate your CV before downloading." }, { status: 404 });
  }

  try {
    const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    const bytes = await readStoredAsset(asset);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${asset.filename || "academic-cv.pdf"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Generated PDF file could not be found. Please generate it again." }, { status: 404 });
  }
}
