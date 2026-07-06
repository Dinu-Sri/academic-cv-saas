import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredAsset } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before downloading your CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const asset = await prisma.fileAsset.findFirst({
    where: {
      profileId: profile.id,
      kind: "generated_cv_pdf"
    },
    orderBy: { updatedAt: "desc" }
  });

  if (!asset) {
    return NextResponse.json({ error: "Generate your CV before downloading." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(asset);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asset.filename || "academic-cv.pdf"}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Generated PDF file could not be found. Please generate it again." }, { status: 404 });
  }
}
