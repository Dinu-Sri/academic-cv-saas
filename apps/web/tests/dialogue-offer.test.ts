import assert from "node:assert/strict";
import {
  buildContinuationUserMessage,
  continuationPlanFromOffer,
  extractDialogueOfferFromAssistant,
  isOfferExpired,
  looksLikeSubstantiveNewRequest,
  normalizeStanceResult,
  offlineStanceHeuristic,
  type PendingDialogueOffer
} from "../src/lib/agent/dialogue-offer";

// —— Offline heuristic (only used when classifier model is unavailable) ——
assert.equal(offlineStanceHeuristic("yes pls").stance, "accept");
assert.equal(offlineStanceHeuristic("Yes, please!").stance, "accept");
assert.equal(offlineStanceHeuristic("OK").stance, "accept");
assert.equal(offlineStanceHeuristic("no").stance, "decline");
assert.equal(offlineStanceHeuristic("not now").stance, "decline");
assert.equal(offlineStanceHeuristic("never mind").stance, "decline");

const soft = offlineStanceHeuristic("yes but only Awards");
assert.equal(soft.stance, "accept_with_constraint");
assert.ok(soft.constraint && /Awards/i.test(soft.constraint));

// Natural new-topic phrasing should not be forced into yes/no offline
const newTopic = offlineStanceHeuristic("please update my publications list with the new paper");
assert.equal(newTopic.stance, "new_request");

// Full user tasks skip stance LLM (prevents agent run timeouts)
assert.equal(
  looksLikeSubstantiveNewRequest("can you check my cv. it seems my sections are not in professional order"),
  true
);
assert.equal(looksLikeSubstantiveNewRequest("yes pls"), false);
assert.equal(looksLikeSubstantiveNewRequest("sounds good"), false);

// Natural accept phrasing without model → unclear (keep offer) rather than wrong new_request
assert.equal(offlineStanceHeuristic("sounds perfect, let's do that").stance, "unclear");

// Ambiguous short
assert.equal(offlineStanceHeuristic("hmm").stance, "unclear");
assert.equal(offlineStanceHeuristic("maybe").stance, "unclear");

// —— normalizeStanceResult confidence floor ——
const low = normalizeStanceResult(
  { stance: "accept", confidence: 0.4, constraint: null, reason: "guess" },
  { source: "classifier", provider: "test", model: "test", latencyMs: 1 }
);
assert.equal(low.stance, "unclear");

const constrained = normalizeStanceResult(
  { stance: "accept", confidence: 0.9, constraint: "only Education", reason: "ok" },
  { source: "classifier", provider: "test", model: "test", latencyMs: 1 }
);
assert.equal(constrained.stance, "accept_with_constraint");
assert.equal(constrained.constraint, "only Education");

const assistant = `Your current visible sections mix research outputs before service items.

A more professional order for your CV would be:
1. Summary
2. Education
3. Academic Appointments

Would you like me to make these sections visible and guide you to reorder them in the CV Editor?

Shall I activate hidden sections with content (Academic Appointments, Research Experience, Awards, etc) and recommend the new order so you can rearrange them in the editor?`;

const offer = extractDialogueOfferFromAssistant({
  assistantMessage: assistant,
  messageId: "msg-1",
  primaryIntent: "cv_document"
});
assert.ok(offer, "Should detect next-step offer from assistant text");
assert.equal(offer!.jobType, "cv_document");
assert.ok(
  offer!.kind === "unhide_and_reorder_sections" || offer!.kind === "reorder_sections" || offer!.kind === "unhide_sections"
);
assert.equal(offer!.status, "open");
assert.equal(isOfferExpired(offer!), false);

const expired: PendingDialogueOffer = {
  ...offer!,
  expiresAt: new Date(Date.now() - 1000).toISOString()
};
assert.equal(isOfferExpired(expired), true);

const closed: PendingDialogueOffer = { ...offer!, status: "accepted" };
assert.equal(isOfferExpired(closed), true);

const plan = continuationPlanFromOffer(offer!, { confidence: 0.95 });
assert.equal(plan.type, "cv_document");
assert.ok(plan.confidence >= 0.9);

const continued = buildContinuationUserMessage(offer!, "sounds perfect, let's do that");
assert.ok(continued.includes("accepted"));
assert.ok(continued.includes(offer!.actionSummary.slice(0, 20)));
assert.ok(!continued.includes("User constraint:"));

const constrainedMsg = buildContinuationUserMessage(offer!, "yes but only Awards", "only Awards");
assert.ok(/constraint/i.test(constrainedMsg));
assert.ok(constrainedMsg.includes("Awards"));

// Pure approval-button copy should not open a typed-yes offer
const noOffer = extractDialogueOfferFromAssistant({
  assistantMessage: "I drafted this CV update. Review it below and click Approve CV update to apply it.",
  primaryIntent: "profile_update"
});
assert.equal(noOffer, null);

const tooShort = extractDialogueOfferFromAssistant({
  assistantMessage: "Done.",
  primaryIntent: "general"
});
assert.equal(tooShort, null);

const pdfOffer = extractDialogueOfferFromAssistant({
  assistantMessage:
    "Your CV looks complete. Would you like me to compile the PDF so you can download the latest version?",
  primaryIntent: "cv_review"
});
assert.ok(pdfOffer);
assert.equal(pdfOffer!.jobType, "pdf_render");

const siteOffer = extractDialogueOfferFromAssistant({
  assistantMessage: "I can refresh your academic website from the latest CV. Shall I update the website now?",
  primaryIntent: "general"
});
assert.ok(siteOffer);
assert.equal(siteOffer!.jobType, "website_update");

console.log("Dialogue offer stance tests passed.");
