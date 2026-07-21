import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { getTicketDetailForUser } from "@/lib/support/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await getTicketDetailForUser(id, actor.user.id, { markAdminRead: true });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
