import assert from "node:assert/strict";
import {
  academicFieldKey,
  normalizeAcademicField,
  normalizeAcademicFieldGroup,
  normalizeCountryCode
} from "../src/lib/academic-taxonomy";
import { cappedActiveDelta, qualifiesAsFinishedCv } from "../src/lib/cv-time-to-value";

assert.equal(normalizeCountryCode(" lk "), "LK");
assert.equal(normalizeCountryCode("unknown"), "");
assert.equal(normalizeAcademicFieldGroup("social_sciences"), "social_sciences");
assert.equal(normalizeAcademicFieldGroup("made_up"), "");
assert.equal(normalizeAcademicField("  Science   Education  "), "Science Education");
assert.equal(
  academicFieldKey("interdisciplinary_other", "Science & Technology Studies"),
  "interdisciplinary_other:science-technology-studies"
);
assert.equal(academicFieldKey("", "Science & Technology Studies"), "");

const startedAt = new Date("2026-07-29T00:00:00.000Z");
assert.equal(cappedActiveDelta(startedAt, new Date("2026-07-29T00:00:30.000Z")), 30);
assert.equal(cappedActiveDelta(startedAt, new Date("2026-07-29T00:05:00.000Z")), 45);
assert.equal(cappedActiveDelta(startedAt, new Date("2026-07-28T23:59:00.000Z")), 0);

assert.equal(
  qualifiesAsFinishedCv({ displayName: "Dr. John Doe", headline: "Professor", affiliation: "", bio: "" }, 1),
  false
);
assert.equal(
  qualifiesAsFinishedCv({ displayName: "Asha Perera", headline: "", affiliation: "", bio: "" }, 0),
  false
);
assert.equal(
  qualifiesAsFinishedCv({ displayName: "Asha Perera", headline: "Research Fellow", affiliation: "", bio: "" }, 0),
  true
);
assert.equal(
  qualifiesAsFinishedCv({ displayName: "Asha Perera", headline: "", affiliation: "", bio: "" }, 1),
  true
);

console.log("public impact foundations: ok");
