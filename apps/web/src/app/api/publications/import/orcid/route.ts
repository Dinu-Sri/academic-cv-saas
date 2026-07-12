import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { importOrcidPublications } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const importSchema = z.object({
  input: z.string().trim().min(1).max(200)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before importing publications." }, { status: 401 });
  }

  const payload = importSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);

  try {
    const result = await importOrcidPublications({
      workspaceId: workspace.id,
      profileId: profile.id,
      input: payload.input
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ORCID import failed." }, { status: 400 });
  }
}
