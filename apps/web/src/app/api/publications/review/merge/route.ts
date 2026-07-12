import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { mergeReviewItem } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const mergeSchema = z.object({
  itemId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before merging publications." }, { status: 401 });
  }

  const payload = mergeSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);

  try {
    const result = await mergeReviewItem({
      workspaceId: workspace.id,
      profileId: profile.id,
      itemId: payload.itemId
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not merge publication." }, { status: 422 });
  }
}
