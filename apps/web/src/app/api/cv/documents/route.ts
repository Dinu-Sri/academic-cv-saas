import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { defaultVisibleSectionKeys } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before managing CVs." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const documents = await prisma.cvDocument.findMany({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ ok: true, documents: documents.map(cvDocumentResponse) });
}

export async function POST() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before creating a CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const count = await prisma.cvDocument.count({
    where: { profileId: profile.id }
  });
  const document = await prisma.cvDocument.create({
    data: {
      profileId: profile.id,
      title: count === 0 ? "Main Academic CV" : `CV Version ${count + 1}`,
      templateKey: "classic",
      visibleSectionKeys: defaultVisibleSectionKeys
    }
  });

  return NextResponse.json({ ok: true, document: cvDocumentResponse(document) });
}

function cvDocumentResponse(document: {
  id: string;
  title: string;
  templateKey: string;
  visibleSectionKeys: unknown;
  pdfPath: string;
  renderError: string;
  updatedAt: Date;
}) {
  return {
    id: document.id,
    title: document.title,
    templateKey: document.templateKey,
    visibleSectionKeys: Array.isArray(document.visibleSectionKeys) ? document.visibleSectionKeys : defaultVisibleSectionKeys,
    pdfReady: Boolean(document.pdfPath),
    pdfError: document.renderError,
    updatedAt: document.updatedAt.toISOString()
  };
}
