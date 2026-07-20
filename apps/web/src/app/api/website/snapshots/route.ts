import { resolveRequestActor } from "@/lib/request-user";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { listWebsiteSnapshotsForUser } from "@/lib/website/publish-service";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const snapshots = await listWebsiteSnapshotsForUser(actor.user);
  return NextResponse.json({ snapshots });
}
