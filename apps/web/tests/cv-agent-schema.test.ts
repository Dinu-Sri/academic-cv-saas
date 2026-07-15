import assert from "node:assert/strict";
import { allowedToolsForJobs, buildPlannerEarlyResponse, planAgentJobs } from "../src/lib/agent/planner";
import { allowedToolsForIntent, classifyAgentIntent } from "../src/lib/agent/policy";
import { cleanPersonalPatchData, cleanSectionPatchData, cvAgentPatchSchema, cvAgentResponseSchema } from "../src/lib/cv-agent/schemas";

const personal = cleanPersonalPatchData({
  displayName: "Dr Maya Senaratne",
  fakeMetric: "Top 1%",
  email: "maya@example.com"
});
assert.deepEqual(personal, {
  displayName: "Dr Maya Senaratne",
  email: "maya@example.com"
});

const education = cleanSectionPatchData("education", {
  degree: "PhD",
  institution: "Wayamba University of Sri Lanka",
  invented_field: "Should not pass"
});
assert.deepEqual(education, {
  degree: "PhD",
  institution: "Wayamba University of Sri Lanka"
});

assert.equal(
  cvAgentPatchSchema.safeParse({
    type: "add_entry",
    sectionKey: "unknown_section",
    data: { title: "No" }
  }).success,
  false
);

const response = cvAgentResponseSchema.parse({
  assistantMessage: "I added your basic information. Next, let us add education.",
  patches: [
    {
      type: "update_personal",
      data: {
        displayName: "Dr Maya Senaratne"
      },
      confidence: 0.9
    }
  ],
  questions: [],
  warnings: [],
  memoryUpdate: {
    completedSections: ["personal"],
    nextBestSection: "education"
  }
});

assert.equal(response.patches[0].type, "update_personal");
assert.equal(response.memoryUpdate.nextBestSection, "education");

// Executor models often return null for empty optional fields (this caused model_failed in prod).
const nullishResponse = cvAgentResponseSchema.parse({
  assistantMessage: "You can update your profile, review your CV, and generate a PDF.",
  patches: null,
  questions: null,
  warnings: null,
  memoryUpdate: null
});
assert.equal(nullishResponse.patches.length, 0);
assert.deepEqual(nullishResponse.memoryUpdate, {});
assert.match(nullishResponse.assistantMessage, /profile/i);

const reviewIntent = classifyAgentIntent("what do you think about my cv? anything to improve?");
assert.equal(reviewIntent, "cv_review");
assert.equal(allowedToolsForIntent(reviewIntent).includes("review_cv"), true);
assert.equal(allowedToolsForIntent(reviewIntent).includes("retrieve_knowledge"), true);

const multiJobTools = allowedToolsForJobs(["profile_update", "pdf_render"]);
assert.equal(multiJobTools.includes("propose_entry_add"), true);
assert.equal(multiJobTools.includes("start_pdf_render_job"), true);

const outOfScopeEarly = buildPlannerEarlyResponse({
  jobs: [{ type: "out_of_scope", summary: "Weather", confidence: 0.95, order: 1 }],
  executableJobs: [],
  primaryIntent: "out_of_scope",
  allowedTools: ["get_profile_overview"],
  needsClarification: false,
  clarifyingQuestion: null,
  source: "planner",
  provider: "test",
  model: "test",
  latencyMs: 1
});
assert.ok(outOfScopeEarly);
assert.match(outOfScopeEarly!.assistantMessage, /academic profile and CV/i);

async function testPlannerFallback() {
  // Planner disabled → keyword fallback path (no API call)
  process.env.CVSCHOLAR_AGENT_PLANNER_ENABLED = "0";
  const fallbackPlan = await planAgentJobs({ message: "Add my PhD from Oxford in 2019" });
  assert.equal(fallbackPlan.source, "fallback");
  assert.equal(fallbackPlan.primaryIntent, "profile_update");
  assert.equal(fallbackPlan.executableJobs[0]?.type, "profile_update");
}

testPlannerFallback()
  .then(() => {
    console.log("CV agent schema tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
