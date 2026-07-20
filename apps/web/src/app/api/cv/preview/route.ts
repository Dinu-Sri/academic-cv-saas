import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before viewing your CV preview." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const document = await prisma.cvDocument.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({
    ok: true,
    previewHtml: document?.previewHtml ?? "",
    lastCompiledAt: document?.lastCompiledAt ?? null
  });
}
