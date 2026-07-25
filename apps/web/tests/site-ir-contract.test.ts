/**
 * Site IR structure contracts (recommended path before visual screenshots).
 * Fixtures: sparse (min CV), developing, rich.
 */
import assert from "node:assert/strict";
import { composeAcademicWebsite } from "../src/lib/website/composition-engine";
import { defaultEnabledPages, defaultSectionVisibility } from "../src/lib/website/defaults";
import { buildSiteIR, SITE_IR_VERSION, SITE_POLICY_VERSION, DEFAULT_SITE_THEME_ID } from "../src/lib/website/site-engine";
import type { WebsiteSectionEntry } from "../src/lib/website/composition-types";

const baseCompose = {
  narratives: {} as Record<string, string>,
  sectionVisibility: defaultSectionVisibility(),
  enabledPages: defaultEnabledPages(),
  featuredEntryIds: [] as string[],
  contactEnabled: true
};

function entry(id: string, sectionKey: string, data: Record<string, string>): WebsiteSectionEntry {
  return { id, sectionKey, data };
}

function buildIr(entries: WebsiteSectionEntry[], enabledPages = defaultEnabledPages()) {
  const composition = composeAcademicWebsite({
    ...baseCompose,
    enabledPages,
    entries
  });
  const sections: Record<string, WebsiteSectionEntry[]> = {};
  for (const e of entries) {
    (sections[e.sectionKey] ||= []).push(e);
  }
  const pages = composition.navigation.map((key) => ({
    key,
    label: key === "home" ? "Home" : key[0].toUpperCase() + key.slice(1),
    href: key === "home" ? "/" : `/${key}`
  }));
  return buildSiteIR({
    username: "demo",
    publicUrl: "https://demo.cvscholar.com",
    status: "draft",
    identity: {
      displayName: "Demo Scholar",
      headline: "Lecturer",
      affiliation: "Demo University",
      location: "Colombo",
      email: "demo@example.edu",
      orcidUrl: "",
      googleScholarUrl: "",
      linkedinUrl: "",
      summary: "A short bio for the academic website."
    },
    summary: "A short bio for the academic website.",
    sections,
    composition,
    pages,
    content: { contactIntro: "Get in touch." },
    contactFormEnabled: true,
    cvDownloadUrl: "",
    showPlatformBranding: true,
    searchIndexingEnabled: true,
    seo: { title: "Demo", description: "Demo site" }
  });
}

// —— Sparse: single thin section (not enough for a category page) ——
const sparse = buildIr([
  entry("e1", "education", { degree: "MBA", institution: "UoC", year: "2020" })
]);
assert.equal(sparse.irVersion, SITE_IR_VERSION);
assert.equal(sparse.policyVersion, SITE_POLICY_VERSION);
assert.equal(sparse.themeId, DEFAULT_SITE_THEME_ID);
assert.equal(sparse.mode, "sparse");
assert.deepEqual(
  sparse.chrome.nav.map((n) => n.key),
  ["home", "contact"]
);
assert.ok(sparse.routes.some((r) => r.key === "home"));
assert.ok(sparse.routes.some((r) => r.key === "contact"));
assert.ok(!sparse.routes.some((r) => r.key === "research"));
const sparseHome = sparse.routes.find((r) => r.key === "home")!;
assert.ok(sparseHome.blocks.some((b) => b.type === "identity_hero"));
assert.ok(sparseHome.blocks.some((b) => b.type === "section_module"));
assert.ok(sparseHome.blocks.some((b) => b.type === "sparse_contact_cta"));

// —— Hide composition: user disables research even with pubs ——
const pubs = [1, 2, 3, 4].map((i) =>
  entry(`p${i}`, "publications", { title: `Paper ${i}`, year: String(2020 + i), authors: "A Author", venue: "Journal" })
);
const hidden = buildIr(pubs, { ...defaultEnabledPages(), research: false });
assert.ok(!hidden.chrome.nav.some((n) => n.key === "research"));
// Content should still be usable (merged to home)
const hiddenHome = hidden.routes.find((r) => r.key === "home")!;
assert.ok(
  hiddenHome.blocks.some((b) => b.type === "section_module" || b.type === "highlight_list" || b.type === "metric_band")
);

// —— Rich-ish multipage ——
const rich = buildIr([
  entry("ri1", "research_interests", { interest: "AI", description: "Governance and policy for machine learning systems in public institutions worldwide." }),
  entry("proj1", "projects", { title: "Lab project", role: "PI", years: "2024-present" }),
  entry("ap1", "academic_appointments", { title: "Professor", institution: "Uni", years: "2020-present" }),
  entry("ed1", "education", { degree: "PhD", institution: "Uni", year: "2018" }),
  entry("svc1", "academic_service", { role: "Chair", organization: "Committee", years: "2023-present" }),
  entry("aw1", "awards", { title: "Award", issuer: "Org", year: "2024" })
]);
assert.ok(["developing", "rich"].includes(rich.mode));
assert.ok(rich.chrome.nav.includes(rich.chrome.nav.find((n) => n.key === "home")!));
// Every nav key must have a matching route (no dead links)
for (const nav of rich.chrome.nav) {
  assert.ok(
    rich.routes.some((r) => r.key === nav.key),
    `dead nav: ${nav.key}`
  );
}

// —— Highlights prefer most recent ——
const ordered = buildIr([
  entry("old", "projects", { title: "Old", role: "Lead", years: "2018-2019" }),
  entry("new", "projects", { title: "New", role: "PI", years: "2024-present" }),
  entry("pub", "publications", { title: "Paper", year: "2026", venue: "J" })
]);
const hl = ordered.routes
  .find((r) => r.key === "home")!
  .blocks.find((b) => b.type === "highlight_list");
assert.ok(hl && hl.type === "highlight_list");
if (hl && hl.type === "highlight_list") {
  assert.equal(hl.props.items[0]?.title, "New");
}

// —— Closed block set: every block has a known type ——
const allowed = new Set([
  "identity_hero",
  "details_panel",
  "metric_band",
  "highlight_list",
  "section_module",
  "sparse_contact_cta",
  "contact_page",
  "legal_doc"
]);
for (const route of [...sparse.routes, ...rich.routes]) {
  for (const block of route.blocks) {
    assert.ok(allowed.has(block.type), `unknown block ${block.type}`);
  }
}

console.log("Site IR contract tests passed.");
