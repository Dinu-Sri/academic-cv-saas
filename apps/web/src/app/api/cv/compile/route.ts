import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  assertGuestCompileAllowed,
  GUEST_LIMIT_CODE,
  incrementGuestCompile
} from "@/lib/guest";
import { getPdfRenderQueue } from "@/lib/pdf-queue";
import { buildCvSnapshot, buildPreviewHtml, refreshCompleteness } from "@/lib/profile-editor";
import { recordCvActiveTime } from "@/lib/cv-time-to-value";
import { defaultVisibleSectionKeys, profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { CLASSIC_LAYOUT_VERSION } from "@/lib/latex";

const compileSchema = z.object({
  documentId: z.string().optional(),
  templateKey: z.enum(["classic", "modern", "detailed"]).default("classic"),
  visibleSectionKeys: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login before compiling your CV." }, { status: 401 });
  }

  if (actor.isGuest) {
    const gate = await assertGuestCompileAllowed(actor.user.id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.error,
          code: GUEST_LIMIT_CODE,
          limit: gate.limit,
          used: gate.used,
          max: gate.max
        },
        { status: 402 }
      );
    }
  }

  const body = await request.text();
  const payload = compileSchema.parse(body ? JSON.parse(body) : {});
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);

  if (!actor.isGuest) {
    const missingFields = [
      !profile.countryCode.trim() ? "countryCode" : "",
      !profile.academicFieldGroup.trim() ? "academicFieldGroup" : "",
      !profile.academicField.trim() ? "academicField" : ""
    ].filter(Boolean);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Add your country and academic field before generating your CV.",
          code: "ACADEMIC_IDENTITY_REQUIRED",
          missingFields
        },
        { status: 422 }
      );
    }
  }

  await recordCvActiveTime(prisma, workspace.id, profile.id, "compile_request");

  const existingDocument = payload.documentId
    ? await prisma.cvDocument.findFirst({
        where: {
          id: payload.documentId,
          profileId: profile.id
        }
      })
    : await prisma.cvDocument.findFirst({
        where: { profileId: profile.id },
        orderBy: { updatedAt: "desc" }
      });

  const validSectionKeys = new Set<string>(profileSections.map((section) => section.key));
  const storedSectionKeys = payload.documentId && Array.isArray(existingDocument?.visibleSectionKeys) ? existingDocument.visibleSectionKeys : [];
  const requestedSectionKeys = (payload.visibleSectionKeys ?? storedSectionKeys)
    .filter((key): key is string => typeof key === "string" && validSectionKeys.has(key));
  const usesDocumentSections = Boolean(payload.documentId || payload.visibleSectionKeys);
  const visibleSectionKeys = requestedSectionKeys.length > 0 ? requestedSectionKeys : defaultVisibleSectionKeys;
  const snapshot = await buildCvSnapshot(profile.id, usesDocumentSections ? visibleSectionKeys : undefined);
  const previewHtml = buildPreviewHtml(snapshot);
  const snapshotJson = JSON.parse(JSON.stringify(snapshot));
  const inputHash = crypto.createHash("sha256").update(JSON.stringify({ snapshot: snapshotJson, templateKey: payload.templateKey, visibleSectionKeys })).digest("hex");

  const document = existingDocument
    ? await prisma.cvDocument.update({
        where: { id: existingDocument.id },
        data: {
          snapshot: snapshotJson,
          previewHtml,
          templateKey: payload.templateKey,
          visibleSectionKeys: usesDocumentSections ? visibleSectionKeys : Array.isArray(existingDocument.visibleSectionKeys) ? existingDocument.visibleSectionKeys : defaultVisibleSectionKeys,
          renderEngine: "tectonic",
          renderError: "",
          lastCompiledAt: new Date()
        }
      })
    : await prisma.cvDocument.create({
        data: {
          profileId: profile.id,
          title: "Academic CV",
          templateKey: payload.templateKey,
          visibleSectionKeys: usesDocumentSections ? visibleSectionKeys : defaultVisibleSectionKeys,
          snapshot: snapshotJson,
          previewHtml,
          renderEngine: "tectonic",
          renderError: "",
          lastCompiledAt: new Date()
        }
      });

  const renderJob = await prisma.pdfRenderJob.create({
    data: {
      workspaceId: workspace.id,
      profileId: profile.id,
      documentId: document.id,
      templateKey: payload.templateKey,
      status: "queued",
      message: "PDF render queued.",
      inputHash,
      templateVersion: "1.0.0"
    }
  });

  await getPdfRenderQueue().add(
    "render-classic-cv",
    {
      jobId: renderJob.id,
      workspaceId: workspace.id,
      profileId: profile.id,
      documentId: document.id
    },
    {
      jobId: renderJob.id
    }
  );

  const completeness = await refreshCompleteness(profile.id);

  if (actor.isGuest) {
    await incrementGuestCompile(actor.user.id);
  }

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    jobId: renderJob.id,
    status: renderJob.status,
    previewHtml,
    pdfReady: false,
    pdfError: "",
    completeness,
    layout_version: CLASSIC_LAYOUT_VERSION,
    renderer: "rewrite-latex",
    engine: process.env.CVSCHOLAR_LATEX_ENGINE || "tectonic"
  });
}
