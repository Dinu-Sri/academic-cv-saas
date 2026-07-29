import { NextResponse } from "next/server";
import { createManualPublication, getPublicationWorkspace } from "@/lib/publications";
import { publicationTaskLimitResponse, recordPublicationTask } from "@/lib/publication-guest";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before managing publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  return NextResponse.json({ ok: true, ...(await getPublicationWorkspace(profile.id)) });
}

export async function POST() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before adding publications." }, { status: 401 });
  }

  const limitResponse = await publicationTaskLimitResponse(actor);
  if (limitResponse) return limitResponse;

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const publication = await createManualPublication(profile.id);
  await recordPublicationTask(actor);
  return NextResponse.json({ ok: true, publication });
}
