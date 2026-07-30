import assert from "node:assert/strict";
import { buildClassicLatex } from "../src/lib/latex";

const section = (key: string, title: string, data: Record<string, string>) => ({
  key,
  title,
  entries: [{ id: `${key}-1`, summary: title, data }]
});

const latex = buildClassicLatex({
  profile: {
    id: "profile-1",
    workspaceId: "workspace-1",
    displayName: "Dr. Ada Scholar",
    headline: "Researcher",
    affiliation: "Example University",
    location: "Colombo",
    email: "ada@example.edu",
    websiteUrl: "",
    orcidUrl: "",
    linkedinUrl: "",
    bio: "This legacy profile value must not be rendered outside the ordered Bio section.",
    researchSummary: ""
  },
  sections: [
    section("references", "References", { name: "Professor Reference", contact: "reference@example.edu" }),
    section("bio", "Short Bio", { bio: "Ordered academic biography." }),
    section("education", "Education", { degree: "PhD", institution: "Example University" }),
    section("publications", "Publications", { title: "A useful paper", authors: "A. Scholar", year: "2026" }),
    section("declaration", "Declaration", { statement: "I declare that this CV is accurate." })
  ]
});

const markers = [
  "\\cvsection{References}",
  "\\cvsection{Summary}",
  "\\cvsection{Education}",
  "\\cvsection{Publications}",
  "I declare that this CV is accurate."
];
assert.ok(!latex.includes("\\cvsection{Short Bio}"), "PDF must not use the non-academic 'Short Bio' heading.");
const positions = markers.map((marker) => latex.indexOf(marker));

assert.ok(positions.every((position) => position >= 0), "Every user-selected section should render.");
assert.deepEqual([...positions].sort((a, b) => a - b), positions, "LaTeX must preserve the saved editor order.");
assert.equal((latex.match(/Ordered academic biography\./g) ?? []).length, 1, "Bio should render once in its ordered section.");
assert.ok(!latex.includes("This legacy profile value"), "The renderer must not prepend profile.bio outside the ordered section list.");

console.log("CV section-order tests passed.");
