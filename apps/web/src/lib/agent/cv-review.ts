import type { Prisma } from "@/generated/prisma/client";
import type { AgentEditorPayload } from "@/lib/cv-agent/context";
import { prisma } from "@/lib/prisma";

export type CvReviewResult = {
  summary: string;
  strengths: string[];
  gaps: string[];
  nextActions: string[];
  evidenceRefs: string[];
  document?: {
    id: string;
    title: string;
    templateKey: string;
    updatedAt: string;
  } | null;
};

export async function reviewCurrentCv(profileId: string, editor: AgentEditorPayload): Promise<CvReviewResult> {
  const document = await prisma.cvDocument.findFirst({
    where: { profileId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      templateKey: true,
      visibleSectionKeys: true,
      updatedAt: true,
      renderError: true,
      pdfPath: true,
      previewHtml: true
    }
  });
  const visibleKeys = visibleSectionKeys(document?.visibleSectionKeys);
  const visibleSections = editor.sections.filter((section) => visibleKeys.length === 0 || visibleKeys.includes(section.key));
  const strengths: string[] = [];
  const gaps: string[] = [];
  const nextActions: string[] = [];
  const evidenceRefs: string[] = [];

  if (editor.profile.displayName || editor.profile.headline || editor.profile.affiliation) {
    strengths.push("Your CV has a clear identity block with saved profile details.");
    evidenceRefs.push("profile.personal");
  } else {
    gaps.push("The top profile identity is still thin: add your name, academic title/headline, and affiliation.");
    nextActions.push("Complete the personal details section before sharing the CV.");
  }

  if (editor.profile.researchSummary || editor.profile.bio) {
    strengths.push("You already have narrative material that can support a stronger academic summary.");
    evidenceRefs.push("profile.bio_or_research_summary");
  } else {
    gaps.push("A short research summary or academic bio is missing, so evaluators may not quickly see your scholarly focus.");
    nextActions.push("Add a 3-5 sentence research summary with field, methods, contribution, and current direction.");
  }

  for (const section of visibleSections) {
    if (section.entries.length > 0) {
      evidenceRefs.push(`section.${section.key}`);
    }
  }

  sectionCheck(visibleSections, "education", "Education is present, which anchors your academic background.", "Education is missing or hidden.", strengths, gaps, nextActions);
  sectionCheck(visibleSections, "publications", "Publications/research outputs are represented.", "Publications are missing or hidden; this is a major gap for most academic CVs.", strengths, gaps, nextActions);
  sectionCheck(visibleSections, "experience", "Experience/appointments are included.", "Appointments or professional experience are missing.", strengths, gaps, nextActions);
  sectionCheck(visibleSections, "teaching", "Teaching evidence is included.", "Teaching experience is missing; add it if you are applying to academic roles with teaching expectations.", strengths, gaps, nextActions);
  sectionCheck(visibleSections, "awards", "Awards or honors are visible.", "Awards, grants, or honors are not visible; add any verified items you have.", strengths, gaps, nextActions);
  sectionCheck(visibleSections, "grants", "Grants or fellowships are represented.", "Grants/fellowships are missing; add verified funding if relevant.", strengths, gaps, nextActions);

  // Classic academic structure guidance (Penn / faculty search norms).
  const supervision = visibleSections.find((section) => section.key === "supervision");
  if (supervision && supervision.isVisible && supervision.entries.length > 0) {
    const weakSupervision = supervision.entries.some((entry) => {
      const data = entry.data || {};
      return !data.student_name && !data.name && !data.thesis_title && !data.thesis;
    });
    if (weakSupervision) {
      gaps.push("Some supervision entries look thin (missing student name or thesis topic).");
      nextActions.push("For each supervisee, add student name, degree, thesis/topic, your role, and status.");
    } else {
      strengths.push("Supervision entries include useful academic detail.");
    }
  }

  if (document?.templateKey === "classic" || !document?.templateKey) {
    nextActions.push(
      "For Classic PDF, focus on complete verified sections rather than visual redesign; the production Classic layout already uses a single-column academic format with page numbers and print-safe contrast."
    );
  }

  const sparseSections = visibleSections.filter((section) => section.entries.length === 1).slice(0, 3);
  for (const section of sparseSections) {
    nextActions.push(`Expand ${section.title} if you have more verified entries or stronger evidence.`);
  }

  if (!document) {
    gaps.push("No managed CV document was found yet, so I reviewed the saved profile rather than a generated CV file.");
    nextActions.push("Create or refresh a managed CV document after filling the profile.");
  } else {
    evidenceRefs.push(`cv_document.${document.id}`);
    if (document.renderError) {
      gaps.push("The latest CV document has a render error, so its PDF may not reflect the saved profile cleanly.");
      nextActions.push("Regenerate the PDF preview and fix any render errors before sending it.");
    } else if (document.pdfPath) {
      strengths.push("The latest managed CV has a generated PDF.");
    } else if (document.previewHtml) {
      strengths.push("The latest managed CV has a preview snapshot ready for review.");
    }
  }

  const completion = editor.profile.completeness;
  const summary =
    completion >= 75
      ? "Overall, your CV looks structurally usable, but it can still be strengthened with more evidence and targeting."
      : completion >= 45
        ? "Overall, your CV has a workable foundation, but it still needs more complete academic evidence before it is strong."
        : "Overall, your CV is still early-stage. It needs core academic sections and a clearer scholarly story before you rely on it.";

  return {
    summary,
    strengths: unique(strengths).slice(0, 5),
    gaps: unique(gaps).slice(0, 6),
    nextActions: unique(nextActions).slice(0, 7),
    evidenceRefs: unique(evidenceRefs),
    document: document
      ? {
          id: document.id,
          title: document.title,
          templateKey: document.templateKey,
          updatedAt: document.updatedAt.toISOString()
        }
      : null
  };
}

export function formatCvReview(result: CvReviewResult) {
  const lines = [result.summary];
  if (result.strengths.length > 0) {
    lines.push(`Strengths: ${result.strengths.join(" ")}`);
  }
  if (result.gaps.length > 0) {
    lines.push(`Gaps to improve: ${result.gaps.join(" ")}`);
  }
  if (result.nextActions.length > 0) {
    lines.push(`Best next steps: ${result.nextActions.slice(0, 4).join(" ")}`);
  }
  lines.push("I only used your saved CV/profile data and treated unsupported points as suggestions, not facts.");
  return lines.join("\n\n");
}

function sectionCheck(
  sections: AgentEditorPayload["sections"],
  key: string,
  strength: string,
  gap: string,
  strengths: string[],
  gaps: string[],
  nextActions: string[]
) {
  const section = sections.find((item) => item.key === key);
  if (section && section.isVisible && section.entries.length > 0) {
    strengths.push(strength);
    return;
  }

  gaps.push(gap);
  nextActions.push(`Add verified ${key.replace(/_/g, " ")} details if relevant to your target role.`);
}

function visibleSectionKeys(value: Prisma.JsonValue | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
