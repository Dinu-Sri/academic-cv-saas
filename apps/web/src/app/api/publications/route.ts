import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createManualPublication, getPublicationWorkspace } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before managing publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  return NextResponse.json({ ok: true, ...(await getPublicationWorkspace(profile.id)) });
}

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before adding publications." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const publication = await createManualPublication(profile.id);
  return NextResponse.json({ ok: true, publication });
}
