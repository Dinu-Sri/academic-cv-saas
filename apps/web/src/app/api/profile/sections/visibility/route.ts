import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ensureProfileEditorData, refreshCompleteness } from "@/lib/profile-editor";
import { profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const sectionKeys = profileSections.map((section) => section.key);
const sectionKeySet = new Set<string>(sectionKeys);

const visibilitySchema = z.object({
  activeKeys: z
    .array(z.string().refine((key) => sectionKeySet.has(key), "Unknown CV section."))
    .max(sectionKeys.length)
});

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const payload = visibilitySchema.parse(await request.json());
  const activeKeys = new Set(payload.activeKeys);
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  await ensureProfileEditorData(profile.id);

  await prisma.$transaction(
    profileSections.map((section) =>
      prisma.profileSection.update({
        where: {
          profileId_key: {
            profileId: profile.id,
            key: section.key
          }
        },
        data: {
          isVisible: activeKeys.has(section.key)
        }
      })
    )
  );

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness, activeKeys: payload.activeKeys });
}
