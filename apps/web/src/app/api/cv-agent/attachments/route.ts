import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAgentAttachmentExtractionQueue } from "@/lib/agent-attachment-queue";
import { auth } from "@/lib/auth";
import { getOrCreateAgentSession } from "@/lib/cv-agent/context";
import { storeWorkspaceFile } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const defaultMaxMb = 10;

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before attaching files." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const agentSession = await getOrCreateAgentSession(workspace.id, profile.id);
  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Choose a PDF or image first." }, { status: 422 });
  }

  if (files.length > 5) {
    return NextResponse.json({ error: "Attach up to 5 files at once." }, { status: 422 });
  }

  const maxMb = Number.parseInt(process.env.CVSCHOLAR_CV_AGENT_MAX_UPLOAD_MB || String(defaultMaxMb), 10);
  const maxBytes = Math.max(1, maxMb) * 1024 * 1024;
  const attachments = [];

  for (const file of files) {
    if (file.size <= 0) {
      return NextResponse.json({ error: `${file.name || "Attachment"} is empty.` }, { status: 422 });
    }

    if (file.size > maxBytes) {
      return NextResponse.json({ error: `${file.name || "Attachment"} must be smaller than ${maxMb} MB.` }, { status: 422 });
    }

    const mimeType = file.type || "application/octet-stream";
    const isAllowed = mimeType === "application/pdf" || mimeType.startsWith("image/");
    if (!isAllowed) {
      return NextResponse.json({ error: "Only PDF and image attachments are supported in Build with AI." }, { status: 422 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (mimeType === "application/pdf" && !bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      return NextResponse.json({ error: `${file.name || "Attachment"} does not look like a valid PDF.` }, { status: 422 });
    }

    const stored = await storeWorkspaceFile({
      bytes,
      workspaceId: workspace.id,
      filename: file.name || "cv-attachment",
      mimeType,
      prefix: "agent-attachments"
    });

    const asset = await prisma.fileAsset.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        kind: "ai_chat_attachment",
        storageProvider: stored.storageProvider,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        localPath: stored.localPath,
        filename: stored.filename,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        checksumSha256: stored.checksumSha256,
        isPublic: false
      }
    });

    const attachment = await prisma.cvAgentAttachment.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        sessionId: agentSession.id,
        fileAssetId: asset.id,
        filename: stored.filename,
        fileType: stored.mimeType,
        status: "queued",
        extractedFactsJson: {
          filename: stored.filename,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          extractionStatus: "queued",
          note: "Stored for AI chat context. Extraction is running in the background."
        }
      }
    });

    await getAgentAttachmentExtractionQueue().add(`agent-attachment-${attachment.id}`, {
      attachmentId: attachment.id,
      workspaceId: workspace.id,
      profileId: profile.id,
      fileAssetId: asset.id,
      checksumSha256: stored.checksumSha256
    });

    attachments.push({
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType,
      status: "queued"
    });
  }

  return NextResponse.json({ ok: true, attachments });
}
