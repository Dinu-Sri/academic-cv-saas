import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureCvShare,
  getCvShareForDocument,
  serializeCvShare,
  setCvShareActive
} from "@/lib/cv-share";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const documentId = new URL(request.url).searchParams.get("documentId") || "";
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required." }, { status: 422 });
  }

  const document = await prisma.cvDocument.findFirst({
    where: { id: documentId, profileId: profile.id },
    select: { id: true }
  });
  if (!document) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const share = await getCvShareForDocument({
    documentId: document.id,
    profileId: profile.id
  });

  if (!share) {
    return NextResponse.json({ ok: true, exists: false, workspaceId: workspace.id });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    share: serializeCvShare(share)
  });
}

const createSchema = z.object({
  documentId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const body = createSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);

  const document = await prisma.cvDocument.findFirst({
    where: { id: body.documentId, profileId: profile.id },
    select: { id: true }
  });
  if (!document) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const result = await ensureCvShare({
    workspaceId: workspace.id,
    profileId: profile.id,
    documentId: document.id,
    userId: actor.user.id,
    displayName: profile.displayName || actor.user.name || ""
  });

  if ("ok" in result && result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    share: serializeCvShare(result.share)
  });
}

const patchSchema = z.object({
  documentId: z.string().trim().min(1),
  isActive: z.boolean()
});

export async function PATCH(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const body = patchSchema.parse(await request.json());
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);

  const document = await prisma.cvDocument.findFirst({
    where: { id: body.documentId, profileId: profile.id },
    select: { id: true }
  });
  if (!document) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const result = await setCvShareActive({
    documentId: document.id,
    profileId: profile.id,
    isActive: body.isActive
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    share: serializeCvShare(result.share)
  });
}
