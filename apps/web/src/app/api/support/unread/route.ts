import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/admin";
import { resolveRequestActor } from "@/lib/request-user";
import { countUnreadForAdmin, countUnreadForUser } from "@/lib/support/service";

export const runtime = "nodejs";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ count: 0, adminCount: 0 });
  }

  const isAdmin = isPlatformAdmin(actor.user.email);
  const [count, adminCount] = await Promise.all([
    countUnreadForUser(actor.user.id),
    isAdmin ? countUnreadForAdmin() : Promise.resolve(0)
  ]);

  return NextResponse.json({
    count,
    adminCount,
    isAdmin
  });
}
