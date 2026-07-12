import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rejectReviewItems } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const rejectSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(100)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before removing publications." }, { status: 401 });
  }

  const payload = rejectSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const result = await rejectReviewItems({
    workspaceId: workspace.id,
    profileId: profile.id,
    itemIds: payload.itemIds
  });

  return NextResponse.json({ ok: true, ...result });
}
