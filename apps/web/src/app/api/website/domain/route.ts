import { NextResponse } from "next/server";
import { CUSTOM_DOMAIN_LOCKED_CODE } from "@/lib/billing/plans";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import {
  addCustomDomainForUser,
  getCustomDomainPayloadForWebsite,
  removeCustomDomain,
  setCustomDomainRedirectSubdomain,
  verifyCustomDomain
} from "@/lib/website/custom-domain";
import { getEntitlementsForWorkspace } from "@/lib/billing/entitlements";

export const runtime = "nodejs";

async function websiteForActor(user: { id: string; name: string; email: string }) {
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  return { workspace, profile, website };
}

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { workspace, website } = await websiteForActor(actor.user);
  const entitlements = await getEntitlementsForWorkspace(workspace.id);
  if (!website) {
    return NextResponse.json({
      entitlements,
      domain: {
        enabled: true,
        cnameTarget: "",
        cloudflareConfigured: false,
        domains: []
      }
    });
  }

  const domain = await getCustomDomainPayloadForWebsite(website.id);
  return NextResponse.json({ entitlements, domain });
}

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { hostname?: string };
    const dto = await addCustomDomainForUser(actor.user, body.hostname || "");
    return NextResponse.json({ domain: dto }, { status: 201 });
  } catch (error) {
    return domainError(error);
  }
}

export async function PATCH(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      domainId?: string;
      action?: "verify" | "redirect";
      redirectSubdomain?: boolean;
    };
    const { website } = await websiteForActor(actor.user);
    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }
    if (!body.domainId) {
      return NextResponse.json({ error: "domainId is required." }, { status: 400 });
    }

    if (body.action === "verify") {
      const domain = await verifyCustomDomain(body.domainId, website.id);
      return NextResponse.json({ domain });
    }

    if (body.action === "redirect") {
      const domain = await setCustomDomainRedirectSubdomain(
        body.domainId,
        website.id,
        Boolean(body.redirectSubdomain)
      );
      return NextResponse.json({ domain });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return domainError(error);
  }
}

export async function DELETE(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId") || "";
    const { website } = await websiteForActor(actor.user);
    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }
    if (!domainId) {
      return NextResponse.json({ error: "domainId is required." }, { status: 400 });
    }
    await removeCustomDomain(domainId, website.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainError(error);
  }
}

function domainError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status) || 400
      : 400;
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : status === 402
        ? CUSTOM_DOMAIN_LOCKED_CODE
        : undefined;
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Domain request failed.",
      ...(code ? { code } : {})
    },
    { status }
  );
}
