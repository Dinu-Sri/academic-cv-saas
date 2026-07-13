import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before viewing your CV preview." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId") || "";
  const document = documentId
    ? await prisma.cvDocument.findFirst({
        where: { id: documentId, profileId: profile.id },
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

  const pages = await prisma.fileAsset.findMany({
    where: {
      profileId: profile.id,
      documentId: document.id,
      kind: "generated_cv_svg_page"
    },
    orderBy: { filename: "asc" },
    select: {
      id: true,
      filename: true,
      checksumSha256: true,
      updatedAt: true
    }
  });

  if (!pages.length) {
    return NextResponse.json({ error: "SVG preview is not ready yet." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    pageCount: pages.length,
    pages: pages.map((page, index) => ({
      page: index + 1,
      filename: page.filename,
      url: `/api/cv/preview/page?documentId=${encodeURIComponent(document.id)}&page=${index + 1}&v=${encodeURIComponent(page.checksumSha256 || page.updatedAt.toISOString())}`
    }))
  });
}
