import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { restoreWebsiteSnapshotForUser } from "@/lib/website/publish-service";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await restoreWebsiteSnapshotForUser(session.user, id);
    const workspace = await getWebsiteWorkspaceForUser(session.user);
    return NextResponse.json({ ...result, workspace });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Restore failed." }, { status });
  }
}
