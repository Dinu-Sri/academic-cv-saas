import { NextResponse } from "next/server";
import {
  getActiveCvShareBySlug,
  getCvSharePdfAsset
} from "@/lib/cv-share";
import { readStoredAsset } from "@/lib/file-storage";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const share = await getActiveCvShareBySlug(slug);
  if (!share) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const asset = await getCvSharePdfAsset({
    documentId: share.documentId,
    profileId: share.profileId
  });
  if (!asset) {
    return NextResponse.json({ error: "PDF not available." }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "inline";
    const bytes = await readStoredAsset(asset);
    const filename = asset.filename || `${share.shareSlug}.pdf`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "PDF file missing." }, { status: 404 });
  }
}
