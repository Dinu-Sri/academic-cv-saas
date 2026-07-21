import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { createTicket, listTicketsForUser, parseImageFiles } from "@/lib/support/service";

export const runtime = "nodejs";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in to view support tickets." }, { status: 401 });
  }

  const tickets = await listTicketsForUser(actor.user.id);
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in to open a support ticket." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const type = String(formData.get("type") || "support");
    const subject = String(formData.get("subject") || "");
    const message = String(formData.get("message") || "");
    const parsed = await parseImageFiles(formData);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const ticket = await createTicket({
      user: actor.user,
      type,
      subject,
      message,
      files: parsed.files
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not create ticket.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
