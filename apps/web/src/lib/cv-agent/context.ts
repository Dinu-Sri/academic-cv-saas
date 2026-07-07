import type { Prisma } from "@/generated/prisma/client";
import { ensureProfileEditorData } from "@/lib/profile-editor";
import { entrySummary, profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

export type AgentEditorPayload = Awaited<ReturnType<typeof getAgentEditorPayload>>;

export async function getOrCreateAgentSession(workspaceId: string, profileId: string) {
  const existing = await prisma.cvAgentSession.findFirst({
    where: {
      workspaceId,
      profileId,
      status: "active"
    },
    orderBy: { updatedAt: "desc" }
  });

  if (existing) return existing;

  return prisma.cvAgentSession.create({
    data: {
      workspaceId,
      profileId,
      title: "Build with AI",
      status: "active"
    }
  });
}

export async function getAgentEditorPayload(profileId: string) {
  await ensureProfileEditorData(profileId);

  const [profile, sections] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSection.findMany({
      where: { profileId },
      include: {
        entries: {
          orderBy: { entryOrder: "asc" }
        }
      },
      orderBy: { sectionOrder: "asc" }
    })
  ]);

  return {
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      headline: profile.headline,
      affiliation: profile.affiliation,
      location: profile.location,
      email: profile.email,
      websiteUrl: profile.websiteUrl,
      googleScholarUrl: profile.googleScholarUrl,
      orcidUrl: profile.orcidUrl,
      linkedinUrl: profile.linkedinUrl,
      bio: profile.bio,
      researchSummary: profile.researchSummary,
      completeness: profile.completeness,
      updatedAt: profile.updatedAt.toISOString()
    },
    sections: sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      sectionOrder: section.sectionOrder,
      isVisible: section.isVisible,
      entries: section.entries.map((entry) => ({
        id: entry.id,
        sectionKey: entry.sectionKey,
        entryOrder: entry.entryOrder,
        summary: entrySummary(section.key, entry.data as Record<string, unknown>),
        data: entry.data as Record<string, string>,
        isVisible: entry.isVisible,
        updatedAt: entry.updatedAt.toISOString()
      }))
    }))
  };
}

export async function getAgentContext(sessionId: string, profileId: string) {
  const [editor, memory, messages, attachments] = await Promise.all([
    getAgentEditorPayload(profileId),
    prisma.cvAgentMemory.findUnique({ where: { profileId } }),
    prisma.cvAgentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.cvAgentAttachment.findMany({
      where: {
        sessionId,
        status: { in: ["stored", "extracted"] }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  return {
    editor,
    memory,
    messages: messages.reverse(),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType,
      status: attachment.status,
      extractedText: attachment.extractedText.slice(0, 4000),
      extractedFactsJson: attachment.extractedFactsJson
    }))
  };
}

export function serializeAgentMessage(message: {
  id: string;
  role: string;
  content: string;
  attachmentsJson: Prisma.JsonValue;
  patchSummaryJson: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachmentsJson,
    patchSummary: message.patchSummaryJson,
    createdAt: message.createdAt.toISOString()
  };
}

export function sectionCatalogForPrompt() {
  return profileSections.map((section) => ({
    key: section.key,
    title: section.title,
    requiredFields: section.fields.filter((field) => "required" in field && field.required).map((field) => field.name),
    fields: section.fields.map((field) => field.name)
  }));
}
