import type { Prisma } from "@/generated/prisma/client";
import { deepSeekIsConfigured, deepSeekJson } from "@/lib/ai/deepseek";
import { applyAgentPatches, deriveCompletedSections, summarizePatchResults } from "@/lib/cv-agent/patches";
import {
  cleanPersonalPatchData,
  cleanSectionPatchData,
  cvAgentPatchSchema,
  cvAgentResponseSchema,
  cvAgentStructuredOutputInstruction,
  type CvAgentPatch,
  type CvAgentResponse
} from "@/lib/cv-agent/schemas";
import { getAgentContext, getAgentEditorPayload, getOrCreateAgentSession, sectionCatalogForPrompt, serializeAgentMessage } from "@/lib/cv-agent/context";
import { cleanEntryData } from "@/lib/profile-editor";
import { personalFields, sectionDefinitionByKey } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

type ApprovalProfile = Record<string, unknown>;
type ApprovalSection = {
  key: string;
  entries: {
    id: string;
    data: Prisma.JsonValue;
  }[];
};

export async function getAgentSessionPayload(workspaceId: string, profileId: string, options: { before?: Date; limit?: number } = {}) {
  const session = await getOrCreateAgentSession(workspaceId, profileId);
  const limit = Math.max(1, Math.min(100, options.limit ?? 80));
  const [messages, memory, editor, pendingApproval] = await Promise.all([
    latestAgentMessages(session.id, limit, options.before),
    prisma.cvAgentMemory.findUnique({ where: { profileId } }),
    getAgentEditorPayload(profileId),
    getPendingAgentApproval(session.id, workspaceId, profileId)
  ]);

  return {
    session: serializeSession(session),
    messages: messages.map(serializeAgentMessage),
    messagePage: {
      hasMore: messages.length === limit,
      nextBefore: messages[0]?.createdAt.toISOString() ?? null
    },
    memory,
    editor,
    pendingApproval
  };
}

async function latestAgentMessages(sessionId: string, take: number, before?: Date) {
  const messages = await prisma.cvAgentMessage.findMany({
    where: {
      sessionId,
      ...(before ? { createdAt: { lt: before } } : {})
    },
    orderBy: { createdAt: "desc" },
    take
  });

  return messages.reverse();
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
    requireApproval: true
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

  const latestMessages = await latestAgentMessages(session.id, 80);

  return {
    session: serializeSession(session),
    messages: latestMessages.map(serializeAgentMessage),
    patchSummary,
    pendingApproval: await getPendingAgentApproval(session.id, workspaceId, profileId),
    warnings: agentResponse.warnings,
    questions: agentResponse.questions,
    editor: patchResult.editor
  };
}

export async function getPendingAgentApproval(sessionId: string, workspaceId: string, profileId: string) {
  const proposal = await prisma.agentProposal.findFirst({
    where: {
      workspaceId,
      profileId,
      sessionId,
      status: "pending",
      changes: {
        some: { status: "pending" }
      }
    },
    orderBy: { createdAt: "desc" },
    include: {
      patchLogs: {
        where: {
          status: { in: ["needs_confirmation", "conflict"] },
          requiresConfirmation: true,
          patchType: { in: ["update_personal", "add_entry", "update_entry", "delete_entry"] }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!proposal || proposal.patchLogs.length === 0) {
    const legacyLogs = await prisma.cvAgentPatchLog.findMany({
      where: {
        workspaceId,
        profileId,
        sessionId,
        proposalId: null,
        status: { in: ["needs_confirmation", "conflict"] },
        requiresConfirmation: true,
        patchType: { in: ["update_personal", "add_entry", "update_entry", "delete_entry"] }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    if (legacyLogs.length === 0) return null;

    const legacyChanges = await approvalChanges(profileId, legacyLogs);
    if (legacyChanges.length === 0) return null;

    return {
      patchLogIds: legacyLogs.map((log) => log.id),
      label: "Approve CV update",
      message: approvalMessage(legacyLogs.map((log) => log.resultJson)),
      changes: legacyChanges
    };
  }

  const changes = await approvalChanges(profileId, proposal.patchLogs);
  if (changes.length === 0) return null;

  return {
    proposalId: proposal.id,
    patchLogIds: proposal.patchLogs.map((log) => log.id),
    label: "Approve CV update",
    message: approvalMessage(proposal.patchLogs.map((log) => log.resultJson)),
    changes
  };
}

async function approvalChanges(profileId: string, logs: { patchJson: Prisma.JsonValue }[]) {
  const parsedPatches = logs.flatMap((log) => {
    const result = cvAgentPatchSchema.safeParse(log.patchJson);
    return result.success ? [result.data] : [];
  });

  if (parsedPatches.length === 0) return [];

  const [profile, sections] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSection.findMany({
      where: { profileId },
      include: { entries: { orderBy: { entryOrder: "asc" } } }
    })
  ]);

  const changes = parsedPatches.flatMap((patch) =>
    patchPreviewChanges(patch, profile as unknown as ApprovalProfile, sections as ApprovalSection[])
  );
  return changes.slice(0, 8);
}

function patchPreviewChanges(
  patch: CvAgentPatch,
  profile: ApprovalProfile,
  sections: ApprovalSection[]
) {
  if (patch.type === "update_personal") {
    const cleaned = cleanPersonalPatchData(patch.data);

    return Object.entries(cleaned).map(([key, after]) => {
      const label = personalFields.find((field) => field.name === key)?.label ?? key;
      const before = String(profile[key] ?? "").trim();
      return approvalChange(label, before, after);
    });
  }

  if (patch.type === "add_entry") {
    const definition = sectionDefinitionByKey(patch.sectionKey);
    if (!definition) return [];

    const cleaned = cleanSectionPatchData(patch.sectionKey, patch.data);
    const section = sections.find((item) => item.key === patch.sectionKey);
    const existingEntry = patch.sectionKey === "declaration" ? section?.entries[0] : null;

    if (existingEntry) {
      const currentData = existingEntry.data as Record<string, unknown>;
      return Object.entries(cleaned).map(([key, after]) => {
        const label = definition.fields.find((field) => field.name === key)?.label ?? key;
        const before = String(currentData[key] ?? "").trim();
        return approvalChange(`${definition.shortTitle}: ${label}`, before, after);
      });
    }

    return [
      approvalChange(
        `${definition.shortTitle}: New entry`,
        "",
        formatEntryPreview(patch.sectionKey, cleaned)
      )
    ];
  }

  if (patch.type === "update_entry") {
    const definition = sectionDefinitionByKey(patch.sectionKey);
    const entry = sections
      .find((section) => section.key === patch.sectionKey)
      ?.entries.find((item) => item.id === patch.entryId);

    if (!definition || !entry) return [];

    const currentData = entry.data as Record<string, unknown>;
    const cleaned = cleanSectionPatchData(patch.sectionKey, patch.data);
    return Object.entries(cleaned).map(([key, after]) => {
      const label = definition.fields.find((field) => field.name === key)?.label ?? key;
      const before = String(currentData[key] ?? "").trim();
      return approvalChange(`${definition.shortTitle}: ${label}`, before, after);
    });
  }

  if (patch.type === "delete_entry") {
    const definition = sectionDefinitionByKey(patch.sectionKey);
    const entry = sections
      .find((section) => section.key === patch.sectionKey)
      ?.entries.find((item) => item.id === patch.entryId);

    if (!definition || !entry) return [];

    return [
      approvalChange(
        `${definition.shortTitle}: Remove entry`,
        formatEntryPreview(patch.sectionKey, entry.data as Record<string, string>),
        "Removed"
      )
    ];
  }

  return [];
}

function approvalChange(label: string, before: string, after: string) {
  return {
    label,
    before: before || "Empty",
    after: after || "Empty"
  };
}

function formatEntryPreview(sectionKey: string, data: Record<string, string>) {
  const definition = sectionDefinitionByKey(sectionKey);
  if (!definition) return Object.values(data).filter(Boolean).join("; ");

  const fullData = cleanEntryData(sectionKey, data);
  return definition.fields
    .map((field) => {
      const value = fullData[field.name]?.trim();
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean)
    .slice(0, 5)
    .join("; ");
}

async function callCvAgent(context: Awaited<ReturnType<typeof getAgentContext>>, userMessage: string, attachments: { filename: string; fileType: string; status: string; extractedText: string; extractedFactsJson: Prisma.JsonValue }[]): Promise<CvAgentResponse> {
  const localResponse = localCvResponse(context, userMessage);
  if (localResponse) {
    return localResponse;
  }

  if (!deepSeekIsConfigured()) {
    return {
      assistantMessage:
        "The AI chat is ready, but DeepSeek is not configured on this server yet. Add DEEPSEEK_API_KEY, then I can update your CV fields safely.",
      patches: [],
      questions: ["Please ask the site admin to configure DeepSeek for the CV agent."],
      warnings: ["DEEPSEEK_API_KEY is missing."],
      memoryUpdate: {}
    };
  }

  const timeoutMs = Math.max(15000, Number.parseInt(process.env.CVSCHOLAR_CV_AGENT_TIMEOUT_MS || "45000", 10));

  try {
    const parsed = await deepSeekJson<unknown>({
      timeoutMs,
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
                status: attachment.status,
                extractedText: attachment.extractedText.slice(0, 4000),
                extractedFactsJson: attachment.extractedFactsJson
              }))
            ],
            sectionCatalog: sectionCatalogForPrompt()
          })
        }
      ]
    });

    return cvAgentResponseSchema.parse(parsed);
  } catch (error) {
    return {
      assistantMessage:
        "I could not process that message safely. Please try again with one clear CV detail, such as your degree, institution, and year.",
      patches: [],
      questions: ["Can you send the detail again in a short sentence?"],
      warnings: [error instanceof Error ? error.message : "CV agent failed."],
      memoryUpdate: {}
    };
  }
}

function localCvResponse(context: Awaited<ReturnType<typeof getAgentContext>>, userMessage: string): CvAgentResponse | null {
  const message = userMessage.trim();
  if (!message) return null;

  const normalized = normalizeSearchText(message);
  const education = context.editor.sections.find((section) => section.key === "education");
  const educationEntries = education?.entries ?? [];

  if (/\b(list|show|give)\b/.test(normalized) && /\b(education|degree|degrees)\b/.test(normalized)) {
    return {
      assistantMessage: educationEntries.length
        ? `Your education entries are: ${educationEntries.map((entry, index) => `${index + 1}. ${entrySummaryText(entry)}`).join(" ")}`
        : "Your Education section does not have any entries yet.",
      patches: [],
      questions: [],
      warnings: [],
      memoryUpdate: {}
    };
  }

  if (/\b(remove|delete|keep only|keep first)\b/.test(normalized) && /\b(education|degree|degrees|major)\b/.test(normalized)) {
    const patches = educationDeletePatches(educationEntries, normalized);
    if (patches.length > 0) {
      const firstDeletePatch = patches[0]?.type === "delete_entry" ? patches[0] : null;
      return {
        assistantMessage:
          patches.length === 1 && firstDeletePatch
            ? `I found this Education entry to remove: ${entrySummaryText(educationEntries.find((entry) => entry.id === firstDeletePatch.entryId))}. Review it below before I remove it.`
            : `I found ${patches.length} Education entries to remove. Review them below before I remove them.`,
        patches,
        questions: [],
        warnings: [],
        memoryUpdate: {}
      };
    }

    return {
      assistantMessage: educationEntries.length
        ? `I could not confidently identify which Education entry to remove. Your entries are: ${educationEntries.map((entry, index) => `${index + 1}. ${entrySummaryText(entry)}`).join(" ")}`
        : "Your Education section does not have any entries to remove.",
      patches: [],
      questions: educationEntries.length ? ["Please mention the entry number or exact degree text to remove."] : [],
      warnings: [],
      memoryUpdate: {}
    };
  }

  return null;
}

function educationDeletePatches(
  entries: Awaited<ReturnType<typeof getAgentContext>>["editor"]["sections"][number]["entries"],
  normalizedMessage: string
): CvAgentResponse["patches"] {
  if (entries.length === 0) return [];

  if (/\b(keep only|keep)\b/.test(normalizedMessage) && /\b(first|1st|first degree)\b/.test(normalizedMessage)) {
    return entries.slice(1).map((entry) => ({
      type: "delete_entry",
      sectionKey: "education",
      entryId: entry.id,
      confidence: 0.95,
      requiresConfirmation: true,
      reason: "User asked to keep the first Education entry and remove the others."
    }));
  }

  const terms = normalizedMessage
    .split(" ")
    .filter((term) => term.length > 2)
    .filter((term) => !removeSearchStopWords.has(term));

  if (terms.length === 0) return [];

  return entries
    .filter((entry) => entryMatchesTerms(entry, terms))
    .map((entry) => ({
      type: "delete_entry",
      sectionKey: "education",
      entryId: entry.id,
      confidence: 0.9,
      requiresConfirmation: true,
      reason: `User asked to remove the Education entry matching: ${terms.join(" ")}.`
    }));
}

function entryMatchesTerms(entry: Awaited<ReturnType<typeof getAgentContext>>["editor"]["sections"][number]["entries"][number], terms: string[]) {
  const text = normalizeSearchText(entrySummaryText(entry));
  const words = text.split(" ").filter(Boolean);
  return terms.every((term) => words.some((word) => word === term || word.startsWith(term) || term.startsWith(word)));
}

function entrySummaryText(entry: Awaited<ReturnType<typeof getAgentContext>>["editor"]["sections"][number]["entries"][number] | undefined) {
  if (!entry) return "Unknown entry";
  const values = [
    entry.summary,
    ...Object.values(entry.data).filter((value): value is string => typeof value === "string")
  ];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 6).join(" | ") || "Untitled entry";
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const removeSearchStopWords = new Set([
  "can",
  "you",
  "please",
  "remove",
  "delete",
  "keep",
  "only",
  "first",
  "from",
  "my",
  "the",
  "this",
  "that",
  "entry",
  "entries",
  "field",
  "fields",
  "education",
  "degree",
  "degrees",
  "section"
]);

function buildSystemPrompt() {
  return [
    "You are CVScholar, a professional academic CV assistant.",
    "You help academics complete their CV step by step using only information provided by the user, existing CV data, or attached-file facts.",
    "The currentCv object in each user payload is the live CV field snapshot you are allowed to inspect. Do not claim you cannot access CV fields when the answer is available in currentCv.",
    "Never invent degrees, institutions, dates, roles, publications, awards, grants, metrics, or achievements.",
    "Never silently delete data. For a user-requested removal, return a delete_entry patch using the exact entryId from currentCv and describe it as drafted for approval.",
    "Never overwrite existing filled profile fields unless the app approval step applies your patch.",
    "Normal chat is proposal-only. When you suggest a CV data change, return the correct patch but describe it as drafted or ready for review, not saved.",
    "The app will show an approval button for every CV data change. Do not ask the user to type yes to apply a change.",
    "If details are vague or conflicting, ask one short follow-up question and return an ask_confirmation patch.",
    "Prefer safe patches that fill empty personal fields and add non-duplicate section entries.",
    "For requests like remove, delete, keep only, or clean duplicate entries, identify matching currentCv section entries by id and return delete_entry patches for the entries that should be removed.",
    "Do not say an update is saved unless you also return a patch for that update.",
    "Do not say you will check or reapply something later. Either return a safe patch now or ask one clear question.",
    "Keep replies short, friendly, and non-technical.",
    cvAgentStructuredOutputInstruction()
  ].join("\n\n");
}

function reconcileAssistantMessage(message: string, summary: ReturnType<typeof summarizePatchResults>) {
  if (summary.approvalRequired > 0 && summary.applied === 0) {
    return "I drafted this CV update. Review it below and click Approve CV update to apply it.";
  }

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

function approvalMessage(results: Prisma.JsonValue[]) {
  const messages = results
    .map((result) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) return "";
      const value = (result as Record<string, unknown>).message;
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean);

  return messages[0] || "I found an existing CV field with different information. Approve this to replace it.";
}

async function updateAgentMemory(profileId: string, response: CvAgentResponse, completedSections: string[]) {
  const update = response.memoryUpdate ?? {};
  const existing = await prisma.cvAgentMemory.findUnique({ where: { profileId } });
  const existingCompleted = stringArray(existing?.completedSections);
  const nextCompleted = mergeStringArrays(existingCompleted, update.completedSections ?? completedSections);
  const data = {
    summaryJson: {
      ...(jsonObject(existing?.summaryJson)),
      ...(update.summaryJson ?? {})
    } as Prisma.InputJsonValue,
    confirmedFacts: mergeStringArrays(stringArray(existing?.confirmedFacts), update.confirmedFacts) as Prisma.InputJsonValue,
    uncertainFacts: mergeStringArrays(stringArray(existing?.uncertainFacts), update.uncertainFacts) as Prisma.InputJsonValue,
    pendingQuestions: mergeStringArrays(stringArray(existing?.pendingQuestions), update.pendingQuestions ?? response.questions) as Prisma.InputJsonValue,
    completedSections: nextCompleted as Prisma.InputJsonValue,
    nextBestSection: update.nextBestSection || existing?.nextBestSection || nextBestSection(nextCompleted),
    preferredTone: update.preferredTone || existing?.preferredTone || "professional",
    targetCvType: update.targetCvType || existing?.targetCvType || "academic"
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

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringArray(value: Prisma.JsonValue | string[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim() !== "") {
      strings.push(item);
    }
  }
  return strings;
}

function mergeStringArrays(existing: string[], incoming: string[] | undefined) {
  if (!incoming) return existing;
  return Array.from(new Set([...existing, ...incoming.map((item) => item.trim()).filter(Boolean)])).slice(0, 80);
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
