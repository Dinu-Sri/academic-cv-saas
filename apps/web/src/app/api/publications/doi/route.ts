import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupDoiPublication } from "@/lib/publications";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const doiSchema = z.object({
  doi: z.string().trim().min(1).max(300)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before adding publications." }, { status: 401 });
  }

  const payload = doiSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);

  try {
    const item = await lookupDoiPublication({
      workspaceId: workspace.id,
      profileId: profile.id,
      doi: payload.doi
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "DOI lookup failed." }, { status: 400 });
  }
}
