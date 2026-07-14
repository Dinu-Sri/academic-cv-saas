import type { Prisma } from "@/generated/prisma/client";
import crypto from "node:crypto";
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

type ProposalChangeDraft = {
  patch: CvAgentPatch;
  changeOrder: number;
};

export async function applyAgentPatches({
  workspaceId,
  profileId,
  sessionId,
  messageId,
  patches,
  confirmed = false,
  requireApproval = false,
  proposalId
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  messageId?: string;
  patches: unknown[];
  confirmed?: boolean;
  requireApproval?: boolean;
  proposalId?: string;
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
    const proposalChangeByOrder = new Map<number, string>();
    const proposalDrafts = validPatches
      .map((patch, index) => ({ patch, changeOrder: index }))
      .filter(({ patch }) => requireApproval && !confirmed && isCvChangingPatch(patch) && !needsMoreInformationBeforeApproval(patch));
    const proposal =
      proposalDrafts.length > 0
        ? await tx.agentProposal.create({
            data: {
              workspaceId,
              profileId,
              sessionId,
              messageId,
              status: "pending",
              title: "CV update",
              summary: `Review ${proposalDrafts.length} drafted CV change${proposalDrafts.length === 1 ? "" : "s"}.`,
              source: "cv_agent",
              idempotencyKey: proposalIdempotencyKey(sessionId, messageId, proposalDrafts)
            }
          })
        : null;

    if (proposal) {
      for (const draft of proposalDrafts) {
        const change = await createProposalChange(tx, proposal.id, profileId, draft.patch, draft.changeOrder);
        proposalChangeByOrder.set(draft.changeOrder, change.id);
      }
    }

    for (const [index, patch] of validPatches.entries()) {
      const result =
        requireApproval && !confirmed && isCvChangingPatch(patch) && !needsMoreInformationBeforeApproval(patch)
          ? buildApprovalResult(patch)
          : await applySinglePatch(tx, workspaceId, profileId, patch, confirmed, proposalId);
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
          appliedAt: result.status === "applied" ? new Date() : null,
          proposalId: proposal?.id ?? proposalId,
          proposalChangeId: proposalChangeByOrder.get(index),
          idempotencyKey: patchIdempotencyKey(sessionId, messageId, patch, index, confirmed)
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

    if (confirmed && proposalId && appliedResults.some((result) => result.status === "applied")) {
      await tx.agentProposal.update({
        where: { id: proposalId },
        data: {
          status: "executed",
          decidedAt: new Date(),
          executedAt: new Date()
        }
      });
      await tx.agentProposalChange.updateMany({
        where: { proposalId, status: "pending" },
        data: { status: "applied" }
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
  return patch.type === "update_personal" || patch.type === "add_entry" || patch.type === "update_entry" || patch.type === "delete_entry";
}

function proposalIdempotencyKey(sessionId: string, messageId: string | undefined, drafts: ProposalChangeDraft[]) {
  return stableHash({
    kind: "proposal",
    sessionId,
    messageId,
    patches: drafts.map((draft) => draft.patch)
  });
}

function patchIdempotencyKey(sessionId: string, messageId: string | undefined, patch: CvAgentPatch, index: number, confirmed: boolean) {
  return stableHash({
    kind: confirmed ? "confirmed_patch" : "patch",
    sessionId,
    messageId,
    index,
    patch
  });
}

async function createProposalChange(
  tx: Prisma.TransactionClient,
  proposalId: string,
  profileId: string,
  patch: CvAgentPatch,
  changeOrder: number
) {
  const details = await proposalChangeDetails(tx, profileId, patch);

  return tx.agentProposalChange.create({
    data: {
      proposalId,
      changeOrder,
      patchType: patch.type,
      targetType: details.targetType,
      targetId: details.targetId,
      targetField: details.targetField,
      sectionKey: details.sectionKey,
      expectedVersion: details.expectedVersion,
      beforeHash: stableHash(details.beforeValueJson),
      beforeValueJson: details.beforeValueJson as Prisma.InputJsonValue,
      afterValueJson: details.afterValueJson as Prisma.InputJsonValue,
      patchJson: JSON.parse(JSON.stringify(patch)) as Prisma.InputJsonValue
    }
  });
}

async function proposalChangeDetails(tx: Prisma.TransactionClient, profileId: string, patch: CvAgentPatch) {
  if (patch.type === "update_personal") {
    const profile = await tx.academicProfile.findUniqueOrThrow({ where: { id: profileId } });
    const cleaned = cleanPersonalPatchData(patch.data);
    const beforeValueJson = Object.fromEntries(
      Object.keys(cleaned).map((key) => [key, String((profile as unknown as Record<string, unknown>)[key] ?? "").trim()])
    );

    return {
      targetType: "academic_profile",
      targetId: profileId,
      targetField: Object.keys(cleaned).join(","),
      sectionKey: "personal",
      expectedVersion: profile.version,
      beforeValueJson,
      afterValueJson: cleaned
    };
  }

  if (patch.type === "add_entry") {
    const cleaned = cleanSectionPatchData(patch.sectionKey, patch.data);
    const section = await tx.profileSection.findUnique({
      where: {
        profileId_key: {
          profileId,
          key: patch.sectionKey
        }
      },
      include: { entries: { where: { archivedAt: null } } }
    });

    return {
      targetType: "profile_section",
      targetId: section?.id ?? "",
      targetField: "",
      sectionKey: patch.sectionKey,
      expectedVersion: null,
      beforeValueJson: {
        activeEntryCount: section?.entries.length ?? 0,
        fingerprints: section?.entries.map((entry) => fingerprintImportEntry(patch.sectionKey, entry.data as Record<string, unknown>)) ?? []
      },
      afterValueJson: cleanEntryData(patch.sectionKey, cleaned)
    };
  }

  if (patch.type === "update_entry" || patch.type === "delete_entry") {
    const entry = await tx.profileSectionEntry.findFirst({
      where: {
        id: patch.entryId,
        profileId,
        sectionKey: patch.sectionKey,
        archivedAt: null
      }
    });
    const before = entry?.data && typeof entry.data === "object" && !Array.isArray(entry.data) ? entry.data : {};
    const after =
      patch.type === "update_entry"
        ? cleanEntryData(patch.sectionKey, {
            ...(before as Record<string, unknown>),
            ...cleanSectionPatchData(patch.sectionKey, patch.data)
          })
        : { archived: true };

    return {
      targetType: "profile_section_entry",
      targetId: patch.entryId,
      targetField: "",
      sectionKey: patch.sectionKey,
      expectedVersion: entry?.version ?? null,
      beforeValueJson: before as Prisma.JsonObject,
      afterValueJson: after
    };
  }

  return {
    targetType: "unknown",
    targetId: "",
    targetField: "",
    sectionKey: "",
    expectedVersion: null,
    beforeValueJson: {},
    afterValueJson: {}
  };
}

export async function validatePendingProposalFresh({
  workspaceId,
  profileId,
  sessionId,
  proposalId
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  proposalId: string;
}) {
  const proposal = await prisma.agentProposal.findFirst({
    where: {
      id: proposalId,
      workspaceId,
      profileId,
      sessionId,
      status: "pending"
    },
    include: { changes: { orderBy: { changeOrder: "asc" } } }
  });

  if (!proposal) {
    return { ok: false, message: "This CV update is no longer pending. Please refresh the review panel." };
  }

  for (const change of proposal.changes) {
    if (change.status !== "pending" || !change.beforeHash) continue;
    const current = await currentProposalTargetValue(profileId, change);
    if (!current.ok || stableHash(current.value) !== change.beforeHash) {
      await prisma.$transaction([
        prisma.agentProposal.update({
          where: { id: proposal.id },
          data: { status: "stale", staleAt: new Date() }
        }),
        prisma.agentProposalChange.updateMany({
          where: { proposalId: proposal.id, status: "pending" },
          data: { status: "stale" }
        }),
        prisma.cvAgentPatchLog.updateMany({
          where: { proposalId: proposal.id, status: { in: ["needs_confirmation", "conflict"] } },
          data: {
            status: "stale",
            resultJson: { message: "This drafted CV update became stale because the source data changed." } as Prisma.InputJsonValue
          }
        })
      ]);
      return { ok: false, message: "This drafted CV update is stale because the source CV data changed. Please ask CVScholar to review it again." };
    }
  }

  return { ok: true, proposal };
}

async function currentProposalTargetValue(profileId: string, change: {
  targetType: string;
  targetId: string;
  targetField: string;
  sectionKey: string;
  expectedVersion: number | null;
}) {
  if (change.targetType === "academic_profile") {
    const profile = await prisma.academicProfile.findUnique({ where: { id: profileId } });
    if (!profile || (change.expectedVersion !== null && profile.version !== change.expectedVersion)) {
      return { ok: false, value: {} };
    }
    const fields = change.targetField.split(",").filter(Boolean);
    return {
      ok: true,
      value: Object.fromEntries(fields.map((key) => [key, String((profile as unknown as Record<string, unknown>)[key] ?? "").trim()]))
    };
  }

  if (change.targetType === "profile_section_entry") {
    const entry = await prisma.profileSectionEntry.findFirst({
      where: {
        id: change.targetId,
        profileId,
        sectionKey: change.sectionKey,
        archivedAt: null
      }
    });
    if (!entry || (change.expectedVersion !== null && entry.version !== change.expectedVersion)) {
      return { ok: false, value: {} };
    }
    return { ok: true, value: entry.data };
  }

  if (change.targetType === "profile_section") {
    const entries = await prisma.profileSectionEntry.findMany({
      where: {
        profileId,
        sectionKey: change.sectionKey,
        archivedAt: null
      },
      orderBy: { entryOrder: "asc" }
    });
    return {
      ok: true,
      value: {
        activeEntryCount: entries.length,
        fingerprints: entries.map((entry) => fingerprintImportEntry(change.sectionKey, entry.data as Record<string, unknown>))
      }
    };
  }

  return { ok: true, value: {} };
}

function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortJson(item)])
  );
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

  if (patch.type === "delete_entry") {
    const title = sectionDefinitionByKey(patch.sectionKey)?.shortTitle ?? "CV";
    return {
      patchType: patch.type,
      status: "needs_confirmation",
      message: `Review and approve this ${title} entry removal before I update your CV.`,
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
  workspaceId: string,
  profileId: string,
  patch: CvAgentPatch,
  confirmed: boolean,
  proposalId?: string
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
    return applyPersonalPatch(tx, workspaceId, profileId, patch.data, confirmed, proposalId);
  }

  if (patch.type === "add_entry") {
    return applyAddEntryPatch(tx, workspaceId, profileId, patch.sectionKey, patch.data, proposalId);
  }

  if (patch.type === "update_entry") {
    return applyUpdateEntryPatch(tx, workspaceId, profileId, patch.sectionKey, patch.entryId, patch.data, confirmed, proposalId);
  }

  if (patch.type === "delete_entry") {
    return applyDeleteEntryPatch(tx, workspaceId, profileId, patch.sectionKey, patch.entryId, confirmed, proposalId);
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
  workspaceId: string,
  profileId: string,
  data: Record<string, string>,
  confirmed: boolean,
  proposalId?: string
): Promise<PatchResult> {
  const profile = await tx.academicProfile.findUniqueOrThrow({ where: { id: profileId } });
  const cleaned = cleanPersonalPatchData(data);
  const updates: Record<string, string> = {};
  const before: Record<string, string> = {};
  const conflicts: string[] = [];
  const skipped: string[] = [];

  for (const [key, incoming] of Object.entries(cleaned)) {
    const current = String((profile as unknown as Record<string, unknown>)[key] ?? "").trim();
    const label = personalFields.find((field) => field.name === key)?.label ?? key;

    if (!incoming) continue;
    if (!current || confirmed) {
      updates[key] = incoming;
      before[key] = current;
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
    data: {
      ...updates,
      version: { increment: 1 }
    }
  });

  await tx.profileRevision.create({
    data: {
      workspaceId,
      profileId,
      proposalId,
      targetType: "academic_profile",
      targetId: profileId,
      action: "update_personal",
      beforeJson: before as Prisma.InputJsonValue,
      afterJson: updates as Prisma.InputJsonValue
    }
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
  workspaceId: string,
  profileId: string,
  sectionKey: string,
  data: Record<string, string>,
  proposalId?: string
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
      include: { entries: { where: { archivedAt: null } } }
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
        source: "ai_chat",
        version: { increment: 1 }
      }
    });

    await tx.profileRevision.create({
      data: {
        workspaceId,
        profileId,
        proposalId,
        targetType: "profile_section_entry",
        targetId: existingEntry.id,
        action: "update_declaration",
        beforeJson: existingEntry.data as Prisma.InputJsonValue,
        afterJson: nextData as Prisma.InputJsonValue
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

  const entry = await tx.profileSectionEntry.create({
    data: {
      profileId,
      sectionId: section.id,
      sectionKey,
      entryOrder: section.entries.length + 1,
      data: fullData as Prisma.InputJsonObject,
      source: "ai_chat"
    }
  });

  await tx.profileRevision.create({
    data: {
      workspaceId,
      profileId,
      proposalId,
      targetType: "profile_section_entry",
      targetId: entry.id,
      action: "add_entry",
      beforeJson: {} as Prisma.InputJsonValue,
      afterJson: fullData as Prisma.InputJsonValue
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
  workspaceId: string,
  profileId: string,
  sectionKey: string,
  entryId: string,
  data: Record<string, string>,
  confirmed: boolean,
  proposalId?: string
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
      sectionKey,
      archivedAt: null
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
      source: "ai_chat",
      version: { increment: 1 }
    }
  });

  await tx.profileRevision.create({
    data: {
      workspaceId,
      profileId,
      proposalId,
      targetType: "profile_section_entry",
      targetId: entryId,
      action: "update_entry",
      beforeJson: entry.data as Prisma.InputJsonValue,
      afterJson: nextData as Prisma.InputJsonValue
    }
  });

  return {
    patchType: "update_entry",
    status: "applied",
    message: "I updated the confirmed CV entry.",
    warnings: []
  };
}

async function applyDeleteEntryPatch(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  profileId: string,
  sectionKey: string,
  entryId: string,
  confirmed: boolean,
  proposalId?: string
): Promise<PatchResult> {
  if (!confirmed) {
    return {
      patchType: "delete_entry",
      status: "needs_confirmation",
      message: "Removing an existing CV entry needs confirmation.",
      warnings: [],
      approvalRequired: true
    };
  }

  const entry = await tx.profileSectionEntry.findFirst({
    where: {
      id: entryId,
      profileId,
      sectionKey,
      archivedAt: null
    }
  });

  if (!entry) {
    return {
      patchType: "delete_entry",
      status: "invalid",
      message: "I could not find that CV entry to remove.",
      warnings: []
    };
  }

  const archivedAt = new Date();
  await tx.profileSectionEntry.update({
    where: { id: entry.id },
    data: {
      isVisible: false,
      archivedAt,
      archivedBy: "cv_agent",
      archiveSource: "cv_agent",
      version: { increment: 1 }
    }
  });

  const remaining = await tx.profileSectionEntry.findMany({
    where: { profileId, sectionKey, archivedAt: null },
    orderBy: { entryOrder: "asc" }
  });

  for (const [index, item] of remaining.entries()) {
    await tx.profileSectionEntry.update({
      where: { id: item.id },
      data: { entryOrder: index + 1 }
    });
  }

  await tx.profileRevision.create({
    data: {
      workspaceId,
      profileId,
      proposalId,
      targetType: "profile_section_entry",
      targetId: entry.id,
      action: "archive_entry",
      beforeJson: entry.data as Prisma.InputJsonValue,
      afterJson: {
        archivedAt: archivedAt.toISOString(),
        isVisible: false
      } as Prisma.InputJsonValue
    }
  });

  const title = sectionDefinitionByKey(sectionKey)?.shortTitle ?? "CV";
  return {
    patchType: "delete_entry",
    status: "applied",
    message: `I archived one ${title} entry.`,
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
