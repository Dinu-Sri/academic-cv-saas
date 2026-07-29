import { NextResponse } from "next/server";
import { z } from "zod";
import { importScholarPublications } from "@/lib/publications";
import { publicationTaskLimitResponse, recordPublicationTask } from "@/lib/publication-guest";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const importSchema = z.object({
  input: z.string().trim().min(1).max(300)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before importing publications." }, { status: 401 });
  }

  const limitResponse = await publicationTaskLimitResponse(actor);
  if (limitResponse) return limitResponse;

  const payload = importSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);

  try {
    const result = await importScholarPublications({
      workspaceId: workspace.id,
      profileId: profile.id,
      input: payload.input
    });
    await recordPublicationTask(actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Scholar import failed." }, { status: 400 });
  }
}
