import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const reorderSchema = z.object({
  order: z.array(z.string()).max(100)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const payload = reorderSchema.parse(await request.json());
  const sections = await prisma.profileSection.findMany({
    where: {
      profileId: profile.id,
      id: { in: payload.order }
    },
    select: { id: true }
  });
  const ownedIds = new Set(sections.map((section) => section.id));
  const validOrder = payload.order.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    validOrder.map((id, index) =>
      prisma.profileSection.update({
        where: { id },
        data: { sectionOrder: (index + 1) * 10 }
      })
    )
  );

  return NextResponse.json({ ok: true });
}
