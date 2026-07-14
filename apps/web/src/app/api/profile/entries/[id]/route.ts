import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cleanEntryData, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const updateSchema = z.object({
  sectionKey: z.string().min(1),
  data: z.record(z.string(), z.unknown())
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const payload = updateSchema.parse(await request.json());

  const entry = await prisma.profileSectionEntry.findFirst({
    where: {
      id,
      profileId: profile.id,
      sectionKey: payload.sectionKey,
      archivedAt: null
    }
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await prisma.profileSectionEntry.update({
    where: { id },
    data: {
      data: cleanEntryData(payload.sectionKey, payload.data),
      version: { increment: 1 }
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const entry = await prisma.profileSectionEntry.findFirst({
    where: {
      id,
      profileId: profile.id
    }
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await prisma.profileSectionEntry.delete({
    where: { id }
  });

  await normalizeEntryOrder(profile.id, entry.sectionKey);
  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}

async function normalizeEntryOrder(profileId: string, sectionKey: string) {
  const entries = await prisma.profileSectionEntry.findMany({
    where: { profileId, sectionKey, archivedAt: null },
    orderBy: { entryOrder: "asc" }
  });

  await prisma.$transaction(
    entries.map((entry, index) =>
      prisma.profileSectionEntry.update({
        where: { id: entry.id },
        data: { entryOrder: index + 1 }
      })
    )
  );
}
