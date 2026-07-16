import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { createWebsiteSchema, updateWebsiteDraftSchema } from "@/lib/website/schemas";
import { createWebsiteDraftForUser, getWebsiteWorkspaceForUser, updateWebsiteDraftForUser } from "@/lib/website/service";
import { websiteFeatureEnabled } from "@/lib/website/constants";

export async function GET() {
  if (!websiteFeatureEnabled()) {
    return NextResponse.json({ error: "Website feature is disabled." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const payload = await getWebsiteWorkspaceForUser(session.user);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  if (!websiteFeatureEnabled()) {
    return NextResponse.json({ error: "Website feature is disabled." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = createWebsiteSchema.parse(await request.json());
    const website = await createWebsiteDraftForUser(session.user, body.username);
    const payload = await getWebsiteWorkspaceForUser(session.user);
    return NextResponse.json({ ok: true, websiteId: website.id, ...payload });
  } catch (error) {
    return websiteErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  if (!websiteFeatureEnabled()) {
    return NextResponse.json({ error: "Website feature is disabled." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = updateWebsiteDraftSchema.parse(await request.json());
    await updateWebsiteDraftForUser(session.user, body);
    const payload = await getWebsiteWorkspaceForUser(session.user);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return websiteErrorResponse(error);
  }
}

function websiteErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Please check the website settings." }, { status: 422 });
  }

  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
  const payload = typeof error === "object" && error && "payload" in error ? (error as { payload?: unknown }).payload : undefined;
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Website request failed.",
      ...(payload ? { details: payload } : {})
    },
    { status }
  );
}
