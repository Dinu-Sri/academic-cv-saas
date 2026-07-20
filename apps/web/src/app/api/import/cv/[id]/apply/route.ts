import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { applyCvImportJob } from "@/lib/cv-import";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before applying an import." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);

  try {
    const result = await applyCvImportJob(id, profile.id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply imported CV data." },
      { status: 422 }
    );
  }
}
