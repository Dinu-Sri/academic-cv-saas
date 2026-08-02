import { NextResponse } from "next/server";
import { readStoredAsset } from "@/lib/file-storage";
import { loadWebsiteProfileImageAsset } from "@/lib/website/profile-image";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ username: string }> };

export async function GET(_: Request, { params }: Params) {
  const { username } = await params;
  const website = await prisma.academicWebsite.findFirst({
    where: {
      username: username.toLowerCase(),
      status: "published",
      archivedAt: null,
      blockedAt: null
    },
    select: { id: true }
  });
  if (!website) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const loaded = await loadWebsiteProfileImageAsset(website.id);
  if (!loaded) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(loaded.asset);
    const etag = `"${loaded.asset.checksumSha256 || loaded.asset.id}"`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        // Short cache + strong ETag so photo replacements show quickly after upload.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
