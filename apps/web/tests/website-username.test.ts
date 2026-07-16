import assert from "node:assert/strict";
import { normalizeWebsiteUsername, validateWebsiteUsernameFormat } from "../src/lib/website/username";
import { assessWebsiteReadiness } from "../src/lib/website/readiness";
import { defaultFieldVisibility } from "../src/lib/website/defaults";

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

import { resolvePublicPage, pageIsEnabled } from "../src/lib/website/public-site";
assert.equal(resolvePublicPage(undefined), "home");
assert.equal(resolvePublicPage(["publications"]), "publications");
assert.equal(resolvePublicPage(["unknown"]), "not_found");
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

console.log("Website username/readiness tests passed.");
