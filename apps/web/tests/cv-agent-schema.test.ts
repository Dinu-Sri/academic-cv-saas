import assert from "node:assert/strict";
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

console.log("CV agent schema tests passed.");
