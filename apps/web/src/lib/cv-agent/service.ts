import type { Prisma } from "@/generated/prisma/client";
import { applyAgentPatches, deriveCompletedSections, summarizePatchResults } from "@/lib/cv-agent/patches";
import { cvAgentResponseSchema, cvAgentStructuredOutputInstruction, type CvAgentResponse } from "@/lib/cv-agent/schemas";
import { getAgentContext, getAgentEditorPayload, getOrCreateAgentSession, sectionCatalogForPrompt, serializeAgentMessage } from "@/lib/cv-agent/context";
import { prisma } from "@/lib/prisma";

export async function getAgentSessionPayload(workspaceId: string, profileId: string) {
  const session = await getOrCreateAgentSession(workspaceId, profileId);
  const [messages, memory, editor] = await Promise.all([
    prisma.cvAgentMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 80
    }),
    prisma.cvAgentMemory.findUnique({ where: { profileId } }),
    getAgentEditorPayload(profileId)
  ]);

  return {
    session: serializeSession(session),
    messages: messages.map(serializeAgentMessage),
    memory,
    editor
  };
}

export async function sendAgentMessage({
  workspaceId,
  profileId,
  message,
  attachmentIds = []
}: {
  workspaceId: string;
  profileId: string;
  message: string;
  attachmentIds?: string[];
}) {
  const session = await getOrCreateAgentSession(workspaceId, profileId);
  const ownedAttachments =
    attachmentIds.length > 0
      ? await prisma.cvAgentAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            workspaceId,
            profileId,
            sessionId: session.id
          }
        })
      : [];

  await prisma.cvAgentMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: message || (ownedAttachments.length > 0 ? "I attached files for my CV." : ""),
      attachmentsJson: ownedAttachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        fileType: attachment.fileType,
        status: attachment.status
      })) as Prisma.InputJsonValue
    }
  });

  const context = await getAgentContext(session.id, profileId);
  const agentResponse = await callCvAgent(context, message, ownedAttachments);
  const assistantMessage = await prisma.cvAgentMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: agentResponse.assistantMessage,
      attachmentsJson: [],
      patchSummaryJson: {}
    }
  });

  const patchResult = await applyAgentPatches({
    workspaceId,
    profileId,
    sessionId: session.id,
    messageId: assistantMessage.id,
    patches: agentResponse.patches,
    confirmed: userConfirmedChange(message)
  });
  const patchSummary = summarizePatchResults(patchResult.results);
  const assistantContent = reconcileAssistantMessage(agentResponse.assistantMessage, patchSummary);

  await Promise.all([
    prisma.cvAgentMessage.update({
      where: { id: assistantMessage.id },
      data: {
        content: assistantContent,
        patchSummaryJson: JSON.parse(JSON.stringify(patchSummary)) as Prisma.InputJsonValue
      }
    }),
    prisma.cvAgentSession.update({
      where: { id: session.id },
      data: {
        lastMessageAt: new Date()
      }
    }),
    updateAgentMemory(profileId, agentResponse, deriveCompletedSections(patchResult.editor))
  ]);

  const latestMessages = await prisma.cvAgentMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 80
  });

  return {
    session: serializeSession(session),
    messages: latestMessages.map(serializeAgentMessage),
    patchSummary,
    warnings: agentResponse.warnings,
    questions: agentResponse.questions,
    editor: patchResult.editor
  };
}

async function callCvAgent(context: Awaited<ReturnType<typeof getAgentContext>>, userMessage: string, attachments: { filename: string; fileType: string }[]): Promise<CvAgentResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      assistantMessage:
        "The AI chat is ready, but OpenAI is not configured on this server yet. Add OPENAI_API_KEY and CVSCHOLAR_CV_AGENT_MODEL, then I can update your CV fields safely.",
      patches: [],
      questions: ["Please ask the site admin to configure OpenAI for the CV agent."],
      warnings: ["OPENAI_API_KEY is missing."],
      memoryUpdate: {}
    };
  }

  const model = process.env.CVSCHOLAR_CV_AGENT_MODEL || "gpt-4.1-nano";
  const timeoutMs = Math.max(15000, Number.parseInt(process.env.CVSCHOLAR_CV_AGENT_TIMEOUT_MS || "45000", 10));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify({
              latestUserMessage: userMessage,
              currentCv: context.editor,
              memory: context.memory,
              recentMessages: context.messages.map((message) => ({
                role: message.role,
                content: message.content
              })),
              attachments: [
                ...context.attachments,
                ...attachments.map((attachment) => ({
                  filename: attachment.filename,
                  fileType: attachment.fileType,
                  status: "newly_attached"
                }))
              ],
              sectionCatalog: sectionCatalogForPrompt()
            })
          }
        ]
      })
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || "OpenAI could not answer the CV chat.");
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty CV chat response.");
    }

    return cvAgentResponseSchema.parse(JSON.parse(content));
  } catch (error) {
    return {
      assistantMessage:
        "I could not process that message safely. Please try again with one clear CV detail, such as your degree, institution, and year.",
      patches: [],
      questions: ["Can you send the detail again in a short sentence?"],
      warnings: [error instanceof Error ? error.message : "CV agent failed."],
      memoryUpdate: {}
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildSystemPrompt() {
  return [
    "You are CVScholar, a professional academic CV assistant.",
    "You help academics complete their CV step by step using only information provided by the user, existing CV data, or attached-file facts.",
    "Never invent degrees, institutions, dates, roles, publications, awards, grants, metrics, or achievements.",
    "Never delete data. Never overwrite existing filled profile fields unless the user clearly confirms.",
    "If details are vague or conflicting, ask one short follow-up question and return an ask_confirmation patch.",
    "Prefer safe patches that fill empty personal fields and add non-duplicate section entries.",
    "Do not say an update is saved unless you also return a patch for that update.",
    "Do not say you will check or reapply something later. Either return a safe patch now or ask one clear question.",
    "Keep replies short, friendly, and non-technical.",
    cvAgentStructuredOutputInstruction()
  ].join("\n\n");
}

function userConfirmedChange(message: string) {
  const normalized = message.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return false;

  return [
    "yes",
    "ok",
    "okay",
    "all good",
    "update it",
    "update this",
    "apply it",
    "save it",
    "replace it",
    "change it",
    "no need of extra change",
    "no need extra change",
    "this is good",
    "you can update",
    "update this in the cv",
    "update it in the cv"
  ].some((phrase) => normalized === phrase || normalized.includes(phrase));
}

function reconcileAssistantMessage(message: string, summary: ReturnType<typeof summarizePatchResults>) {
  if (summary.applied > 0) {
    return message;
  }

  const important = summary.messages.find((item) =>
    /left them unchanged|needs confirmation|need .* before|could not|no usable/i.test(item)
  );

  if (!important) {
    return message;
  }

  if (/successfully updated|has been updated|i updated|saved/i.test(message)) {
    return important;
  }

  return `${message}\n\n${important}`;
}

async function updateAgentMemory(profileId: string, response: CvAgentResponse, completedSections: string[]) {
  const update = response.memoryUpdate ?? {};
  const data = {
    summaryJson: (update.summaryJson ?? {}) as Prisma.InputJsonValue,
    confirmedFacts: (update.confirmedFacts ?? []) as Prisma.InputJsonValue,
    uncertainFacts: (update.uncertainFacts ?? []) as Prisma.InputJsonValue,
    pendingQuestions: (update.pendingQuestions ?? response.questions ?? []) as Prisma.InputJsonValue,
    completedSections: (update.completedSections ?? completedSections) as Prisma.InputJsonValue,
    nextBestSection: update.nextBestSection || nextBestSection(completedSections),
    preferredTone: update.preferredTone || "professional",
    targetCvType: update.targetCvType || "academic"
  };

  await prisma.cvAgentMemory.upsert({
    where: { profileId },
    update: data,
    create: {
      profileId,
      ...data
    }
  });
}

function nextBestSection(completedSections: string[]) {
  const order = ["personal", "education", "experience", "teaching", "publications", "awards", "skills", "references"];
  return order.find((section) => !completedSections.includes(section)) ?? "review";
}

function serializeSession(session: { id: string; title: string; status: string; lastMessageAt: Date | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}
