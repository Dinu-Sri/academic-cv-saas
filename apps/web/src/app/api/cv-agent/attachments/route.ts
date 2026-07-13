import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { extractDocumentContent, openAiExtractionIsConfigured } from "@/lib/ai/document-extraction";
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
        status: "stored",
        extractedFactsJson: {
          filename: stored.filename,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          note: "Stored for AI chat context. Detailed extraction can be promoted to a review patch before saving."
        }
      }
    });

    const extracted = await extractOrReuseAttachment({
      attachmentId: attachment.id,
      profileId: profile.id,
      checksumSha256: stored.checksumSha256,
      bytes,
      filename: stored.filename,
      mimeType: stored.mimeType
    });

    attachments.push({
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType,
      status: extracted.status
    });
  }

  return NextResponse.json({ ok: true, attachments });
}

async function extractOrReuseAttachment({
  attachmentId,
  profileId,
  checksumSha256,
  bytes,
  filename,
  mimeType
}: {
  attachmentId: string;
  profileId: string;
  checksumSha256: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
}) {
  const cached = await prisma.cvAgentAttachment.findFirst({
    where: {
      profileId,
      status: "extracted",
      fileAsset: {
        checksumSha256
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (cached) {
    await prisma.cvAgentAttachment.update({
      where: { id: attachmentId },
      data: {
        status: "extracted",
        extractedText: cached.extractedText,
        extractedFactsJson: JSON.parse(JSON.stringify(cached.extractedFactsJson ?? {})) as Prisma.InputJsonValue
      }
    });
    return { status: "extracted" };
  }

  if (!openAiExtractionIsConfigured()) {
    await prisma.cvAgentAttachment.update({
      where: { id: attachmentId },
      data: {
        status: "stored",
        extractedFactsJson: {
          filename,
          mimeType,
          extractionStatus: "openai_unconfigured",
          warning: "Stored for AI chat, but OPENAI_API_KEY is required to extract PDF/image content."
        } as Prisma.InputJsonValue
      }
    });
    return { status: "stored" };
  }

  try {
    const extracted = await extractDocumentContent({
      bytes,
      filename,
      mimeType,
      timeoutMs: Number.parseInt(process.env.CVSCHOLAR_ATTACHMENT_EXTRACT_TIMEOUT_MS || "90000", 10)
    });

    await prisma.cvAgentAttachment.update({
      where: { id: attachmentId },
      data: {
        status: "extracted",
        extractedText: extracted.extractedText.slice(0, 60000),
        extractedFactsJson: {
          ...extracted.facts,
          filename,
          mimeType,
          extractionProvider: "openai",
          extractionModel: process.env.CVSCHOLAR_DOCUMENT_EXTRACT_MODEL || process.env.CVSCHOLAR_CV_IMPORT_MODEL || "gpt-5.4-mini"
        } as Prisma.InputJsonValue,
        error: ""
      }
    });
    return { status: "extracted" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attachment extraction failed.";
    await prisma.cvAgentAttachment.update({
      where: { id: attachmentId },
      data: {
        status: "extract_failed",
        error: message,
        extractedFactsJson: {
          filename,
          mimeType,
          extractionStatus: "failed",
          warning: message
        } as Prisma.InputJsonValue
      }
    });
    return { status: "extract_failed" };
  }
}
