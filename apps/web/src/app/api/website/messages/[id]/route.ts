import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { markWebsiteMessageRead } from "@/lib/website/contact-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
    const message = await markWebsiteMessageRead(workspace.id, profile.id, id);
    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        status: message.status,
        readAt: message.readAt?.toISOString() ?? null
      }
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update message." }, { status });
  }
}
