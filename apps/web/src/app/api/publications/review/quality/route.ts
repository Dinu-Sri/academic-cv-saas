import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { applyPublicationSuggestion, scanPublicationQuality, type PublicationData } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const applySchema = z.object({
  entryId: z.string().min(1),
  data: z.record(z.string(), z.unknown())
});

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before reviewing publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  return NextResponse.json({ ok: true, scan: await scanPublicationQuality(profile.id) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before updating publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const payload = applySchema.parse(await request.json());
  await applyPublicationSuggestion({
    profileId: profile.id,
    entryId: payload.entryId,
    data: payload.data as unknown as PublicationData
  });

  return NextResponse.json({ ok: true });
}
