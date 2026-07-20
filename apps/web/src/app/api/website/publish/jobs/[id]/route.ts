import { resolveRequestActor } from "@/lib/request-user";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getWebsitePublishJobForUser } from "@/lib/website/publish-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const job = await getWebsitePublishJobForUser(actor.user, id);
    return NextResponse.json({ job });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Job not found." }, { status });
  }
}
