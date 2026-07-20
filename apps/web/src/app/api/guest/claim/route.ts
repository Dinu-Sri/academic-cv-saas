import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimGuestDataForUser, readGuestTokenFromCookies } from "@/lib/guest";

/** Attach cookie guest workspace to the just-authenticated user. */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const token = await readGuestTokenFromCookies();
  const result = await claimGuestDataForUser(session.user, token);
  return NextResponse.json({ ok: true, ...result });
}
