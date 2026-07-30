/**
 * Pending dialogue offers + semantic stance classification.
 *
 * When the assistant asks a concrete next-step question, we store it on the thread.
 * The next user turn is classified by stance (accept / decline / constraint / new request /
 * unclear) using the classification model — not a fixed yes/no word list.
 *
 * A tiny offline heuristic is only used when the model is unavailable.
 */

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { generateJsonWithGateway, modelGatewayIsConfigured } from "@/lib/agent/model-gateway";
import type { AgentJobType } from "@/lib/agent/policy";
import { allowedToolsForJobs, type AgentPlanResult, type PlannedAgentJob } from "@/lib/agent/planner";

export const DIALOGUE_OFFER_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const DIALOGUE_STANCE_MIN_CONFIDENCE = 0.62;

/** Lazy prisma so pure helpers (and unit tests) do not require DATABASE_URL at import time. */
async function db() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export type DialogueOfferKind =
  | "unhide_and_reorder_sections"
  | "reorder_sections"
  | "unhide_sections"
  | "apply_guidance"
  | "generic_continue";

export type PendingDialogueOffer = {
  id: string;
  kind: DialogueOfferKind;
  /** Free-text action the executor should pursue when the user accepts. */
  actionSummary: string;
  /** Preferred job type when continuing. */
  jobType: AgentJobType;
  /** Source assistant message id when known. */
  messageId?: string;
  /** Optional structured payload (section keys, etc.). */
  payload?: {
    sectionKeys?: string[];
    order?: string[];
    note?: string;
  };
  createdAt: string;
  expiresAt: string;
  status: "open" | "accepted" | "declined" | "expired";
};

export type DialogueStance =
  | "accept"
  | "accept_with_constraint"
  | "decline"
  | "new_request"
  | "unclear";

export type DialogueStanceResult = {
  stance: DialogueStance;
  confidence: number;
  /** Scope limit when stance is accept_with_constraint. */
  constraint: string | null;
  /** Short model rationale (for logs / events). */
  reason: string;
  source: "classifier" | "offline_heuristic";
  provider: string;
  model: string;
  latencyMs: number;
};

export type DialogueTurnResolution =
  | {
      action: "none";
      stance: null;
    }
  | {
      action: "accept";
      offer: PendingDialogueOffer;
      stance: DialogueStanceResult;
      effectiveUserMessage: string;
      plan: AgentPlanResult;
    }
  | {
      action: "decline";
      offer: PendingDialogueOffer;
      stance: DialogueStanceResult;
      replyText: string;
    }
  | {
      action: "unclear";
      offer: PendingDialogueOffer;
      stance: DialogueStanceResult;
      replyText: string;
    }
  | {
      action: "new_request";
      offer: PendingDialogueOffer;
      stance: DialogueStanceResult;
    };

type ThreadState = {
  pendingDialogueOffer?: PendingDialogueOffer | null;
  [key: string]: unknown;
};

const stanceSchema = z.object({
  stance: z.enum(["accept", "accept_with_constraint", "decline", "new_request", "unclear"]),
  confidence: z.number().min(0).max(1).default(0.5),
  constraint: z.string().trim().max(400).nullable().optional().default(null),
  reason: z.string().trim().max(300).optional().default("")
});

// —— Persistence ——

export function isOfferExpired(offer: PendingDialogueOffer, now = Date.now()): boolean {
  return new Date(offer.expiresAt).getTime() <= now || offer.status !== "open";
}

export async function loadPendingDialogueOffer(threadId: string): Promise<PendingDialogueOffer | null> {
  const prisma = await db();
  const thread = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { stateJson: true }
  });
  if (!thread) return null;
  const state = (thread.stateJson || {}) as ThreadState;
  const offer = state.pendingDialogueOffer;
  if (!offer || typeof offer !== "object") return null;
  if (isOfferExpired(offer)) {
    await clearPendingDialogueOffer(threadId);
    return null;
  }
  return offer;
}

export async function savePendingDialogueOffer(threadId: string, offer: PendingDialogueOffer) {
  const prisma = await db();
  const thread = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { stateJson: true }
  });
  if (!thread) return;
  const state = { ...((thread.stateJson || {}) as ThreadState), pendingDialogueOffer: offer };
  await prisma.agentThread.update({
    where: { id: threadId },
    data: { stateJson: state as Prisma.InputJsonValue }
  });
}

export async function clearPendingDialogueOffer(threadId: string) {
  const prisma = await db();
  const thread = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { stateJson: true }
  });
  if (!thread) return;
  const state = { ...((thread.stateJson || {}) as ThreadState) };
  if (!state.pendingDialogueOffer) return;
  state.pendingDialogueOffer = null;
  await prisma.agentThread.update({
    where: { id: threadId },
    data: { stateJson: state as Prisma.InputJsonValue }
  });
}

export async function markDialogueOfferStatus(threadId: string, status: PendingDialogueOffer["status"]) {
  const offer = await loadPendingDialogueOffer(threadId);
  if (!offer) return;
  if (status === "open") return;
  await clearPendingDialogueOffer(threadId);
}

// —— Offer extraction from assistant text ——

/**
 * Detect a free-text next-step offer in the assistant reply.
 * Prefer explicit questions that invite yes/no continuation.
 */
export function extractDialogueOfferFromAssistant(input: {
  assistantMessage: string;
  messageId?: string;
  primaryIntent?: AgentJobType | string;
}): PendingDialogueOffer | null {
  const text = input.assistantMessage.trim();
  if (!text || text.length < 40) return null;

  const asks =
    /\b(would you like|shall i|should i|do you want|want me to|can i|may i|shall we|should we)\b/i.test(text) ||
    /\?\s*$/m.test(text.split("\n").filter(Boolean).slice(-3).join("\n"));
  if (!asks) return null;

  // Avoid treating pure data-approval UI copy as a typed-yes offer
  if (/click approve|approval button|approve cv update/i.test(text) && !/would you like|shall i/i.test(text)) {
    return null;
  }

  const lower = text.toLowerCase();
  let kind: DialogueOfferKind = "generic_continue";
  let jobType: AgentJobType = (input.primaryIntent as AgentJobType) || "general";
  let actionSummary = "Continue with the action you just offered.";

  if (/reorder|order of|section order|professional order|rearrange/i.test(text)) {
    kind = /hidden|unhide|visible|activate|show/i.test(text) ? "unhide_and_reorder_sections" : "reorder_sections";
    jobType = "cv_document";
    actionSummary =
      kind === "unhide_and_reorder_sections"
        ? "Activate hidden CV sections that already have content and apply a professional section order (guide/reorder in the CV editor as needed)."
        : "Apply a professional CV section order and guide the user in the CV Editor.";
  } else if (/hidden|unhide|make.*visible|activate.*section|show.*section/i.test(text)) {
    kind = "unhide_sections";
    jobType = "cv_document";
    actionSummary = "Make relevant hidden CV sections visible when they already have content.";
  } else if (/pdf|compile|download/i.test(text) && /would you like|shall i|should i/i.test(text)) {
    kind = "generic_continue";
    jobType = "pdf_render";
    actionSummary = "Continue with the PDF compile/download action just offered.";
  } else if (/website|publish/i.test(text) && /would you like|shall i|should i/i.test(text)) {
    kind = "generic_continue";
    jobType = lower.includes("publish") ? "website_publish" : "website_update";
    actionSummary = "Continue with the website action just offered.";
  } else if (/review|feedback|critique/i.test(text)) {
    kind = "apply_guidance";
    jobType = "cv_review";
    actionSummary = "Continue the CV review guidance just offered.";
  } else if (/add|update|fill|complete/i.test(text)) {
    kind = "apply_guidance";
    jobType = "profile_update";
    actionSummary = "Continue with the CV update action just offered.";
  } else {
    if (input.primaryIntent && input.primaryIntent !== "clarification_needed") {
      jobType = input.primaryIntent as AgentJobType;
    }
    actionSummary = "Continue with the next step you just offered to the user.";
  }

  const now = Date.now();
  return {
    id: `offer_${now.toString(36)}`,
    kind,
    actionSummary,
    jobType,
    messageId: input.messageId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DIALOGUE_OFFER_TTL_MS).toISOString(),
    status: "open"
  };
}

// —— Stance classification ——

/**
 * Normalize raw classifier output (confidence floor, constraint cleanup).
 * Exported for unit tests.
 */
export function normalizeStanceResult(
  raw: z.infer<typeof stanceSchema>,
  meta: { source: DialogueStanceResult["source"]; provider: string; model: string; latencyMs: number }
): DialogueStanceResult {
  let stance = raw.stance;
  let confidence = Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;
  let constraint =
    typeof raw.constraint === "string" && raw.constraint.trim() ? raw.constraint.trim().slice(0, 400) : null;

  // Promote plain accept when a real constraint is present.
  if (stance === "accept" && constraint) {
    stance = "accept_with_constraint";
  }
  // Drop empty constraints on constrained accepts.
  if (stance === "accept_with_constraint" && !constraint) {
    stance = "accept";
  }

  // Low confidence → treat as unclear (do not silently accept/decline).
  if (confidence < DIALOGUE_STANCE_MIN_CONFIDENCE && stance !== "unclear") {
    return {
      stance: "unclear",
      confidence,
      constraint: null,
      reason: raw.reason || "Low confidence stance; asking the user to clarify.",
      source: meta.source,
      provider: meta.provider,
      model: meta.model,
      latencyMs: meta.latencyMs
    };
  }

  return {
    stance,
    confidence,
    constraint: stance === "accept_with_constraint" ? constraint : null,
    reason: (raw.reason || "").slice(0, 300),
    source: meta.source,
    provider: meta.provider,
    model: meta.model,
    latencyMs: meta.latencyMs
  };
}

/**
 * Offline fallback only when the classification model is unavailable.
 * Intentionally conservative: prefer unclear/new_request over false accepts.
 */
export function offlineStanceHeuristic(userMessage: string): DialogueStanceResult {
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  // Extremely bare accept / decline only (not an expandable dictionary of natural language).
  if (/^(y|yes|yep|yeah|yup|ok|okay|sure|k)([,!]?\s*(pls|please))?[!?.]*$/i.test(trimmed)) {
    return normalizeStanceResult(
      { stance: "accept", confidence: 0.9, constraint: null, reason: "Bare accept (offline)" },
      { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
    );
  }
  if (/^(n|no|nope|nah|cancel|stop)([,!]?\s*(thanks|thank you))?[!?.]*$/i.test(trimmed)) {
    return normalizeStanceResult(
      { stance: "decline", confidence: 0.9, constraint: null, reason: "Bare decline (offline)" },
      { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
    );
  }
  if (/^(not now|no thanks|never mind|nevermind|skip|later)[!?.]*$/i.test(trimmed)) {
    return normalizeStanceResult(
      { stance: "decline", confidence: 0.88, constraint: null, reason: "Soft decline (offline)" },
      { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
    );
  }

  // Soft accept + trailing constraint without claiming full NLP coverage.
  const soft = trimmed.match(/^(yes|yep|yeah|ok|okay|sure)\b[\s,!.-]+(.+)$/i);
  if (soft && words <= 14) {
    const rest = soft[2].trim();
    if (rest && !/^(pls|please)[.!]*$/i.test(rest)) {
      return normalizeStanceResult(
        {
          stance: "accept_with_constraint",
          confidence: 0.78,
          constraint: rest.slice(0, 400),
          reason: "Soft accept with residual text (offline)"
        },
        { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
      );
    }
  }

  // Ambiguous short junk (emoji-only, "hmm", etc.)
  if (/^(hmm+|uh+|um+|idk|maybe|perhaps)[!?.]*$/i.test(lower) || words <= 2) {
    return normalizeStanceResult(
      { stance: "unclear", confidence: 0.75, constraint: null, reason: "Ambiguous short reply (offline)" },
      { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
    );
  }

  // Clear task language → new request (do not guess yes/no).
  // Without a classifier, prefer keeping the offer open (unclear) over false new_request.
  if (
    /\b(add|update|edit|remove|delete|import|export|compile|download|publish|website|orcid|publication|education|award|grant|review|fix|rewrite|fix)\b/i.test(
      trimmed
    ) &&
    words >= 3
  ) {
    return normalizeStanceResult(
      {
        stance: "new_request",
        confidence: 0.72,
        constraint: null,
        reason: "Message looks like a new CV task (offline)"
      },
      { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
    );
  }

  // Natural affirmations like "sounds perfect" need the classifier; offline keeps offer open.
  return normalizeStanceResult(
    {
      stance: "unclear",
      confidence: 0.55,
      constraint: null,
      reason: "Could not classify offline without model; asking for a clearer reply"
    },
    { source: "offline_heuristic", provider: "local", model: "offline-stance", latencyMs: 0 }
  );
}

/**
 * Semantic stance classification against the open offer + last assistant text.
 * Primary path for connected human chat accuracy.
 */
export async function classifyDialogueStance(input: {
  userMessage: string;
  offer: PendingDialogueOffer;
  lastAssistantMessage?: string | null;
}): Promise<DialogueStanceResult> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) {
    return normalizeStanceResult(
      { stance: "unclear", confidence: 0.95, constraint: null, reason: "Empty user message" },
      { source: "offline_heuristic", provider: "local", model: "empty", latencyMs: 0 }
    );
  }

  if (!modelGatewayIsConfigured("classification")) {
    return offlineStanceHeuristic(userMessage);
  }

  const timeoutMs = Math.max(
    4000,
    Number.parseInt(process.env.CVSCHOLAR_AGENT_STANCE_TIMEOUT_MS || "12000", 10)
  );

  try {
    const result = await generateJsonWithGateway<unknown>({
      route: "classification",
      timeoutMs,
      messages: [
        {
          role: "system",
          content: [
            "You classify the user's reply to a pending CV assistant offer.",
            "Return JSON only with keys: stance, confidence (0-1), constraint (string|null), reason (short).",
            "stance values:",
            '- "accept": user agrees to do the offered action as stated',
            '- "accept_with_constraint": user agrees but limits/modifies scope (put limits in constraint)',
            '- "decline": user rejects or postpones the offered action',
            '- "new_request": user asks for something else / changes topic (do not treat as yes/no)',
            '- "unclear": cannot tell; need a short clarification',
            "Rules:",
            "- Classify meaning, not exact keywords. Support natural language, typos, casual phrasing, and short multilingual yes/no if clear.",
            "- If the user both accepts and adds a limit, use accept_with_constraint.",
            "- If the user accepts AND asks a major extra task, prefer new_request unless the extra is a small constraint on the same offer.",
            "- When unsure between accept and decline, use unclear.",
            "- confidence < 0.62 should still pick the best stance; the server will demote low confidence to unclear."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            pendingOffer: {
              id: input.offer.id,
              kind: input.offer.kind,
              actionSummary: input.offer.actionSummary,
              jobType: input.offer.jobType
            },
            lastAssistantMessage: (input.lastAssistantMessage || "").slice(0, 1200),
            userMessage,
            instruction: "Classify the user's stance toward the pendingOffer only."
          })
        }
      ]
    });

    const parsed = stanceSchema.safeParse(result.output);
    if (!parsed.success) {
      return offlineStanceHeuristic(userMessage);
    }

    return normalizeStanceResult(parsed.data, {
      source: "classifier",
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs
    });
  } catch {
    return offlineStanceHeuristic(userMessage);
  }
}

// —— Continuation builders ——

export function buildContinuationUserMessage(
  offer: PendingDialogueOffer,
  userMessage: string,
  constraint?: string | null
): string {
  const limit = constraint?.trim() || null;
  const parts = [
    `The user accepted my previous offer.`,
    `Carry out this action now: ${offer.actionSummary}`,
    limit ? `User constraint: ${limit}` : null,
    `Original user reply was: "${userMessage.trim()}".`
  ].filter(Boolean);
  return parts.join(" ");
}

export function continuationPlanFromOffer(
  offer: PendingDialogueOffer,
  options: { constraint?: string | null; confidence?: number } = {}
): PlannedAgentJob {
  const limit = options.constraint?.trim() || null;
  const summary = limit
    ? `${offer.actionSummary} (constraint: ${limit})`.slice(0, 300)
    : offer.actionSummary.slice(0, 300);
  return {
    type: offer.jobType,
    summary,
    confidence: options.confidence ?? 0.92,
    order: 1
  };
}

function planFromContinuationJob(job: PlannedAgentJob, stance: DialogueStanceResult): AgentPlanResult {
  return {
    jobs: [job],
    executableJobs: [job],
    primaryIntent: job.type,
    allowedTools: allowedToolsForJobs([job.type]),
    needsClarification: false,
    clarifyingQuestion: null,
    source: "fallback",
    provider: stance.provider,
    model: stance.source === "classifier" ? `dialogue-stance:${stance.model}` : "dialogue-stance-offline",
    latencyMs: stance.latencyMs
  };
}

export function declineReplyText(): string {
  return "Okay — I won’t do that step. What would you like to work on next for your CV?";
}

export function unclearReplyText(offer: PendingDialogueOffer): string {
  const shortAction = offer.actionSummary.replace(/\s+/g, " ").slice(0, 160);
  return `Just to confirm: should I go ahead with this next step — ${shortAction}${offer.actionSummary.length > 160 ? "…" : ""}? You can reply yes, no, or tell me how you want it adjusted.`;
}

/**
 * Full resolve: load stance for an open offer and map to accept / decline / unclear / new_request.
 * Callers clear or keep the offer based on `action`.
 */
export async function resolvePendingOfferTurn(input: {
  userMessage: string;
  offer: PendingDialogueOffer | null;
  lastAssistantMessage?: string | null;
}): Promise<DialogueTurnResolution> {
  if (!input.offer) {
    return { action: "none", stance: null };
  }

  const stance = await classifyDialogueStance({
    userMessage: input.userMessage,
    offer: input.offer,
    lastAssistantMessage: input.lastAssistantMessage
  });

  if (stance.stance === "accept" || stance.stance === "accept_with_constraint") {
    const constraint = stance.stance === "accept_with_constraint" ? stance.constraint : null;
    const job = continuationPlanFromOffer(input.offer, {
      constraint,
      confidence: Math.max(0.85, stance.confidence)
    });
    return {
      action: "accept",
      offer: input.offer,
      stance,
      effectiveUserMessage: buildContinuationUserMessage(input.offer, input.userMessage, constraint),
      plan: planFromContinuationJob(job, stance)
    };
  }

  if (stance.stance === "decline") {
    return {
      action: "decline",
      offer: input.offer,
      stance,
      replyText: declineReplyText()
    };
  }

  if (stance.stance === "unclear") {
    return {
      action: "unclear",
      offer: input.offer,
      stance,
      replyText: unclearReplyText(input.offer)
    };
  }

  // new_request — caller clears offer and runs normal planning
  return {
    action: "new_request",
    offer: input.offer,
    stance
  };
}

// —— Legacy aliases (kept for any remaining imports / tests; prefer stance API) ——

/** @deprecated Prefer resolvePendingOfferTurn / classifyDialogueStance */
export function isShortAffirmation(message: string): boolean {
  const r = offlineStanceHeuristic(message);
  return r.stance === "accept" || r.stance === "accept_with_constraint";
}

/** @deprecated Prefer resolvePendingOfferTurn / classifyDialogueStance */
export function isShortNegation(message: string): boolean {
  return offlineStanceHeuristic(message).stance === "decline";
}

/** @deprecated Prefer stance.constraint from classifyDialogueStance */
export function affirmationConstraint(message: string): string | null {
  const r = offlineStanceHeuristic(message);
  return r.stance === "accept_with_constraint" ? r.constraint : null;
}
