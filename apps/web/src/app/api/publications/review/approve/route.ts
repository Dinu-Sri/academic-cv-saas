import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { approveReviewItems } from "@/lib/publications";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const approveSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(100),
  forceKeepBoth: z.boolean().default(false)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before approving publications." }, { status: 401 });
  }

  const payload = approveSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);

  try {
    const result = await approveReviewItems({
      workspaceId: workspace.id,
      profileId: profile.id,
      itemIds: payload.itemIds,
      forceKeepBoth: payload.forceKeepBoth
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve publications." }, { status: 422 });
  }
}
