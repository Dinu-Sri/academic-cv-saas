import { z } from "zod";
import { generateJsonWithGateway, modelGatewayIsConfigured } from "@/lib/agent/model-gateway";
import {
  allowedToolsForIntent,
  classifyAgentIntent,
  type AgentIntent,
  type AgentJobType
} from "@/lib/agent/policy";

const JOB_TYPES = [
  "profile_read",
  "profile_update",
  "cv_review",
  "cv_document",
  "attachment_review",
  "pdf_render",
  "website_read",
  "website_update",
  "website_publish",
  "clarification_needed",
  "out_of_scope",
  "general"
] as const satisfies readonly AgentJobType[];

const plannedJobSchema = z.object({
  type: z.enum(JOB_TYPES),
  summary: z.string().trim().min(1).max(300),
  confidence: z.number().min(0).max(1).default(0.5),
  order: z.number().int().min(1).max(10).optional()
});

const plannerOutputSchema = z.object({
  jobs: z.array(plannedJobSchema).max(6).default([]),
  needs_clarification: z.boolean().optional().default(false),
  clarifying_question: z.string().trim().max(500).optional().nullable().default(null)
});

export type PlannedAgentJob = {
  type: AgentJobType;
  summary: string;
  confidence: number;
  order: number;
};

export type AgentPlanResult = {
  jobs: PlannedAgentJob[];
  executableJobs: PlannedAgentJob[];
  primaryIntent: AgentIntent;
  allowedTools: string[];
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  source: "planner" | "fallback";
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
};

const DEFAULT_MAX_JOBS = 3;
const DEFAULT_LOW_CONFIDENCE = 0.5;

export function plannerIsEnabled() {
  return process.env.CVSCHOLAR_AGENT_PLANNER_ENABLED !== "0";
}

export function plannerModelName() {
  return (
    process.env.CVSCHOLAR_AGENT_PLANNER_MODEL ||
    process.env.CVSCHOLAR_AGENT_CLASSIFICATION_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    "deepseek-v4-pro"
  );
}

export async function planAgentJobs({
  message,
  attachmentCount = 0
}: {
  message: string;
  attachmentCount?: number;
}): Promise<AgentPlanResult> {
  const trimmed = message.trim();
  if (!trimmed && attachmentCount === 0) {
    return finalizePlan(
      [
        {
          type: "clarification_needed",
          summary: "Empty message",
          confidence: 1,
          order: 1
        }
      ],
      {
        needsClarification: true,
        clarifyingQuestion: "What would you like to do with your academic CV?",
        source: "fallback",
        provider: "local",
        model: "empty-message",
        latencyMs: 0
      }
    );
  }

  if (!plannerIsEnabled() || !modelGatewayIsConfigured("classification")) {
    return keywordFallbackPlan(trimmed, attachmentCount, !plannerIsEnabled() ? "Planner disabled." : "Planner model is not configured.");
  }

  const timeoutMs = Math.max(8000, Number.parseInt(process.env.CVSCHOLAR_AGENT_PLANNER_TIMEOUT_MS || "20000", 10));

  try {
    const result = await generateJsonWithGateway<unknown>({
      route: "classification",
      timeoutMs,
      messages: [
        {
          role: "system",
          content: buildPlannerSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify({
            message: trimmed || "I attached files for my CV.",
            attachmentCount,
            knownJobTypes: JOB_TYPES,
            instruction:
              "Return JSON only. Split multi-part requests into ordered jobs. Prefer clarification_needed when unsure. Prefer out_of_scope for non-CVScholar requests."
          })
        }
      ]
    });

    const parsed = plannerOutputSchema.safeParse(result.output);
    if (!parsed.success || parsed.data.jobs.length === 0) {
      return keywordFallbackPlan(trimmed, attachmentCount, "Planner returned an invalid or empty job plan.");
    }

    const jobs = normalizeJobs(parsed.data.jobs, attachmentCount);
    return finalizePlan(jobs, {
      needsClarification: Boolean(parsed.data.needs_clarification) || jobs.some((job) => job.type === "clarification_needed"),
      clarifyingQuestion: parsed.data.clarifying_question?.trim() || defaultClarifyingQuestion(jobs),
      source: "planner",
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs
    });
  } catch (error) {
    return keywordFallbackPlan(
      trimmed,
      attachmentCount,
      error instanceof Error ? error.message : "Planner failed."
    );
  }
}

export function buildPlannerEarlyResponse(plan: AgentPlanResult): {
  assistantMessage: string;
  questions: string[];
  warnings: string[];
  patches: [];
  memoryUpdate: Record<string, never>;
} | null {
  const onlyNonExecutable =
    plan.executableJobs.length === 0 &&
    plan.jobs.some((job) => job.type === "clarification_needed" || job.type === "out_of_scope" || job.type === "general");

  if (!onlyNonExecutable && !plan.needsClarification) {
    return null;
  }

  if (plan.executableJobs.length > 0 && !plan.needsClarification) {
    return null;
  }

  if (plan.executableJobs.length === 0 && plan.jobs.every((job) => job.type === "out_of_scope")) {
    return {
      assistantMessage:
        "I can help with your academic profile and CV in CVScholar: add or update sections, review your CV, work with attachments, manage CV versions, and generate a PDF. I cannot help with that request.",
      questions: ["What would you like to do with your academic CV next?"],
      warnings: plan.error ? [plan.error] : [],
      patches: [],
      memoryUpdate: {}
    };
  }

  if (plan.needsClarification || plan.executableJobs.length === 0) {
    const question =
      plan.clarifyingQuestion ||
      "Could you tell me what you want to do with your academic CV in one or two short steps?";
    return {
      assistantMessage: question,
      questions: [question],
      warnings: plan.error ? [plan.error] : [],
      patches: [],
      memoryUpdate: {}
    };
  }

  return null;
}

function keywordFallbackPlan(message: string, attachmentCount: number, error?: string): AgentPlanResult {
  const intent = classifyAgentIntent(message, attachmentCount);
  const jobs: PlannedAgentJob[] = [
    {
      type: intent,
      summary: message.trim().slice(0, 120) || "Attachment review",
      confidence: 0.55,
      order: 1
    }
  ];
  return finalizePlan(jobs, {
    needsClarification: false,
    clarifyingQuestion: null,
    source: "fallback",
    provider: "local",
    model: "keyword-fallback",
    latencyMs: 0,
    error
  });
}

function finalizePlan(
  jobs: PlannedAgentJob[],
  meta: {
    needsClarification: boolean;
    clarifyingQuestion: string | null;
    source: "planner" | "fallback";
    provider: string;
    model: string;
    latencyMs: number;
    error?: string;
  }
): AgentPlanResult {
  const maxJobs = Math.max(1, Number.parseInt(process.env.CVSCHOLAR_AGENT_PLANNER_MAX_JOBS || String(DEFAULT_MAX_JOBS), 10));
  const lowConfidence = Number.parseFloat(process.env.CVSCHOLAR_AGENT_PLANNER_LOW_CONFIDENCE || String(DEFAULT_LOW_CONFIDENCE));
  const rawCount = jobs.length;
  const ordered = preferPdfAfterUpdates(
    [...jobs]
      .sort((a, b) => a.order - b.order || b.confidence - a.confidence)
      .slice(0, maxJobs)
      .map((job, index) => ({ ...job, order: index + 1 }))
  );

  const actionable = ordered.filter((job) => job.type !== "out_of_scope" && job.type !== "clarification_needed");
  const highEnough = actionable.filter((job) => job.confidence >= lowConfidence);

  let needsClarification = meta.needsClarification || ordered.some((job) => job.type === "clarification_needed");
  if (rawCount > maxJobs) needsClarification = true;
  if (actionable.length > 0 && highEnough.length === 0) needsClarification = true;

  // If the only jobs are out_of_scope / clarification, do not execute tools.
  const executableJobs =
    needsClarification && highEnough.length === 0
      ? []
      : highEnough.length > 0
        ? highEnough
        : actionable;

  const primaryIntent = primaryIntentFromJobs(ordered, executableJobs);
  const allowedTools = allowedToolsForJobs(executableJobs.map((job) => job.type));

  return {
    jobs: ordered,
    executableJobs,
    primaryIntent,
    allowedTools,
    needsClarification,
    clarifyingQuestion: meta.clarifyingQuestion || (needsClarification ? defaultClarifyingQuestion(ordered) : null),
    source: meta.source,
    provider: meta.provider,
    model: meta.model,
    latencyMs: meta.latencyMs,
    error: meta.error
  };
}

function primaryIntentFromJobs(allJobs: PlannedAgentJob[], executable: PlannedAgentJob[]): AgentIntent {
  if (executable.length > 0) return executable[0].type as AgentIntent;
  if (allJobs.some((job) => job.type === "clarification_needed")) return "clarification_needed";
  if (allJobs.some((job) => job.type === "out_of_scope")) return "out_of_scope";
  return "general";
}

export function allowedToolsForJobs(jobTypes: AgentJobType[]) {
  const tools = new Set<string>();
  for (const type of jobTypes) {
    if (type === "out_of_scope" || type === "clarification_needed") continue;
    for (const tool of allowedToolsForIntent(type as AgentIntent)) {
      tools.add(tool);
    }
  }
  if (tools.size === 0) {
    return allowedToolsForIntent("general");
  }
  return Array.from(tools);
}

function preferPdfAfterUpdates(jobs: PlannedAgentJob[]) {
  const updates = jobs.filter((job) => job.type === "profile_update");
  const pdfs = jobs.filter((job) => job.type === "pdf_render");
  const others = jobs.filter((job) => job.type !== "profile_update" && job.type !== "pdf_render");
  const ordered = [...updates, ...others, ...pdfs];
  return ordered.map((job, index) => ({ ...job, order: index + 1 }));
}

function normalizeJobs(
  rawJobs: z.infer<typeof plannedJobSchema>[],
  attachmentCount: number
): PlannedAgentJob[] {
  const jobs = rawJobs.map((job, index) => ({
    type: job.type as AgentJobType,
    summary: job.summary.trim(),
    confidence: clampConfidence(job.confidence),
    order: job.order ?? index + 1
  }));

  if (attachmentCount > 0 && !jobs.some((job) => job.type === "attachment_review")) {
    jobs.unshift({
      type: "attachment_review",
      summary: "Review attached file evidence",
      confidence: 0.85,
      order: 0
    });
  }

  // De-duplicate by type+summary
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.type}:${job.summary.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultClarifyingQuestion(jobs: PlannedAgentJob[]) {
  if (jobs.length > DEFAULT_MAX_JOBS) {
    return "I see several requests. Which should I do first: update your profile, review your CV, or generate a PDF?";
  }
  return "Could you restate what you want in one short step for your academic CV?";
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function buildPlannerSystemPrompt() {
  return [
    "You are the CVScholar agent planner.",
    "Your only job is to understand the user message and return a structured job plan.",
    "You do not edit CV data. You do not call tools. You only plan.",
    "",
    "Return JSON with this shape:",
    '{',
    '  "jobs": [{"type":"profile_update","summary":"...","confidence":0.9,"order":1}],',
    '  "needs_clarification": false,',
    '  "clarifying_question": null',
    "}",
    "",
    "Known job types:",
    "- profile_update: add/update/remove CV profile facts",
    "- profile_read: show/summarize saved profile data",
    "- cv_review: critique or improve the CV/profile",
    "- cv_document: CV versions, drafts, section order/visibility",
    "- pdf_render: compile/download/preview PDF",
    "- attachment_review: use uploaded files as evidence",
    "- clarification_needed: message is unclear",
    "- out_of_scope: not a CVScholar academic CV task",
    "- general: only when none of the above fit cleanly",
    "",
    "Rules:",
    "- Split multi-part requests into separate jobs (max 3 preferred).",
    "- Use confidence between 0 and 1.",
    "- If unsure, set needs_clarification=true and provide one short clarifying_question.",
    "- Weather, coding, grant budgets, personal chat, etc. are out_of_scope.",
    "- Attachment mentions or attachmentCount>0 usually include attachment_review.",
    "- Prefer profile_update before pdf_render when both appear."
  ].join("\n");
}
