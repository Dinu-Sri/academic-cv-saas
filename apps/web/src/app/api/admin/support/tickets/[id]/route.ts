import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { getTicketDetailForAdmin, updateTicketMetaAsAdmin } from "@/lib/support/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const ticket = await getTicketDetailForAdmin(id, { markUserRead: true });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  try {
    const body = (await request.json()) as { status?: string; priority?: string };
    const ticket = await updateTicketMetaAsAdmin({
      ticketId: id,
      status: body.status,
      priority: body.priority
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not update ticket.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
