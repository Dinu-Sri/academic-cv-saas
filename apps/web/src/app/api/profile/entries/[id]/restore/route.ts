import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before restoring your profile entry." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const entry = await prisma.profileSectionEntry.findFirst({
    where: {
      id,
      profileId: profile.id
    }
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const lastEntry = await prisma.profileSectionEntry.findFirst({
    where: {
      profileId: profile.id,
      sectionKey: entry.sectionKey,
      archivedAt: null
    },
    orderBy: { entryOrder: "desc" }
  });

  await prisma.profileSectionEntry.update({
    where: { id: entry.id },
    data: {
      isVisible: true,
      archivedAt: null,
      archivedBy: "",
      archiveSource: "",
      entryOrder: (lastEntry?.entryOrder ?? 0) + 1,
      version: { increment: 1 }
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}
