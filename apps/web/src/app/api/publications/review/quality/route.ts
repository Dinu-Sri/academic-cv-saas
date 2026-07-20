import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPublicationSuggestion, scanPublicationQuality, type PublicationData } from "@/lib/publications";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const applySchema = z.object({
  entryId: z.string().min(1),
  action: z.enum(["update", "remove"]).optional(),
  data: z.record(z.string(), z.unknown())
});

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before reviewing publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  return NextResponse.json({ ok: true, scan: await scanPublicationQuality(profile.id) });
}

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before updating publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const payload = applySchema.parse(await request.json());
  await applyPublicationSuggestion({
    profileId: profile.id,
    entryId: payload.entryId,
    data: payload.data as unknown as PublicationData,
    action: payload.action
  });

  return NextResponse.json({ ok: true });
}
