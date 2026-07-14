import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cleanEntryData, ensureProfileEditorData, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { sectionDefinitionByKey } from "@/lib/profile-sections";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST(_request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { key } = await context.params;
  const definition = sectionDefinitionByKey(key);

  if (!definition) {
    return NextResponse.json({ error: "Unknown profile section." }, { status: 404 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  await ensureProfileEditorData(profile.id);

  const section = await prisma.profileSection.findUniqueOrThrow({
    where: {
      profileId_key: {
        profileId: profile.id,
        key
      }
    },
    include: {
      entries: { where: { archivedAt: null } }
    }
  });

  const entry = await prisma.profileSectionEntry.create({
    data: {
      profileId: profile.id,
      sectionId: section.id,
      sectionKey: key,
      entryOrder: section.entries.length + 1,
      data: cleanEntryData(key, {})
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({
    ok: true,
    completeness,
    entry: {
      id: entry.id,
      sectionKey: entry.sectionKey,
      entryOrder: entry.entryOrder,
      data: entry.data,
      isVisible: entry.isVisible
    }
  });
}
