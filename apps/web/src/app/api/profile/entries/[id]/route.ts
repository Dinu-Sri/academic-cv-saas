import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanEntryData, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const updateSchema = z.object({
  sectionKey: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  dataPatch: z.record(z.string(), z.unknown()).optional()
}).refine((payload) => payload.data !== undefined || payload.dataPatch !== undefined, "Entry data is required.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
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

  const currentData = entry.data && typeof entry.data === "object" && !Array.isArray(entry.data)
    ? entry.data as Record<string, unknown>
    : {};
  const nextData = payload.dataPatch ? { ...currentData, ...payload.dataPatch } : payload.data ?? {};

  await prisma.profileSectionEntry.update({
    where: { id },
    data: {
      data: cleanEntryData(payload.sectionKey, nextData),
      version: { increment: 1 }
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
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
