import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listWebsiteSnapshotsForUser } from "@/lib/website/publish-service";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const snapshots = await listWebsiteSnapshotsForUser(session.user);
  return NextResponse.json({ snapshots });
}
