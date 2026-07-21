import { NextResponse } from "next/server";

/** Public flags for which social providers are configured (no secrets). */
export async function GET() {
  const google = Boolean(
    (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID) &&
      (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET)
  );
  return NextResponse.json({ google });
}
