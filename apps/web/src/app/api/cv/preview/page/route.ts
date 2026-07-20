import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { readStoredAsset } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before viewing your CV preview." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId") || "";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
  const filename = `page-${String(page).padStart(3, "0")}.svg`;

  const asset = await prisma.fileAsset.findFirst({
    where: {
      profileId: profile.id,
      documentId,
      kind: "generated_cv_svg_page",
      filename
    },
    orderBy: { updatedAt: "desc" }
  });

  if (!asset) {
    return NextResponse.json({ error: "SVG preview page was not found." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(asset);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "SVG preview page could not be read." }, { status: 404 });
  }
}
