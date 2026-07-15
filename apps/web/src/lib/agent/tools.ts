import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { applyAgentPatches, summarizePatchResults } from "@/lib/cv-agent/patches";
import { cleanPersonalPatchData, cleanSectionPatchData, type CvAgentPatch } from "@/lib/cv-agent/schemas";
import { getAgentEditorPayload } from "@/lib/cv-agent/context";
import { getPdfRenderQueue } from "@/lib/pdf-queue";
import { buildCvSnapshot, buildPreviewHtml, refreshCompleteness } from "@/lib/profile-editor";
import { defaultVisibleSectionKeys, profileSections, sectionDefinitionByKey } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { enforceToolPolicy, toolPolicies } from "./policy";

export type AuthorizedToolContext = {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  runId: string;
  taskId?: string;
  threadId?: string;
  messageId?: string;
  allowedTools: string[];
};

type ToolHandler<TInput = unknown> = {
  schema: z.ZodType<TInput>;
  execute: (context: AuthorizedToolContext, input: TInput) => Promise<unknown>;
};

function defineTool<TSchema extends z.ZodTypeAny>(handler: {
  schema: TSchema;
  execute: (context: AuthorizedToolContext, input: z.infer<TSchema>) => Promise<unknown>;
}) {
  return handler;
}

const sectionKeySchema = z.string().refine((key) => Boolean(sectionDefinitionByKey(key)), "Unknown profile section.");

const toolHandlers = {
  get_profile_overview: defineTool({
    schema: z.object({}),
    execute: async (context) => {
      const editor = await getAgentEditorPayload(context.profileId);
      return {
        profile: editor.profile,
        sections: editor.sections.map((section) => ({
          key: section.key,
          title: section.title,
          activeEntries: section.entries.length,
          isVisible: section.isVisible
        }))
      };
    }
  }),
  list_section_entries: defineTool({
    schema: z.object({ sectionKey: sectionKeySchema }),
    execute: async (context, input) => {
      const section = await prisma.profileSection.findUnique({
        where: {
          profileId_key: {
            profileId: context.profileId,
            key: input.sectionKey
          }
        },
        include: {
          entries: {
            where: { archivedAt: null },
            orderBy: { entryOrder: "asc" }
          }
        }
      });

      return {
        sectionKey: input.sectionKey,
        title: section?.title ?? sectionDefinitionByKey(input.sectionKey)?.title ?? input.sectionKey,
        entries: (section?.entries ?? []).map((entry) => ({
          id: entry.id,
          version: entry.version,
          entryOrder: entry.entryOrder,
          isVisible: entry.isVisible,
          data: entry.data
        }))
      };
    }
  }),
  get_profile_entry: defineTool({
    schema: z.object({ entryId: z.string().min(1), sectionKey: sectionKeySchema }),
    execute: async (context, input) => {
      const entry = await prisma.profileSectionEntry.findFirst({
        where: {
          id: input.entryId,
          profileId: context.profileId,
          sectionKey: input.sectionKey,
          archivedAt: null
        }
      });
      if (!entry) throw new Error("Profile entry not found.");
      return {
        id: entry.id,
        sectionKey: entry.sectionKey,
        version: entry.version,
        data: entry.data,
        isVisible: entry.isVisible,
        updatedAt: entry.updatedAt.toISOString()
      };
    }
  }),
  propose_personal_update: defineTool({
    schema: z.object({ data: z.record(z.string(), z.string()) }),
    execute: async (context, input) => createProposalFromPatch(context, { type: "update_personal", data: cleanPersonalPatchData(input.data), requiresConfirmation: true, confidence: 0.8 })
  }),
  propose_entry_add: defineTool({
    schema: z.object({ sectionKey: sectionKeySchema, data: z.record(z.string(), z.string()) }),
    execute: async (context, input) => createProposalFromPatch(context, { type: "add_entry", sectionKey: input.sectionKey, data: cleanSectionPatchData(input.sectionKey, input.data), requiresConfirmation: true, confidence: 0.8 })
  }),
  propose_entry_update: defineTool({
    schema: z.object({ sectionKey: sectionKeySchema, entryId: z.string().min(1), data: z.record(z.string(), z.string()) }),
    execute: async (context, input) => createProposalFromPatch(context, { type: "update_entry", sectionKey: input.sectionKey, entryId: input.entryId, data: cleanSectionPatchData(input.sectionKey, input.data), requiresConfirmation: true, confidence: 0.8 })
  }),
  propose_entry_archive: defineTool({
    schema: z.object({ sectionKey: sectionKeySchema, entryId: z.string().min(1), reason: z.string().max(500).optional() }),
    execute: async (context, input) => createProposalFromPatch(context, { type: "delete_entry", sectionKey: input.sectionKey, entryId: input.entryId, requiresConfirmation: true, reason: input.reason, confidence: 0.8 })
  }),
  list_cv_documents: defineTool({
    schema: z.object({}),
    execute: async (context) => {
      const documents = await prisma.cvDocument.findMany({
        where: { profileId: context.profileId },
        orderBy: { updatedAt: "desc" }
      });
      return documents.map((document) => ({
        id: document.id,
        title: document.title,
        templateKey: document.templateKey,
        version: document.version,
        visibleSectionKeys: document.visibleSectionKeys,
        pdfReady: Boolean(document.pdfPath),
        updatedAt: document.updatedAt.toISOString()
      }));
    }
  }),
  get_cv_document: defineTool({
    schema: z.object({ documentId: z.string().min(1) }),
    execute: async (context, input) => {
      const document = await prisma.cvDocument.findFirst({
        where: {
          id: input.documentId,
          profileId: context.profileId
        }
      });
      if (!document) throw new Error("CV document not found.");
      return {
        id: document.id,
        title: document.title,
        templateKey: document.templateKey,
        version: document.version,
        visibleSectionKeys: document.visibleSectionKeys,
        previewHtml: document.previewHtml.slice(0, 6000),
        pdfReady: Boolean(document.pdfPath),
        renderError: document.renderError
      };
    }
  }),
  get_attachment_status: defineTool({
    schema: z.object({ attachmentId: z.string().min(1).optional() }),
    execute: async (context, input) => {
      const attachments = await prisma.cvAgentAttachment.findMany({
        where: {
          workspaceId: context.workspaceId,
          profileId: context.profileId,
          sessionId: context.sessionId,
          ...(input.attachmentId ? { id: input.attachmentId } : {})
        },
        orderBy: { createdAt: "desc" },
        take: input.attachmentId ? 1 : 8
      });
      return attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        fileType: attachment.fileType,
        status: attachment.status,
        error: attachment.error,
        createdAt: attachment.createdAt.toISOString()
      }));
    }
  }),
  get_extracted_evidence: defineTool({
    schema: z.object({ attachmentId: z.string().min(1) }),
    execute: async (context, input) => {
      const attachment = await prisma.cvAgentAttachment.findFirst({
        where: {
          id: input.attachmentId,
          workspaceId: context.workspaceId,
          profileId: context.profileId,
          sessionId: context.sessionId
        }
      });
      if (!attachment) throw new Error("Attachment not found.");
      return {
        id: attachment.id,
        filename: attachment.filename,
        status: attachment.status,
        untrustedEvidence: true,
        extractedText: attachment.extractedText.slice(0, 12000),
        extractedFactsJson: attachment.extractedFactsJson
      };
    }
  }),
  start_pdf_render_job: defineTool({
    schema: z.object({ documentId: z.string().min(1).optional(), templateKey: z.enum(["classic", "modern", "detailed"]).default("classic") }),
    execute: async (context, input) => {
      const existingDocument = input.documentId
        ? await prisma.cvDocument.findFirst({ where: { id: input.documentId, profileId: context.profileId } })
        : await prisma.cvDocument.findFirst({ where: { profileId: context.profileId }, orderBy: { updatedAt: "desc" } });
      const snapshot = await buildCvSnapshot(context.profileId, Array.isArray(existingDocument?.visibleSectionKeys) ? existingDocument.visibleSectionKeys.filter((key): key is string => typeof key === "string") : undefined);
      const snapshotJson = JSON.parse(JSON.stringify(snapshot));
      const visibleSectionKeys = Array.isArray(existingDocument?.visibleSectionKeys) ? existingDocument.visibleSectionKeys : defaultVisibleSectionKeys;
      const document = existingDocument
        ? await prisma.cvDocument.update({
            where: { id: existingDocument.id },
            data: {
              snapshot: snapshotJson,
              previewHtml: buildPreviewHtml(snapshot),
              renderEngine: "tectonic",
              renderError: "",
              lastCompiledAt: new Date(),
              version: { increment: 1 }
            }
          })
        : await prisma.cvDocument.create({
            data: {
              profileId: context.profileId,
              title: "Academic CV",
              templateKey: input.templateKey,
              visibleSectionKeys,
              snapshot: snapshotJson,
              previewHtml: buildPreviewHtml(snapshot),
              renderEngine: "tectonic",
              renderError: "",
              lastCompiledAt: new Date()
            }
          });
      const renderJob = await prisma.pdfRenderJob.create({
        data: {
          workspaceId: context.workspaceId,
          profileId: context.profileId,
          documentId: document.id,
          templateKey: input.templateKey,
          status: "queued",
          message: "PDF render queued by agent tool.",
          inputHash: stableHash({ snapshot: snapshotJson, templateKey: input.templateKey }),
          templateVersion: "1.0.0"
        }
      });
      await getPdfRenderQueue().add("render-classic-cv", {
        jobId: renderJob.id,
        workspaceId: context.workspaceId,
        profileId: context.profileId,
        documentId: document.id
      }, { jobId: renderJob.id });
      await refreshCompleteness(context.profileId);
      return { jobId: renderJob.id, documentId: document.id, status: renderJob.status };
    }
  }),
  get_pdf_job_status: defineTool({
    schema: z.object({ jobId: z.string().min(1) }),
    execute: async (context, input) => {
      const job = await prisma.pdfRenderJob.findFirst({
        where: {
          id: input.jobId,
          workspaceId: context.workspaceId,
          profileId: context.profileId
        }
      });
      if (!job) throw new Error("PDF job not found.");
      return {
        jobId: job.id,
        status: job.status,
        message: job.message,
        pdfReady: job.status === "completed" && Boolean(job.fileAssetId),
        pdfError: job.status === "failed" ? job.message : ""
      };
    }
  })
};

export type AgentToolName = keyof typeof toolHandlers;

export function availableToolDescriptions(toolNames: string[]) {
  return toolNames
    .map((name) => toolPolicies[name])
    .filter(Boolean)
    .map((policy) => ({
      name: policy.name,
      version: policy.version,
      risk: policy.risk,
      requiresApproval: policy.requiresApproval,
      description: policy.description
    }));
}

export async function runAgentTool(context: AuthorizedToolContext, toolName: AgentToolName, rawInput: unknown) {
  const policy = enforceToolPolicy({ toolName, allowedTools: context.allowedTools });
  const handler = toolHandlers[toolName] as ToolHandler;
  const input = handler.schema.parse(rawInput);
  const idempotencyKey = stableHash({ runId: context.runId, toolName, input });
  const existing = await prisma.agentToolCall.findUnique({
    where: { idempotencyKey }
  });

  if (existing && existing.status === "completed") {
    return existing.outputJson;
  }

  const call = existing ??
    await prisma.agentToolCall.create({
      data: {
        workspaceId: context.workspaceId,
        profileId: context.profileId,
        runId: context.runId,
        toolName,
        toolVersion: policy.version,
        risk: policy.risk,
        status: "started",
        inputJson: input as Prisma.InputJsonValue,
        idempotencyKey
      }
    });

  try {
    const output = await handler.execute(context, input);
    const outputJson = JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue;
    await prisma.agentToolCall.update({
      where: { id: call.id },
      data: {
        status: "completed",
        outputJson,
        finishedAt: new Date()
      }
    });
    return outputJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed.";
    await prisma.agentToolCall.update({
      where: { id: call.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

async function createProposalFromPatch(context: AuthorizedToolContext, patch: CvAgentPatch) {
  const result = await applyAgentPatches({
    workspaceId: context.workspaceId,
    profileId: context.profileId,
    sessionId: context.sessionId,
    taskId: context.taskId,
    threadId: context.threadId,
    messageId: context.messageId,
    patches: [patch],
    requireApproval: true
  });
  return {
    patchSummary: summarizePatchResults(result.results),
    pending: result.needsConfirmationCount + result.conflictCount,
    editorCompleteness: result.completeness
  };
}

export function inferToolPlan(message: string, attachmentIds: string[], allowedTools: string[]) {
  const normalized = message.toLowerCase();
  const planned: { toolName: AgentToolName; input: unknown }[] = [];

  if (allowedTools.includes("get_profile_overview")) {
    planned.push({ toolName: "get_profile_overview", input: {} });
  }

  const section = profileSections.find((item) => normalized.includes(item.key.replace(/_/g, " ")) || normalized.includes(item.title.toLowerCase()));
  if (section && allowedTools.includes("list_section_entries")) {
    planned.push({ toolName: "list_section_entries", input: { sectionKey: section.key } });
  }

  if (attachmentIds.length > 0 && allowedTools.includes("get_attachment_status")) {
    for (const attachmentId of attachmentIds.slice(0, 3)) {
      planned.push({ toolName: "get_attachment_status", input: { attachmentId } });
    }
  }

  if (/\b(cv|version|document|pdf|render|compile)\b/.test(normalized) && allowedTools.includes("list_cv_documents")) {
    planned.push({ toolName: "list_cv_documents", input: {} });
  }

  return planned.slice(0, Math.max(1, Number.parseInt(process.env.CVSCHOLAR_AGENT_MAX_TOOL_STEPS || "4", 10)));
}

function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortJson(item)])
  );
}
