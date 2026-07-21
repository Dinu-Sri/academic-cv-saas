import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { parseImageFiles, replyToTicketAsUser } from "@/lib/support/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const formData = await request.formData();
    const message = String(formData.get("message") || "");
    const parsed = await parseImageFiles(formData);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const ticket = await replyToTicketAsUser({
      ticketId: id,
      user: actor.user,
      message,
      files: parsed.files
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not send reply.";
    const status = msg === "Ticket not found." ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
