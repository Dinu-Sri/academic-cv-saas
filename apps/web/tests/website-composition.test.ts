import assert from "node:assert/strict";
import { composeAcademicWebsite } from "../src/lib/website/composition-engine";
import { defaultEnabledPages, defaultSectionVisibility } from "../src/lib/website/defaults";

const base = {
  narratives: {},
  sectionVisibility: defaultSectionVisibility(),
  enabledPages: defaultEnabledPages(),
  featuredEntryIds: [],
  contactEnabled: true
};

const entry = (id: string, sectionKey: string, title: string) => ({
  id,
  sectionKey,
  data: { title, year: "2026" }
});

const sparse = composeAcademicWebsite({
  ...base,
  entries: [entry("edu-1", "education", "MSc"), entry("project-1", "projects", "Dissertation project")]
});
assert.equal(sparse.mode, "sparse");
assert.deepEqual(sparse.pages, []);
assert.deepEqual(sparse.navigation, ["home", "contact"]);
assert.deepEqual(sparse.homeModules.map((module) => module.key).sort(), ["education", "projects"]);

const publicationHeavy = composeAcademicWebsite({
  ...base,
  entries: [1, 2, 3, 4].map((index) => entry(`pub-${index}`, "publications", `Paper ${index}`))
});
assert.equal(publicationHeavy.categories.research.reason, "qualified");
assert.ok(publicationHeavy.pages.some((page) => page.key === "research"));
assert.ok(!publicationHeavy.navigation.includes("journey"));

const teachingFocused = composeAcademicWebsite({
  ...base,
  entries: [
    entry("teach-1", "teaching", "Research Methods"),
    entry("teach-2", "teaching", "Academic Writing"),
    entry("supervision-1", "supervision", "MSc supervision"),
    entry("cert-1", "certifications", "Teaching certificate")
  ]
});
assert.equal(teachingFocused.categories.journey.reason, "qualified");
assert.ok(teachingFocused.navigation.includes("journey"));
assert.ok(!teachingFocused.navigation.includes("research"));

const contributionMerged = composeAcademicWebsite({
  ...base,
  entries: [
    entry("appointment-1", "academic_appointments", "Senior Lecturer"),
    entry("education-1", "education", "PhD"),
    entry("membership-1", "memberships", "Professional society")
  ]
});
assert.equal(contributionMerged.categories.contributions.reason, "merged_into_journey");
assert.ok(contributionMerged.categories.journey.modules.some((module) => module.key === "memberships"));

const rich = composeAcademicWebsite({
  ...base,
  entries: [
    entry("research-1", "research_interests", "AI governance"),
    entry("project-1", "projects", "Policy observatory"),
    entry("appointment-1", "academic_appointments", "Professor"),
    entry("education-1", "education", "PhD"),
    entry("service-1", "academic_service", "Faculty senate"),
    entry("award-1", "awards", "Research award")
  ]
});
assert.equal(rich.mode, "rich");
assert.deepEqual(rich.pages.map((page) => page.key), ["research", "journey", "contributions"]);

const hiddenResearch = composeAcademicWebsite({
  ...base,
  enabledPages: { ...defaultEnabledPages(), research: false },
  entries: [1, 2, 3, 4].map((index) => entry(`pub-${index}`, "publications", `Paper ${index}`))
});
assert.equal(hiddenResearch.categories.research.reason, "hidden_by_user");
assert.ok(!hiddenResearch.navigation.includes("research"));
assert.ok(hiddenResearch.homeModules.some((module) => module.key === "publications"));

const blankEntries = composeAcademicWebsite({
  ...base,
  entries: [{ id: "blank", sectionKey: "publications", data: { title: "   ", year: "" } }]
});
assert.equal(blankEntries.categories.research.reason, "empty");
assert.deepEqual(blankEntries.navigation, ["home", "contact"]);

console.log("Website adaptive composition tests passed.");
