import assert from "node:assert/strict";
import { assessWebsiteReadiness, buildReadinessCounts } from "../src/lib/website/readiness";
import {
  buildHomeHighlights,
  buildHomeMetrics,
  entryRecencyScore
} from "../src/lib/website/home-highlights";

const baseProfile = {
  displayName: "Kasun Perera",
  headline: "Lecturer",
  affiliation: "Sabaragamuwa University",
  bio: "Lecturer in business administration.",
  researchSummary: "",
  email: "kasun@example.edu",
  orcidUrl: "",
  googleScholarUrl: ""
};

const identityOnly = assessWebsiteReadiness(baseProfile, {
  publications: 0,
  education: 0,
  experience: 0,
  teaching: 0,
  bodyEntries: 0
});
assert.equal(identityOnly.canPublish, false);
assert.ok(identityOnly.missingRequired.includes("At least one CV section"));

const minReady = assessWebsiteReadiness(baseProfile, {
  publications: 0,
  education: 2,
  experience: 0,
  teaching: 2,
  bodyEntries: 4
});
assert.equal(minReady.canPublish, true);

const missingName = assessWebsiteReadiness(
  { ...baseProfile, displayName: "" },
  { publications: 1, education: 0, experience: 0, teaching: 0, bodyEntries: 1 }
);
assert.equal(missingName.canPublish, false);

const counts = buildReadinessCounts([
  { sectionKey: "education" },
  { sectionKey: "teaching" },
  { sectionKey: "languages" }
]);
assert.equal(counts.education, 1);
assert.equal(counts.teaching, 1);
assert.equal(counts.bodyEntries, 3);

const sections = {
  projects: [
    { id: "p1", sectionKey: "projects", data: { title: "Old project", years: "2019-2020", role: "Lead" } },
    { id: "p2", sectionKey: "projects", data: { title: "New project", years: "2024-present", role: "PI" } }
  ],
  publications: [
    { id: "pub1", sectionKey: "publications", data: { title: "Older paper", year: "2020", venue: "Journal A" } },
    { id: "pub2", sectionKey: "publications", data: { title: "Newer paper", year: "2026", venue: "Journal B" } }
  ],
  awards: [{ id: "a1", sectionKey: "awards", data: { title: "Award", issuer: "Uni", year: "2025" } }],
  education: [{ id: "e1", sectionKey: "education", data: { degree: "MBA", institution: "UoC", year: "2020" } }]
};

assert.ok(entryRecencyScore(sections.projects[1]) > entryRecencyScore(sections.projects[0]));

const highlights = buildHomeHighlights(sections);
assert.equal(highlights[0]?.title, "New project");
assert.equal(highlights[1]?.title, "Newer paper");
assert.equal(highlights[2]?.title, "Award");

const metrics = buildHomeMetrics(sections);
assert.ok(metrics.some((m) => m.label === "Publications" && m.value === 2));
assert.ok(metrics.some((m) => m.label === "Projects" && m.value === 2));
assert.ok(!metrics.some((m) => m.label === "Teaching"));

const thin = buildHomeHighlights({
  education: sections.education,
  teaching: [{ id: "t1", sectionKey: "teaching", data: { course: "OB", role: "Lecturer", institution: "SUSL", years: "2021-present" } }]
});
assert.equal(thin.length, 2);
assert.equal(thin[0]?.label, "Education");
assert.equal(thin[1]?.label, "Teaching");

console.log("Website readiness + home highlights tests passed.");
