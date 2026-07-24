import { NextResponse } from "next/server";
import { lookupActiveCustomDomainUsername, normalizeHostname } from "@/lib/website/custom-domain";

export const runtime = "nodejs";

/**
 * Public lookup: custom hostname → scholar username.
 * Used by Edge middleware (fetch) so Prisma stays on Node.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHostname(url.searchParams.get("h") || url.searchParams.get("host") || "");
  if (!host) {
    return NextResponse.json({ error: "Missing host." }, { status: 400 });
  }

  try {
    const hit = await lookupActiveCustomDomainUsername(host);
    if (!hit) {
      return NextResponse.json({ found: false }, { status: 404, headers: { "Cache-Control": "public, max-age=30" } });
    }
    return NextResponse.json(
      {
        found: true,
        username: hit.username,
        hostname: hit.hostname
      },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("[domain-lookup]", error);
    return NextResponse.json({ found: false, error: "lookup_failed" }, { status: 500 });
  }
}
