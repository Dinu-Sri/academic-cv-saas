import { NextResponse } from "next/server";
import { getEntitlementsForWorkspace } from "@/lib/billing/entitlements";
import { readStoredAsset } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { sanitizePublicWebsiteModel } from "@/lib/website/security";
import type { WebsiteSnapshotModel } from "@/lib/website/snapshot-builder";

type Params = { params: Promise<{ username: string }> };

export async function GET(_: Request, { params }: Params) {
  const { username } = await params;
  const website = await prisma.academicWebsite.findFirst({
    where: {
      username: username.toLowerCase(),
      status: "published",
      archivedAt: null,
      blockedAt: null,
      sourceCvDocumentId: { not: null }
    },
    select: {
      workspaceId: true,
      profileId: true,
      sourceCvDocumentId: true,
      currentSnapshotId: true
    }
  });

  if (!website?.sourceCvDocumentId || !website.currentSnapshotId) {
    return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });
  }

  // Public visitor download still requires the site owner to have a paid download entitlement.
  const entitlements = await getEntitlementsForWorkspace(website.workspaceId);
  if (!entitlements.canEnablePublicCvDownload) {
    return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });
  }

  const activeSnapshot = await prisma.websiteSnapshot.findFirst({
    where: { id: website.currentSnapshotId, status: "active" },
    select: { snapshotJson: true }
  });
  if (!activeSnapshot) return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });

  const snapshot = sanitizePublicWebsiteModel(activeSnapshot.snapshotJson as unknown as WebsiteSnapshotModel);
  if (!snapshot.fieldVisibility?.showCvDownload || !snapshot.cvDownloadUrl) {
    return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });
  }

  const asset = await prisma.fileAsset.findFirst({
    where: {
      profileId: website.profileId,
      documentId: website.sourceCvDocumentId,
      kind: "generated_cv_pdf"
    },
    orderBy: { updatedAt: "desc" }
  });
  if (!asset) return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });

  try {
    const bytes = await readStoredAsset(asset);
    const filename = (asset.filename || "academic-cv.pdf").replace(/[^a-zA-Z0-9._-]+/g, "-");
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Public CV is not available." }, { status: 404 });
  }
}
