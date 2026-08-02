import assert from "node:assert/strict";
import { normalizeWebsiteUsername, validateWebsiteUsernameFormat } from "../src/lib/website/username";
import { assessWebsiteReadiness } from "../src/lib/website/readiness";
import { defaultFieldVisibility } from "../src/lib/website/defaults";
import "./website-composition.test";

assert.equal(normalizeWebsiteUsername(" Upanith L "), "upanith-l");
assert.equal(normalizeWebsiteUsername("Dr__John"), "dr-john");
assert.equal(validateWebsiteUsernameFormat("admin").valid, false);
assert.equal(validateWebsiteUsernameFormat("admin").reason, "reserved");
assert.equal(validateWebsiteUsernameFormat("a").valid, false);
assert.equal(validateWebsiteUsernameFormat("upanith-research").valid, true);

const ready = assessWebsiteReadiness(
  {
    displayName: "Dr A",
    headline: "Lecturer",
    affiliation: "University",
    bio: "Bio",
    researchSummary: "",
    email: "a@example.com",
    orcidUrl: "",
    googleScholarUrl: ""
  },
  { publications: 1, education: 1, experience: 0, teaching: 0 }
);
assert.equal(ready.canPublish, true);
assert.ok(ready.score >= 50);

assert.equal(defaultFieldVisibility().showEmail, false);
assert.equal(defaultFieldVisibility().showPhone, false);

import { legacyPublicPageTarget, resolvePublicPage, pageIsEnabled } from "../src/lib/website/public-site";
import { sanitizePublicWebsiteModel } from "../src/lib/website/security";
import { buildJsonLd, buildPublicPageMetadata, absoluteUrl } from "../src/lib/website/seo";
import {
  websitePublicOrigin,
  websitePublicPageUrl,
  extractScholarUsernameFromHost,
  isPlatformWebsiteHost
} from "../src/lib/website/public-url";
import { classifyAgentIntent, allowedToolsForIntent } from "../src/lib/agent/policy";

assert.equal(resolvePublicPage(undefined), "home");
assert.equal(resolvePublicPage(["research"]), "research");
assert.equal(resolvePublicPage(["publications"]), "not_found");
assert.equal(legacyPublicPageTarget(["publications"]), "research");
assert.equal(legacyPublicPageTarget(["teaching"]), "journey");
assert.equal(resolvePublicPage(["privacy"]), "privacy");
assert.equal(resolvePublicPage(["terms"]), "terms");
assert.equal(resolvePublicPage(["cookies"]), "cookies");
assert.equal(resolvePublicPage(["unknown"]), "not_found");
assert.equal(
  pageIsEnabled(
    {
      pages: [{ key: "home", label: "Home", href: "/" }],
      identity: {} as never,
      summary: "",
      publicUrl: "",
      content: {} as never,
      sections: {},
      contactFormEnabled: true
    } as never,
    "privacy"
  ),
  true
);
assert.equal(
  pageIsEnabled(
    {
      pages: [{ key: "home", label: "Home", href: "/u/test" }],
      identity: {} as never,
      summary: "",
      publicUrl: "",
      content: {} as never,
      sections: {},
      contactFormEnabled: true
    } as never,
    "home"
  ),
  true
);

const sanitized = sanitizePublicWebsiteModel({
  identity: {
    displayName: "Dr Test",
    headline: "Lecturer",
    affiliation: "Uni",
    location: "Hidden City",
    email: "private@example.com",
    orcidUrl: "https://orcid.org/0000",
    googleScholarUrl: "",
    linkedinUrl: "https://linkedin.com/in/test",
    photoUrl: "/api/public-sites/test/photo?v=3"
  },
  summary: "Summary",
  publicUrl: "/u/test",
  content: { research: "", journey: "", contributions: "", contactIntro: "" },
  sections: {
    education: [],
    experience: [],
    teaching: [],
    publications: [{ id: "2", sectionKey: "publications", data: { title: "Paper", private_notes: "secret" } }],
    projects: [],
    grants: [],
    awards: [],
    memberships: [],
    conferences: [],
    supervision: []
  },
  pages: [{ key: "home", label: "Home", href: "/u/test" }],
  contactFormEnabled: true,
  fieldVisibility: {
    showEmail: false,
    showPhone: false,
    showLocation: false,
    showReferences: false,
    showLinkedIn: true,
    showOrcid: true,
    showGoogleScholar: true
  },
  seo: { title: "Dr Test", description: "Academic site" }
} as never);

assert.equal(sanitized.identity.email, "");
assert.equal(sanitized.identity.location, "");
assert.equal(sanitized.sections.publications?.[0]?.data.private_notes, undefined);
assert.equal(sanitized.sections.publications?.[0]?.data.title, "Paper");
assert.ok(sanitized.identity.linkedinUrl.includes("linkedin"));
// Profile photos must survive public sanitization (were previously stripped).
assert.equal(sanitized.identity.photoUrl, "/api/public-sites/test/photo?v=3");

const meta = buildPublicPageMetadata({
  model: sanitized as never,
  username: "test",
  page: "home",
  indexable: true
});
assert.ok(String(meta.title).includes("Dr Test") || String(meta.title).includes("Academic"));
assert.equal((meta.robots as { index?: boolean })?.index, true);
assert.ok(String(meta.alternates?.canonical || "").includes("https://test."));
assert.ok(!String(meta.alternates?.canonical || "").includes("/u/"));

const jsonLd = buildJsonLd(sanitized as never, "test") as {
  "@context"?: string;
  "@graph"?: Array<{ "@type"?: string }>;
};
assert.equal(jsonLd["@context"], "https://schema.org");
assert.ok(Array.isArray(jsonLd["@graph"]) && (jsonLd["@graph"]?.length ?? 0) >= 2);
assert.equal(jsonLd["@graph"]?.[0]?.["@type"], "Person");
assert.equal(jsonLd["@graph"]?.[1]?.["@type"], "ProfilePage");
assert.equal(websitePublicOrigin("upanith"), "https://upanith.cvscholar.com");
assert.equal(websitePublicPageUrl("upanith", "research"), "https://upanith.cvscholar.com/research");
assert.equal(extractScholarUsernameFromHost("upanith.cvscholar.com"), "upanith");
assert.equal(extractScholarUsernameFromHost("rewrite.cvscholar.com"), null);
assert.equal(isPlatformWebsiteHost("rewrite.cvscholar.com"), true);
assert.equal(absoluteUrl("/u/test/about"), "https://test.cvscholar.com/about");

assert.equal(classifyAgentIntent("is my academic website ready?"), "website_read");
assert.equal(classifyAgentIntent("publish website now"), "website_publish");
assert.equal(classifyAgentIntent("update website headline"), "website_update");
assert.ok(
  allowedToolsForIntent("website_read").includes("get_website_overview"),
  `website_read tools: ${allowedToolsForIntent("website_read").join(",")}`
);
assert.ok(allowedToolsForIntent("website_publish").includes("prepare_website_publish"));
assert.ok(allowedToolsForIntent("website_update").includes("propose_website_update"));

console.log("Website username/readiness/seo/security/agent tests passed.");
