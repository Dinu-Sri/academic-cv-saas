import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfileEditorData, refreshCompleteness } from "@/lib/profile-editor";
import { editorProfileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const sectionKeys = editorProfileSections.map((section) => section.key);
const sectionKeySet = new Set<string>(sectionKeys);

const visibilitySchema = z.object({
  activeKeys: z
    .array(z.string().refine((key) => sectionKeySet.has(key), "Unknown CV section."))
    .max(sectionKeys.length)
});

export async function PATCH(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const payload = visibilitySchema.parse(await request.json());
  const activeKeys = new Set(payload.activeKeys);
  const orderIndex = new Map(payload.activeKeys.map((key, index) => [key, index]));
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  await ensureProfileEditorData(profile.id);

  await prisma.$transaction(
    editorProfileSections.map((section) => {
      const activeIndex = orderIndex.get(section.key);
      const sectionOrder = activeIndex === undefined
        ? section.sectionOrder + editorProfileSections.length * 10
        : (activeIndex + 1) * 10;
      return (
      prisma.profileSection.update({
        where: {
          profileId_key: {
            profileId: profile.id,
            key: section.key
          }
        },
        data: {
          isVisible: activeKeys.has(section.key),
          sectionOrder
        }
      })
      );
    })
  );

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness, activeKeys: payload.activeKeys });
}
