import type { Prisma } from "@/generated/prisma/client";
import { fingerprintImportEntry, normalizeImportComparable } from "@/lib/cv-import-core";
import { getAgentEditorPayload } from "@/lib/cv-agent/context";
import { cleanPersonalPatchData, cleanSectionPatchData, cvAgentPatchSchema, type CvAgentPatch } from "@/lib/cv-agent/schemas";
import { cleanEntryData, ensureProfileEditorData, refreshCompleteness } from "@/lib/profile-editor";
import { personalFields, profileSections, sectionDefinitionByKey } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

type PatchResult = {
  patchType: string;
  status: "applied" | "skipped" | "needs_confirmation" | "conflict" | "invalid";
  message: string;
  warnings: string[];
  approvalRequired?: boolean;
};

export async function applyAgentPatches({
  workspaceId,
  profileId,
  sessionId,
  messageId,
  patches,
  confirmed = false,
  requireApproval = false
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  messageId?: string;
  patches: unknown[];
  confirmed?: boolean;
  requireApproval?: boolean;
}) {
  await ensureProfileEditorData(profileId);
  const parsed = patches.map((patch) => cvAgentPatchSchema.safeParse(patch));
  const validPatches = parsed.flatMap((result) => (result.success ? [result.data] : []));
  const invalidResults: PatchResult[] = parsed.flatMap((result) =>
    result.success
      ? []
      : [
          {
            patchType: "invalid",
            status: "invalid" as const,
            message: "The AI suggested an update that did not match CVScholar fields.",
            warnings: result.error.issues.map((issue) => issue.message)
          }
        ]
  );

  const results = await prisma.$transaction(async (tx) => {
    const appliedResults: PatchResult[] = [];

    for (const patch of validPatches) {
      const result =
        requireApproval && !confirmed && isCvChangingPatch(patch) && !needsMoreInformationBeforeApproval(patch)
          ? buildApprovalResult(patch)
          : await applySinglePatch(tx, profileId, patch, confirmed);
      appliedResults.push(result);
      await tx.cvAgentPatchLog.create({
        data: {
          workspaceId,
          profileId,
          sessionId,
          messageId,
          patchType: patch.type,
          status: result.status,
          patchJson: JSON.parse(JSON.stringify(patch)) as Prisma.InputJsonValue,
          resultJson: JSON.parse(JSON.stringify({ message: result.message })) as Prisma.InputJsonValue,
          warningsJson: result.warnings as Prisma.InputJsonValue,
          requiresConfirmation: result.approvalRequired ?? result.status === "conflict",
          confidence: "confidence" in patch ? patch.confidence : 0,
          appliedAt: result.status === "applied" ? new Date() : null
        }
      });
    }

    for (const result of invalidResults) {
      await tx.cvAgentPatchLog.create({
        data: {
          workspaceId,
          profileId,
          sessionId,
          messageId,
          patchType: result.patchType,
          status: result.status,
          resultJson: JSON.parse(JSON.stringify({ message: result.message })) as Prisma.InputJsonValue,
          warningsJson: result.warnings as Prisma.InputJsonValue
        }
      });
    }

    return [...appliedResults, ...invalidResults];
  });

  const completeness = await refreshCompleteness(profileId);
  const editor = await getAgentEditorPayload(profileId);

  return {
    results,
    completeness,
    editor,
    appliedCount: results.filter((result) => result.status === "applied").length,
    needsConfirmationCount: results.filter((result) => result.status === "needs_confirmation").length,
    conflictCount: results.filter((result) => result.status === "conflict").length,
    skippedCount: results.filter((result) => result.status === "skipped").length
  };
}

function isCvChangingPatch(patch: CvAgentPatch) {
  return patch.type === "update_personal" || patch.type === "add_entry" || patch.type === "update_entry";
}

function buildApprovalResult(patch: CvAgentPatch): PatchResult {
  if (patch.type === "update_personal") {
    return {
      patchType: patch.type,
      status: "needs_confirmation",
      message: "Review and approve this profile update before I apply it to your CV.",
      warnings: [],
      approvalRequired: true
    };
  }

  if (patch.type === "add_entry") {
    const title = sectionDefinitionByKey(patch.sectionKey)?.shortTitle ?? "CV";
    return {
      patchType: patch.type,
      status: "needs_confirmation",
      message: `Review and approve this ${title} entry before I add it to your CV.`,
      warnings: [],
      approvalRequired: true
    };
  }

  return {
    patchType: patch.type,
    status: "needs_confirmation",
    message: "Review and approve this CV entry update before I apply it.",
    warnings: [],
    approvalRequired: true
  };
}

function needsMoreInformationBeforeApproval(patch: CvAgentPatch) {
  if (patch.type !== "add_entry") return false;

  const definition = sectionDefinitionByKey(patch.sectionKey);
  if (!definition) return false;

  const cleanedPartial = cleanSectionPatchData(patch.sectionKey, patch.data);
  const requiredMissing = definition.fields
    .filter((field) => "required" in field && field.required)
    .some((field) => !cleanedPartial[field.name]?.trim());

  if (requiredMissing) return true;

  const fullData = cleanEntryData(patch.sectionKey, cleanedPartial);
  return !Object.values(fullData).some((value) => value.trim());
}

async function applySinglePatch(
  tx: Prisma.TransactionClient,
  profileId: string,
  patch: CvAgentPatch,
  confirmed: boolean
): Promise<PatchResult> {
  if (patch.type === "ask_confirmation") {
    return {
      patchType: patch.type,
      status: "needs_confirmation",
      message: patch.question,
      warnings: patch.options.length > 0 ? [`Options: ${patch.options.join(", ")}`] : [],
      approvalRequired: false
    };
  }

  if (patch.requiresConfirmation && !confirmed) {
    return {
      patchType: patch.type,
      status: "needs_confirmation",
      message: patch.reason || "This change needs your confirmation before I update the CV.",
      warnings: [],
      approvalRequired: true
    };
  }

  if (patch.type === "update_personal") {
    return applyPersonalPatch(tx, profileId, patch.data, confirmed);
  }

  if (patch.type === "add_entry") {
    return applyAddEntryPatch(tx, profileId, patch.sectionKey, patch.data);
  }

  if (patch.type === "update_entry") {
    return applyUpdateEntryPatch(tx, profileId, patch.sectionKey, patch.entryId, patch.data, confirmed);
  }

  return {
    patchType: "unknown",
    status: "invalid",
    message: "Unsupported CV update.",
    warnings: []
  };
}

async function applyPersonalPatch(
  tx: Prisma.TransactionClient,
  profileId: string,
  data: Record<string, string>,
  confirmed: boolean
): Promise<PatchResult> {
  const profile = await tx.academicProfile.findUniqueOrThrow({ where: { id: profileId } });
  const cleaned = cleanPersonalPatchData(data);
  const updates: Record<string, string> = {};
  const conflicts: string[] = [];
  const skipped: string[] = [];

  for (const [key, incoming] of Object.entries(cleaned)) {
    const current = String((profile as unknown as Record<string, unknown>)[key] ?? "").trim();
    const label = personalFields.find((field) => field.name === key)?.label ?? key;

    if (!incoming) continue;
    if (!current || confirmed) {
      updates[key] = incoming;
      continue;
    }
    if (normalizeImportComparable(current) === normalizeImportComparable(incoming)) {
      skipped.push(label);
      continue;
    }
    conflicts.push(label);
  }

  if (conflicts.length > 0 && !confirmed) {
    return {
      patchType: "update_personal",
      status: "conflict",
      message: `I found different existing details for ${conflicts.join(", ")}. I left them unchanged.`,
      warnings: conflicts,
      approvalRequired: true
    };
  }

  if (Object.keys(updates).length === 0) {
    return {
      patchType: "update_personal",
      status: "skipped",
      message: skipped.length > 0 ? "Those profile details are already saved." : "No usable personal details were found.",
      warnings: []
    };
  }

  await tx.academicProfile.update({
    where: { id: profileId },
    data: updates
  });

  return {
    patchType: "update_personal",
    status: "applied",
    message: `I updated ${Object.keys(updates).length} profile field(s).`,
    warnings: []
  };
}

async function applyAddEntryPatch(
  tx: Prisma.TransactionClient,
  profileId: string,
  sectionKey: string,
  data: Record<string, string>
): Promise<PatchResult> {
  const definition = sectionDefinitionByKey(sectionKey);
  if (!definition) {
    return {
      patchType: "add_entry",
      status: "invalid",
      message: "That section is not available in CVScholar.",
      warnings: [sectionKey]
    };
  }

  const cleanedPartial = cleanSectionPatchData(sectionKey, data);
  const requiredMissing = definition.fields
    .filter((field) => "required" in field && field.required)
    .filter((field) => !cleanedPartial[field.name]?.trim())
    .map((field) => field.label);

  if (requiredMissing.length > 0) {
    return {
      patchType: "add_entry",
      status: "needs_confirmation",
      message: `I need ${requiredMissing.join(", ")} before adding this ${definition.shortTitle} entry.`,
      warnings: requiredMissing,
      approvalRequired: false
    };
  }

  const fullData = cleanEntryData(sectionKey, cleanedPartial);
  if (!Object.values(fullData).some((value) => value.trim())) {
    return {
      patchType: "add_entry",
      status: "skipped",
      message: "There was no useful entry data to add.",
      warnings: []
    };
  }

  const section =
    (await tx.profileSection.findUnique({
      where: {
        profileId_key: {
          profileId,
          key: sectionKey
        }
      },
      include: { entries: true }
    })) ??
    (await tx.profileSection.create({
      data: {
        profileId,
        key: sectionKey,
        title: definition.title,
        sectionOrder: definition.sectionOrder,
        isVisible: true
      },
      include: { entries: true }
    }));

  if (sectionKey === "declaration" && section.entries.length > 0) {
    const existingEntry = section.entries[0];
    const nextData = cleanEntryData(sectionKey, {
      ...(existingEntry.data as Record<string, unknown>),
      ...cleanedPartial
    });

    await tx.profileSectionEntry.update({
      where: { id: existingEntry.id },
      data: {
        data: nextData as Prisma.InputJsonObject,
        source: "ai_chat"
      }
    });

    if (!section.isVisible) {
      await tx.profileSection.update({
        where: { id: section.id },
        data: { isVisible: true }
      });
    }

    return {
      patchType: "add_entry",
      status: "applied",
      message: "I updated the Declaration entry.",
      warnings: []
    };
  }

  const existingFingerprints = new Set(
    section.entries.map((entry) => fingerprintImportEntry(sectionKey, entry.data as Record<string, unknown>))
  );
  const fingerprint = fingerprintImportEntry(sectionKey, fullData);

  if (existingFingerprints.has(fingerprint)) {
    return {
      patchType: "add_entry",
      status: "skipped",
      message: `${definition.shortTitle} already has this entry, so I did not add a duplicate.`,
      warnings: []
    };
  }

  if (!section.isVisible) {
    await tx.profileSection.update({
      where: { id: section.id },
      data: { isVisible: true }
    });
  }

  await tx.profileSectionEntry.create({
    data: {
      profileId,
      sectionId: section.id,
      sectionKey,
      entryOrder: section.entries.length + 1,
      data: fullData as Prisma.InputJsonObject,
      source: "ai_chat"
    }
  });

  return {
    patchType: "add_entry",
    status: "applied",
    message: `I added one ${definition.shortTitle} entry.`,
    warnings: []
  };
}

async function applyUpdateEntryPatch(
  tx: Prisma.TransactionClient,
  profileId: string,
  sectionKey: string,
  entryId: string,
  data: Record<string, string>,
  confirmed: boolean
): Promise<PatchResult> {
  if (!confirmed) {
    return {
      patchType: "update_entry",
      status: "needs_confirmation",
      message: "Updating an existing CV entry needs confirmation.",
      warnings: [],
      approvalRequired: true
    };
  }

  const entry = await tx.profileSectionEntry.findFirst({
    where: {
      id: entryId,
      profileId,
      sectionKey
    }
  });

  if (!entry) {
    return {
      patchType: "update_entry",
      status: "invalid",
      message: "I could not find that CV entry.",
      warnings: []
    };
  }

  const nextData = cleanEntryData(sectionKey, {
    ...(entry.data as Record<string, unknown>),
    ...cleanSectionPatchData(sectionKey, data)
  });

  await tx.profileSectionEntry.update({
    where: { id: entryId },
    data: {
      data: nextData as Prisma.InputJsonObject,
      source: "ai_chat"
    }
  });

  return {
    patchType: "update_entry",
    status: "applied",
    message: "I updated the confirmed CV entry.",
    warnings: []
  };
}

export function summarizePatchResults(results: PatchResult[]) {
  const applied = results.filter((result) => result.status === "applied");
  const needsConfirmation = results.filter((result) => result.status === "needs_confirmation");
  const conflicts = results.filter((result) => result.status === "conflict");

  return {
    applied: applied.length,
    needsConfirmation: needsConfirmation.length,
    approvalRequired: results.filter((result) => result.approvalRequired).length,
    conflicts: conflicts.length,
    skipped: results.filter((result) => result.status === "skipped").length,
    messages: results.map((result) => result.message).filter(Boolean).slice(0, 6)
  };
}

export function deriveCompletedSections(editor: Awaited<ReturnType<typeof getAgentEditorPayload>>) {
  const completed = new Set<string>();
  if (editor.profile.displayName || editor.profile.email || editor.profile.bio) {
    completed.add("personal");
  }

  for (const section of editor.sections) {
    if (section.entries.some((entry) => Object.values(entry.data).some((value) => typeof value === "string" && value.trim()))) {
      completed.add(section.key);
    }
  }

  return [...completed].filter((key) => key === "personal" || profileSections.some((section) => section.key === key));
}
