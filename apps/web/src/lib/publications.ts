import type { Prisma } from "@/generated/prisma/client";
import { cleanEntryData, ensureProfileEditorData, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";

export type PublicationData = {
  title: string;
  authors: string;
  year: string;
  publication_type: string;
  venue: string;
  volume_issue_pages: string;
  doi: string;
  url: string;
  status: string;
};

type PublicationCandidate = {
  entryId: string;
  data: PublicationData;
  source: string;
  matchType: string;
  confidence: number;
  reason: string;
};

type PublicationAssessment = {
  candidates: PublicationCandidate[];
  aiDecision: {
    decision: "same_publication" | "probably_same" | "different" | "not_checked";
    confidence: number;
    reason: string;
  };
  recommendedAction: "approve" | "merge" | "review_duplicate";
  duplicateEntryId: string;
  confidence: number;
  reason: string;
};

export type PublicationQualityIssue = {
  id: string;
  entryId: string;
  field: keyof PublicationData;
  action: "update" | "remove";
  severity: "warning" | "suggestion";
  message: string;
  current: string;
  suggestion: string;
  suggestedData: PublicationData;
};

export type PublicationQualityScan = {
  status: "clean" | "issues" | "ai_unavailable";
  summary: string;
  checked: number;
  issues: PublicationQualityIssue[];
};

const publicationFields = [
  "title",
  "authors",
  "year",
  "publication_type",
  "venue",
  "volume_issue_pages",
  "doi",
  "url",
  "status"
] as const;

export async function getPublicationWorkspace(profileId: string) {
  await ensureProfileEditorData(profileId);
  const section = await getPublicationSection(profileId);
  const [entries, pendingItems] = await Promise.all([
    prisma.profileSectionEntry.findMany({
      where: { profileId, sectionKey: "publications" },
      orderBy: { entryOrder: "asc" }
    }),
    prisma.publicationImportItem.findMany({
      where: {
        profileId,
        status: "pending"
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  return {
    sectionId: section.id,
    approved: entries.map((entry) => ({
      id: entry.id,
      source: entry.source,
      entryOrder: entry.entryOrder,
      data: toPublicationData(entry.data),
      warning: warningForEntry(entry.source, toPublicationData(entry.data))
    })),
    pending: pendingItems.map(serializeReviewItem),
    stats: {
      approved: entries.length,
      pending: pendingItems.length,
      duplicates: pendingItems.filter((item) => item.recommendedAction !== "approve").length,
      doiCount: entries.filter((entry) => toPublicationData(entry.data).doi).length
    }
  };
}

export async function importOrcidPublications({
  workspaceId,
  profileId,
  input
}: {
  workspaceId: string;
  profileId: string;
  input: string;
}) {
  const orcidId = parseOrcidId(input);
  if (!orcidId) {
    throw new Error("Enter a valid ORCID ID or ORCID profile URL.");
  }

  const profileResponse = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/works`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });

  if (!profileResponse.ok) {
    throw new Error("Could not fetch ORCID works. Check the ID and try again.");
  }

  const payload = (await profileResponse.json()) as Record<string, unknown>;
  const publications = parseOrcidWorks(payload);

  return createImportBatch({
    workspaceId,
    profileId,
    source: "orcid",
    sourceInput: orcidId,
    publications,
    message: publications.length ? `Found ${publications.length} ORCID publication(s).` : "No ORCID works were found."
  });
}

export async function importScholarPublications({
  workspaceId,
  profileId,
  input
}: {
  workspaceId: string;
  profileId: string;
  input: string;
}) {
  const scholarId = parseScholarId(input);
  if (!scholarId) {
    throw new Error("Enter a valid Google Scholar profile URL or profile ID.");
  }

  const response = await fetch(`https://scholar.google.com/citations?user=${encodeURIComponent(scholarId)}&hl=en&cstart=0&pagesize=100`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "CVScholar/1.0 Publication Import"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error("Could not fetch Google Scholar. The profile may be private or temporarily blocked.");
  }

  const html = await response.text();
  const publications = parseScholarPublications(html);

  return createImportBatch({
    workspaceId,
    profileId,
    source: "google_scholar",
    sourceInput: scholarId,
    publications,
    message: publications.length ? `Found ${publications.length} Google Scholar publication(s).` : "No Google Scholar publications were found."
  });
}

export async function lookupDoiPublication({
  workspaceId,
  profileId,
  doi
}: {
  workspaceId: string;
  profileId: string;
  doi: string;
}) {
  const normalizedDoi = normalizeDoi(doi);
  if (!normalizedDoi) {
    throw new Error("Enter a DOI or DOI URL first.");
  }

  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CVScholar/1.0 (mailto:support@cvscholar.com)"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error("DOI not found. Check the DOI and try again.");
  }

  const payload = (await response.json()) as { message?: Record<string, unknown> };
  const publication = crossrefToPublication(payload.message ?? {}, normalizedDoi);
  const batch = await createImportBatch({
    workspaceId,
    profileId,
    source: "doi",
    sourceInput: normalizedDoi,
    publications: [publication],
    message: "DOI metadata is ready to review."
  });

  return batch.items[0];
}

export async function createManualPublication(profileId: string) {
  await ensureProfileEditorData(profileId);
  const section = await getPublicationSection(profileId);
  const count = await prisma.profileSectionEntry.count({
    where: { profileId, sectionKey: "publications" }
  });
  const entry = await prisma.profileSectionEntry.create({
    data: {
      profileId,
      sectionId: section.id,
      sectionKey: "publications",
      entryOrder: count + 1,
      source: "manual",
      data: cleanPublicationData({}, "manual").cleaned as Prisma.InputJsonValue
    }
  });

  await refreshCompleteness(profileId);

  return {
    id: entry.id,
    source: entry.source,
    entryOrder: entry.entryOrder,
    data: toPublicationData(entry.data),
    warning: ""
  };
}

export async function approveReviewItems({
  workspaceId,
  profileId,
  itemIds,
  forceKeepBoth = false
}: {
  workspaceId: string;
  profileId: string;
  itemIds: string[];
  forceKeepBoth?: boolean;
}) {
  const items = await prisma.publicationImportItem.findMany({
    where: {
      id: { in: itemIds },
      workspaceId,
      profileId,
      status: "pending"
    },
    orderBy: { createdAt: "asc" }
  });

  if (items.length === 0) {
    throw new Error("No pending publications were selected.");
  }

  const blocked = items.filter((item) => item.recommendedAction !== "approve" && !forceKeepBoth);
  if (blocked.length > 0) {
    throw new Error("Review possible duplicates before approving them.");
  }

  await ensureProfileEditorData(profileId);
  const section = await getPublicationSection(profileId);
  const count = await prisma.profileSectionEntry.count({
    where: { profileId, sectionKey: "publications" }
  });

  let offset = 0;
  const entries = [];
  for (const item of items) {
    const data = toPublicationData(item.cleanedData);
    const entry = await prisma.profileSectionEntry.create({
      data: {
        profileId,
        sectionId: section.id,
        sectionKey: "publications",
        entryOrder: count + offset + 1,
        source: item.source,
        data: data as Prisma.InputJsonValue
      }
    });
    offset += 1;
    entries.push(entry);
  }

  await prisma.publicationImportItem.updateMany({
    where: { id: { in: items.map((item) => item.id) } },
    data: { status: forceKeepBoth ? "approved_keep_both" : "approved" }
  });
  await refreshCompleteness(profileId);

  return { approved: entries.length };
}

export async function rejectReviewItems({
  workspaceId,
  profileId,
  itemIds
}: {
  workspaceId: string;
  profileId: string;
  itemIds: string[];
}) {
  const result = await prisma.publicationImportItem.updateMany({
    where: {
      id: { in: itemIds },
      workspaceId,
      profileId,
      status: "pending"
    },
    data: { status: "rejected" }
  });

  return { rejected: result.count };
}

export async function mergeReviewItem({
  workspaceId,
  profileId,
  itemId
}: {
  workspaceId: string;
  profileId: string;
  itemId: string;
}) {
  const item = await prisma.publicationImportItem.findFirst({
    where: { id: itemId, workspaceId, profileId, status: "pending" }
  });

  if (!item) {
    throw new Error("Pending publication not found.");
  }

  const duplicateEntryId = item.duplicateEntryId || firstDuplicateEntryId(item.duplicateCandidates);
  if (!duplicateEntryId) {
    throw new Error("No existing publication was selected for merge.");
  }

  const existing = await prisma.profileSectionEntry.findFirst({
    where: {
      id: duplicateEntryId,
      profileId,
      sectionKey: "publications"
    }
  });

  if (!existing) {
    throw new Error("Existing publication was not found.");
  }

  const merged = mergePublicationData(toPublicationData(existing.data), toPublicationData(item.cleanedData));
  await prisma.profileSectionEntry.update({
    where: { id: existing.id },
    data: {
      data: merged as Prisma.InputJsonValue,
      source: sourceHistory(existing.source, item.source)
    }
  });
  await prisma.publicationImportItem.update({
    where: { id: item.id },
    data: { status: "merged", duplicateEntryId: existing.id }
  });
  await refreshCompleteness(profileId);

  return { merged: true, entryId: existing.id };
}

export async function cleanAndAssessPublication({
  profileId,
  raw,
  source
}: {
  profileId: string;
  raw: Record<string, unknown>;
  source: string;
}) {
  const cleanResult = cleanPublicationData(raw, source);
  const assessment = await assessDuplicates(profileId, cleanResult.cleaned);

  return {
    rawData: raw,
    cleanedData: cleanResult.cleaned,
    cleanupNotes: cleanResult.notes,
    assessment
  };
}

export async function scanPublicationQuality(profileId: string): Promise<PublicationQualityScan> {
  const entries = await prisma.profileSectionEntry.findMany({
    where: { profileId, sectionKey: "publications" },
    orderBy: { entryOrder: "asc" }
  });

  const deterministicIssues = entries.flatMap((entry) => publicationQualityIssues(entry.id, toPublicationData(entry.data)));
  const aiIssues = process.env.OPENAI_API_KEY
    ? await aiPublicationQualityIssues(entries.map((entry) => ({ id: entry.id, data: toPublicationData(entry.data) })))
    : [];
  const issueMap = new Map<string, PublicationQualityIssue>();
  const removalEntryIds = new Set([...deterministicIssues, ...aiIssues].filter((issue) => issue.action === "remove").map((issue) => issue.entryId));

  for (const issue of [...deterministicIssues, ...aiIssues]) {
    if (removalEntryIds.has(issue.entryId) && issue.action !== "remove") continue;
    issueMap.set(`${issue.entryId}:${issue.action}:${issue.field}:${issue.suggestion}`, issue);
  }

  const issues = Array.from(issueMap.values()).slice(0, 30);
  return {
    status: issues.length ? "issues" : process.env.OPENAI_API_KEY ? "clean" : "ai_unavailable",
    summary: issues.length
      ? `${issues.length} publication detail${issues.length === 1 ? "" : "s"} need review.`
      : process.env.OPENAI_API_KEY
        ? "No publication formatting issues were found."
        : "No local formatting issues were found. AI review is not configured.",
    checked: entries.length,
    issues
  };
}

export async function applyPublicationSuggestion({
  profileId,
  entryId,
  data,
  action = "update"
}: {
  profileId: string;
  entryId: string;
  data: PublicationData;
  action?: "update" | "remove";
}) {
  const entry = await prisma.profileSectionEntry.findFirst({
    where: { id: entryId, profileId, sectionKey: "publications" }
  });

  if (!entry) {
    throw new Error("Publication was not found.");
  }

  if (action === "remove") {
    await prisma.profileSectionEntry.delete({ where: { id: entry.id } });
    await normalizePublicationEntryOrder(profileId);
    await refreshCompleteness(profileId);
    return { ok: true };
  }

  const cleaned = cleanPublicationData(data, entry.source).cleaned;
  await prisma.profileSectionEntry.update({
    where: { id: entry.id },
    data: { data: cleaned as Prisma.InputJsonValue }
  });
  await refreshCompleteness(profileId);

  return { ok: true };
}

async function normalizePublicationEntryOrder(profileId: string) {
  const entries = await prisma.profileSectionEntry.findMany({
    where: { profileId, sectionKey: "publications" },
    orderBy: { entryOrder: "asc" }
  });

  await prisma.$transaction(
    entries.map((entry, index) =>
      prisma.profileSectionEntry.update({
        where: { id: entry.id },
        data: { entryOrder: index + 1 }
      })
    )
  );
}

async function createImportBatch({
  workspaceId,
  profileId,
  source,
  sourceInput,
  publications,
  message
}: {
  workspaceId: string;
  profileId: string;
  source: string;
  sourceInput: string;
  publications: Record<string, unknown>[];
  message: string;
}) {
  const batch = await prisma.publicationImportBatch.create({
    data: {
      workspaceId,
      profileId,
      source,
      sourceInput,
      status: publications.length ? "ready" : "empty",
      message,
      statsJson: { total: publications.length } as Prisma.InputJsonValue
    }
  });

  const items = [];
  for (const publication of publications) {
    const reviewed = await cleanAndAssessPublication({ profileId, raw: publication, source });
    const item = await prisma.publicationImportItem.create({
      data: {
        batchId: batch.id,
        workspaceId,
        profileId,
        source,
        status: "pending",
        rawData: reviewed.rawData as Prisma.InputJsonValue,
        cleanedData: reviewed.cleanedData as Prisma.InputJsonValue,
        duplicateCandidates: reviewed.assessment.candidates as unknown as Prisma.InputJsonValue,
        aiDecision: reviewed.assessment.aiDecision as Prisma.InputJsonValue,
        duplicateEntryId: reviewed.assessment.duplicateEntryId,
        recommendedAction: reviewed.assessment.recommendedAction,
        confidence: reviewed.assessment.confidence,
        reason: [...reviewed.cleanupNotes, reviewed.assessment.reason].filter(Boolean).join(" ")
      }
    });
    items.push(serializeReviewItem(item));
  }

  return {
    batch: {
      id: batch.id,
      source: batch.source,
      status: batch.status,
      message: batch.message
    },
    items
  };
}

async function assessDuplicates(profileId: string, incoming: PublicationData): Promise<PublicationAssessment> {
  const existing = await prisma.profileSectionEntry.findMany({
    where: { profileId, sectionKey: "publications" },
    orderBy: { entryOrder: "asc" }
  });

  const deterministic = existing
    .map((entry) => scoreCandidate(entry.id, toPublicationData(entry.data), entry.source, incoming))
    .filter((candidate): candidate is PublicationCandidate => Boolean(candidate))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);

  const strongest = deterministic[0];
  if (!strongest) {
    return emptyAssessment("No likely duplicate found.");
  }

  if (strongest.matchType === "doi") {
    return {
      candidates: deterministic,
      aiDecision: { decision: "same_publication", confidence: 1, reason: "DOI matches an existing publication." },
      recommendedAction: "merge",
      duplicateEntryId: strongest.entryId,
      confidence: 1,
      reason: "DOI matches an existing publication."
    };
  }

  if (strongest.confidence >= 0.86) {
    return {
      candidates: deterministic,
      aiDecision: { decision: "probably_same", confidence: strongest.confidence, reason: strongest.reason },
      recommendedAction: "review_duplicate",
      duplicateEntryId: strongest.entryId,
      confidence: strongest.confidence,
      reason: strongest.reason
    };
  }

  if (strongest.confidence >= 0.62) {
    const aiDecision = await aiDuplicateDecision(incoming, strongest.data);
    const aiConfidence = aiDecision.confidence || strongest.confidence;
    const same = aiDecision.decision === "same_publication" || aiDecision.decision === "probably_same";

    return {
      candidates: deterministic,
      aiDecision,
      recommendedAction: same ? "review_duplicate" : "approve",
      duplicateEntryId: same ? strongest.entryId : "",
      confidence: aiConfidence,
      reason: aiDecision.reason || strongest.reason
    };
  }

  return emptyAssessment("No likely duplicate found.");
}

function emptyAssessment(reason: string): PublicationAssessment {
  return {
    candidates: [],
    aiDecision: { decision: "not_checked", confidence: 0, reason },
    recommendedAction: "approve",
    duplicateEntryId: "",
    confidence: 0,
    reason
  };
}

function scoreCandidate(entryId: string, existing: PublicationData, source: string, incoming: PublicationData): PublicationCandidate | null {
  if (incoming.doi && existing.doi && normalizeDoi(incoming.doi) === normalizeDoi(existing.doi)) {
    return {
      entryId,
      data: existing,
      source,
      matchType: "doi",
      confidence: 1,
      reason: "DOI is identical."
    };
  }

  const incomingTitle = normalizeTitle(incoming.title);
  const existingTitle = normalizeTitle(existing.title);
  if (!incomingTitle || !existingTitle) return null;

  const titleSimilarity = similarity(incomingTitle, existingTitle);
  const sameYear = incoming.year && existing.year && incoming.year === existing.year;
  const sameFirstAuthor = firstAuthor(incoming.authors) && firstAuthor(incoming.authors) === firstAuthor(existing.authors);
  const confidence = Math.min(0.95, titleSimilarity + (sameYear ? 0.08 : 0) + (sameFirstAuthor ? 0.07 : 0));

  if (confidence < 0.58) return null;

  return {
    entryId,
    data: existing,
    source,
    matchType: sameYear ? "title_year" : sameFirstAuthor ? "title_author" : "title",
    confidence,
    reason: sameYear
      ? "Title is very similar and year matches."
      : sameFirstAuthor
        ? "Title is similar and first author matches."
        : "Title is similar enough to review."
  };
}

async function aiDuplicateDecision(incoming: PublicationData, existing: PublicationData): Promise<PublicationAssessment["aiDecision"]> {
  if (!process.env.OPENAI_API_KEY) {
    return { decision: "not_checked", confidence: 0, reason: "AI duplicate review is not configured." };
  }

  const model = process.env.CVSCHOLAR_CV_AGENT_MODEL || "gpt-4.1-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Compare two academic publication records. Return JSON only with decision: same_publication, probably_same, or different; confidence 0-1; reason under 20 words. Do not invent missing facts."
          },
          {
            role: "user",
            content: JSON.stringify({ incoming, existing })
          }
        ]
      })
    });
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!response.ok || !content) {
      throw new Error("AI duplicate review failed.");
    }
    const parsed = JSON.parse(content) as { decision?: string; confidence?: number; reason?: string };
    const decision =
      parsed.decision === "same_publication" || parsed.decision === "probably_same" || parsed.decision === "different"
        ? parsed.decision
        : "not_checked";
    return {
      decision,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: typeof parsed.reason === "string" ? parsed.reason : "AI duplicate review completed."
    };
  } catch (error) {
    return {
      decision: "not_checked",
      confidence: 0,
      reason: error instanceof Error ? error.message : "AI duplicate review failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function cleanPublicationData(input: Record<string, unknown>, source: string) {
  const raw = rawPublicationData(input);
  const cleaned: PublicationData = {
    title: cleanTitle(raw.title),
    authors: cleanAuthors(raw.authors),
    year: cleanYear(raw.year),
    publication_type: cleanText(raw.publication_type || raw.type),
    venue: cleanText(raw.venue || raw.journal || raw.publisher),
    volume_issue_pages: cleanText(raw.volume_issue_pages || raw.pages),
    doi: normalizeDoi(raw.doi),
    url: cleanUrl(raw.url),
    status: cleanStatus(raw.status)
  };

  if (!cleaned.url && cleaned.doi) {
    cleaned.url = `https://doi.org/${cleaned.doi}`;
  }

  if (!cleaned.status && (source === "doi" || cleaned.year)) {
    cleaned.status = "Published";
  }

  if (!cleaned.publication_type && source === "doi") {
    cleaned.publication_type = "Journal Article";
  }

  return {
    cleaned: cleanEntryData("publications", cleaned) as PublicationData,
    notes: cleanupNotes(raw, cleaned)
  };
}

function publicationQualityIssues(entryId: string, data: PublicationData): PublicationQualityIssue[] {
  const issues: PublicationQualityIssue[] = [];
  if (isLikelyNonPublicationHeading(data)) {
    issues.push(makeQualityIssue({
      entryId,
      data,
      field: "title",
      action: "remove",
      severity: "warning",
      message: "This looks like a section heading, not a publication.",
      suggestion: "Remove this entry"
    }));
    return issues;
  }

  const titleSuggestion = cleanTitle(data.title);
  if (titleSuggestion && titleSuggestion !== data.title) {
    issues.push(makeQualityIssue({
      entryId,
      data,
      field: "title",
      severity: /&#\d+;|&#x[0-9a-f]+;/i.test(data.title) ? "warning" : "suggestion",
      message: /&#\d+;|&#x[0-9a-f]+;/i.test(data.title)
        ? "Title contains encoded symbols that should be decoded."
        : "Title may need scientific notation cleanup.",
      suggestion: titleSuggestion
    }));
  }

  const venueSuggestion = normalizeScientificTitle(data.venue);
  if (venueSuggestion && venueSuggestion !== data.venue) {
    issues.push(makeQualityIssue({
      entryId,
      data,
      field: "venue",
      severity: "suggestion",
      message: "Venue text may need symbol cleanup.",
      suggestion: venueSuggestion
    }));
  }

  if (!data.publication_type && data.venue) {
    issues.push(makeQualityIssue({
      entryId,
      data,
      field: "publication_type",
      severity: "suggestion",
      message: "Publication type is missing.",
      suggestion: inferPublicationType(data)
    }));
  }

  if (!data.status && data.year) {
    issues.push(makeQualityIssue({
      entryId,
      data,
      field: "status",
      severity: "suggestion",
      message: "Publication status is missing.",
      suggestion: "Published"
    }));
  }

  return issues;
}

function makeQualityIssue({
  entryId,
  data,
  field,
  action = "update",
  severity,
  message,
  suggestion
}: {
  entryId: string;
  data: PublicationData;
  field: keyof PublicationData;
  action?: "update" | "remove";
  severity: "warning" | "suggestion";
  message: string;
  suggestion: string;
}): PublicationQualityIssue {
  return {
    id: `${entryId}-${action}-${field}-${suggestion}`,
    entryId,
    field,
    action,
    severity,
    message,
    current: data[field],
    suggestion,
    suggestedData: { ...data, [field]: suggestion }
  };
}

function normalizeScientificTitle(value: string) {
  const decoded = decodeHtml(value);
  if (!decoded) return "";
  return decoded
    .replace(/\balpha\b/gi, "alpha")
    .replace(/α/g, "alpha")
    .replace(/β/g, "beta")
    .replace(/γ/g, "gamma")
    .replace(/\bCO2\b/g, "CO2")
    .replace(/\bTiO2\b/g, "TiO2")
    .replace(/\bFe2O3\b/g, "Fe2O3")
    .replace(/\bCu2O\b/g, "Cu2O")
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyNonPublicationHeading(data: PublicationData) {
  const title = cleanText(decodeHtml(data.title)).toLowerCase();
  if (!title) return false;
  const lacksStrongAnchors = !data.year && !data.venue && !data.doi && !data.url && !data.volume_issue_pages;

  const headingPatterns = [
    /\b(full|selected|major|recent)\s+papers?\s+published\b/,
    /\b(peer[-\s]?reviewed|sci|scopus|indexed)\s+(category|publications?|papers?)\b/,
    /\b(publications?|journal articles?|conference papers?|book chapters?|technical papers?|white papers?|preprints?)\b\s*$/,
    /\b(list of|details of)\s+(publications?|papers?|articles?)\b/
  ];
  const looksLikeHeading = headingPatterns.some((pattern) => pattern.test(title));
  const looksLikeFragment = /^(for|in|on|using|with|based on|towards?)\b/.test(title) || title.split(/\s+/).length <= 4;
  const looksLikeContainer = /\b(journal|proceedings|transactions|letters|conference|symposium|congress|workshop|current research in|materials research express|sustainable chemistry)\b/.test(title);
  const lacksPublicationAnchors = !data.authors && !data.doi && !data.url && !data.volume_issue_pages;

  return (looksLikeHeading && lacksPublicationAnchors) || (lacksStrongAnchors && (looksLikeFragment || looksLikeContainer));
}

function inferPublicationType(data: PublicationData) {
  const text = `${data.title} ${data.venue}`.toLowerCase();
  if (/conference|congress|symposium|proceedings/.test(text)) return "Conference Paper";
  if (/preprint|arxiv|research square/.test(text)) return "Preprint";
  if (/chapter/.test(text)) return "Book Chapter";
  if (/book/.test(text)) return "Book";
  if (/white paper/.test(text)) return "White Paper";
  if (/technical/.test(text)) return "Technical Paper";
  return "Journal Article";
}

async function aiPublicationQualityIssues(entries: { id: string; data: PublicationData }[]): Promise<PublicationQualityIssue[]> {
  if (!entries.length || !process.env.OPENAI_API_KEY) return [];
  const model = process.env.CVSCHOLAR_PUBLICATION_REVIEW_MODEL || process.env.CVSCHOLAR_CV_AGENT_MODEL || "gpt-4.1-mini";
  const compact = entries.slice(0, 80).map((entry) => ({
    id: entry.id,
    title: entry.data.title,
    authors: entry.data.authors,
    year: entry.data.year,
    type: entry.data.publication_type,
    venue: entry.data.venue,
    details: entry.data.volume_issue_pages,
    doi: entry.data.doi,
    status: entry.data.status
  }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Review academic publication metadata. Return JSON only: {issues:[{entryId,field,action,message,suggestion,severity}]}. First decide whether each entry is an individual scholarly output. Use action remove when the title is only a journal/conference/book name, section heading, category label, subtitle fragment, trailing phrase, metric heading, or incomplete leftover text rather than a paper/work title. Examples that should be removed when lacking DOI/year/venue/details: 'Current Research in Green and Sustainable Chemistry', 'For Consumer Electronic Applications', 'Full Papers Published in International Peer Reviewed (SCI Category)'. For real publications, use action update only for malformed HTML entities, chemical/math notation, obvious casing, missing type/status, and venue/type mismatch. Do not invent bibliographic facts. Only suggest a replacement when the current text makes it clear."
          },
          {
            role: "user",
            content: JSON.stringify({ publications: compact })
          }
        ]
      })
    });
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!response.ok || !content) return [];
    const parsed = JSON.parse(content) as { issues?: unknown[] };
    return (parsed.issues ?? []).flatMap((issue) => {
      if (!issue || typeof issue !== "object" || Array.isArray(issue)) return [];
      const item = issue as Record<string, unknown>;
      const entryId = stringValue(item.entryId);
      const field = stringValue(item.field) as keyof PublicationData;
      const entry = entries.find((candidate) => candidate.id === entryId);
      const action = stringValue(item.action) === "remove" ? "remove" : "update";
      const suggestion = cleanText(stringValue(item.suggestion));
      if (!entry || !publicationFields.includes(field)) return [];
      if (action === "update" && (!suggestion || suggestion === entry.data[field])) return [];
      return [
        makeQualityIssue({
          entryId,
          data: entry.data,
          field,
          action,
          severity: stringValue(item.severity) === "warning" ? "warning" : "suggestion",
          message: cleanText(stringValue(item.message)) || "CV Scholar AI found a possible metadata issue.",
          suggestion: suggestion || "Remove this entry"
        })
      ];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function rawPublicationData(input: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const field of publicationFields) {
    out[field] = stringValue(input[field]);
  }
  out.type = stringValue(input.type);
  out.journal = stringValue(input.journal);
  out.publisher = stringValue(input.publisher);
  out.pages = stringValue(input.pages);
  return out;
}

function toPublicationData(value: Prisma.JsonValue | Record<string, unknown>): PublicationData {
  const input = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    title: stringValue(input.title),
    authors: stringValue(input.authors),
    year: stringValue(input.year),
    publication_type: stringValue(input.publication_type),
    venue: stringValue(input.venue),
    volume_issue_pages: stringValue(input.volume_issue_pages),
    doi: stringValue(input.doi),
    url: stringValue(input.url),
    status: stringValue(input.status)
  };
}

function serializeReviewItem(item: {
  id: string;
  source: string;
  status: string;
  rawData: Prisma.JsonValue;
  cleanedData: Prisma.JsonValue;
  duplicateCandidates: Prisma.JsonValue;
  aiDecision: Prisma.JsonValue;
  duplicateEntryId: string;
  recommendedAction: string;
  confidence: number;
  reason: string;
  createdAt: Date;
}) {
  return {
    id: item.id,
    source: item.source,
    status: item.status,
    rawData: toPublicationData(item.rawData),
    cleanedData: toPublicationData(item.cleanedData),
    duplicateCandidates: reviewCandidates(item.duplicateCandidates),
    aiDecision: item.aiDecision,
    duplicateEntryId: item.duplicateEntryId,
    recommendedAction: item.recommendedAction,
    confidence: item.confidence,
    reason: item.reason,
    createdAt: item.createdAt.toISOString()
  };
}

async function getPublicationSection(profileId: string) {
  await ensureProfileEditorData(profileId);
  return prisma.profileSection.findUniqueOrThrow({
    where: {
      profileId_key: {
        profileId,
        key: "publications"
      }
    }
  });
}

function parseOrcidId(input: string) {
  return input.trim().match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i)?.[1] ?? "";
}

function parseScholarId(input: string) {
  const trimmed = input.trim();
  return trimmed.match(/[?&]user=([a-zA-Z0-9_-]+)/)?.[1] ?? (trimmed.match(/^[a-zA-Z0-9_-]{10,18}$/) ? trimmed : "");
}

function parseOrcidWorks(payload: Record<string, unknown>) {
  const groups = Array.isArray(payload.group) ? payload.group : [];
  return groups.flatMap((group) => {
    if (!group || typeof group !== "object") return [];
    const summaries = (group as Record<string, unknown>)["work-summary"];
    const summary = Array.isArray(summaries) ? summaries[0] : null;
    if (!summary || typeof summary !== "object") return [];
    const record = summary as Record<string, unknown>;
    const titleNode = record.title as Record<string, unknown> | undefined;
    const dateNode = record["publication-date"] as Record<string, unknown> | undefined;
    const externalIds = record["external-ids"] as Record<string, unknown> | undefined;
    const externalIdList = Array.isArray(externalIds?.["external-id"]) ? (externalIds?.["external-id"] as Record<string, unknown>[]) : [];
    const doi =
      externalIdList.find((item) => stringValue(item["external-id-type"]).toLowerCase() === "doi")?.["external-id-value"] ?? "";
    const publication = {
      title: stringValue((titleNode?.title as Record<string, unknown> | undefined)?.value),
      year: stringValue((dateNode?.year as Record<string, unknown> | undefined)?.value),
      venue: stringValue((record["journal-title"] as Record<string, unknown> | undefined)?.value),
      doi: stringValue(doi),
      authors: "",
      source: "orcid"
    };
    return publication.title ? [publication] : [];
  });
}

function parseScholarPublications(html: string) {
  const rows = html.match(/<tr class="gsc_a_tr">[\s\S]*?<\/tr>/g) ?? [];
  return rows.flatMap((row) => {
    const title = decodeHtml(row.match(/<a[^>]*class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    const grays = [...row.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)].map((match) => decodeHtml(match[1] ?? ""));
    const year = row.match(/<span[^>]*>(\d{4})<\/span>/)?.[1] ?? "";
    if (!title) return [];
    return [
      {
        title,
        authors: grays[0] ?? "",
        venue: grays[1] ?? "",
        year,
        source: "google_scholar"
      }
    ];
  });
}

function crossrefToPublication(message: Record<string, unknown>, doi: string) {
  const authorList = Array.isArray(message.author) ? message.author : [];
  const authors = authorList
    .map((author) => {
      if (!author || typeof author !== "object") return "";
      const item = author as Record<string, unknown>;
      return [stringValue(item.given), stringValue(item.family)].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  const issued = message.issued as Record<string, unknown> | undefined;
  const dateParts = Array.isArray(issued?.["date-parts"]) ? issued?.["date-parts"] : [];
  const firstDate = Array.isArray(dateParts[0]) ? dateParts[0] : [];
  const volume = stringValue(message.volume);
  const issue = stringValue(message.issue);
  const page = stringValue(message.page);
  const parts = [volume ? `Vol. ${volume}` : "", issue ? `Issue ${issue}` : "", page ? `pp. ${page}` : ""].filter(Boolean);

  return {
    title: Array.isArray(message.title) ? stringValue(message.title[0]) : stringValue(message.title),
    authors: authors.join(", "),
    year: stringValue(firstDate[0]),
    publication_type: crossrefType(stringValue(message.type)),
    venue: Array.isArray(message["container-title"]) ? stringValue(message["container-title"][0]) : "",
    volume_issue_pages: parts.join(", "),
    doi,
    url: `https://doi.org/${doi}`,
    status: "Published",
    source: "doi"
  };
}

function crossrefType(type: string) {
  if (/proceedings|conference/i.test(type)) return "Conference Paper";
  if (/book-chapter/i.test(type)) return "Book Chapter";
  if (/book/i.test(type)) return "Book";
  if (/posted-content|preprint/i.test(type)) return "Preprint";
  return "Journal Article";
}

function mergePublicationData(existing: PublicationData, incoming: PublicationData): PublicationData {
  return {
    title: existing.title || incoming.title,
    authors: existing.authors || incoming.authors,
    year: existing.year || incoming.year,
    publication_type: existing.publication_type || incoming.publication_type,
    venue: existing.venue || incoming.venue,
    volume_issue_pages: existing.volume_issue_pages || incoming.volume_issue_pages,
    doi: existing.doi || incoming.doi,
    url: existing.url || incoming.url,
    status: existing.status || incoming.status
  };
}

function cleanupNotes(raw: Record<string, string>, cleaned: PublicationData) {
  const notes = [];
  if (raw.title && raw.title !== cleaned.title) notes.push("Title formatting was cleaned.");
  if (raw.authors && raw.authors !== cleaned.authors) notes.push("Author formatting was cleaned.");
  if (raw.doi && raw.doi !== cleaned.doi) notes.push("DOI was normalized.");
  return notes;
}

function cleanTitle(value: string) {
  const text = normalizeScientificTitle(cleanText(value));
  if (!text) return "";
  return toScientificTitleCase(text);
}

function shouldKeepUppercase(token: string) {
  return /^(AI|ML|DNA|RNA|PCR|COVID|HIV|IoT|IEEE|ACM|STEM|NMR|XRD|SEM|TEM|UV|IR|LED|LCD)$/i.test(token);
}

function cleanAuthors(value: string) {
  return cleanText(value)
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\bet al\.?/gi, "et al.")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanYear(value: string) {
  return value.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
}

function cleanStatus(value: string) {
  const text = cleanText(value);
  if (!text) return "";
  if (/under review/i.test(text)) return "Under Review";
  if (/accepted/i.test(text)) return "Accepted";
  if (/press/i.test(text)) return "In Press";
  if (/submitted/i.test(text)) return "Submitted";
  if (/published/i.test(text)) return "Published";
  return text;
}

function normalizeDoi(value: string) {
  return cleanText(value)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[.,;]+$/g, "")
    .toLowerCase();
}

function cleanUrl(value: string) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (/^doi\.org\//i.test(text)) return `https://${text}`;
  return text;
}

function normalizeTitle(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toScientificTitleCase(value: string) {
  const tokens = value.split(/(\s+|[-:/()])/);
  const wordIndexes = tokens.flatMap((token, index) => (isWordToken(token) ? [index] : []));
  const lastWordIndex = wordIndexes[wordIndexes.length - 1] ?? -1;
  let capitalizeNext = true;

  return tokens
    .map((token, index) => {
      if (!isWordToken(token)) {
        if (token === ":" || token === "(" || token === "/") {
          capitalizeNext = true;
        }
        return token;
      }

      const lower = token.toLowerCase();
      const keepLower = stopWords.has(lower) && index !== wordIndexes[0] && index !== lastWordIndex && !capitalizeNext;
      capitalizeNext = false;

      if (shouldKeepUppercase(token)) return token.toUpperCase();
      if (hasScientificPattern(token)) return token;
      if (keepLower) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function hasScientificPattern(token: string) {
  return /\d/.test(token) || /[A-Z][a-z]?\d+[A-Za-z0-9]*/.test(token) || /^[a-z][A-Z]/.test(token);
}

function isWordToken(token: string) {
  return /[A-Za-z0-9]/.test(token);
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "nor",
  "of",
  "off",
  "on",
  "onto",
  "or",
  "over",
  "per",
  "so",
  "the",
  "to",
  "under",
  "up",
  "via",
  "with",
  "yet"
]);

function firstAuthor(value: string) {
  return cleanAuthors(value)
    .split(/,|;|\band\b/i)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim() ?? "";
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    let last = i;
    previous[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const old = previous[j + 1];
      previous[j + 1] = Math.min(previous[j + 1] + 1, previous[j] + 1, last + (a[i] === b[j] ? 0 : 1));
      last = old;
    }
  }
  return previous[b.length];
}

function decodeHtml(value: string) {
  return stringValue(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function firstDuplicateEntryId(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return "";
  const first = value[0];
  return first && typeof first === "object" && !Array.isArray(first) ? stringValue((first as Record<string, unknown>).entryId) : "";
}

function reviewCandidates(value: Prisma.JsonValue): PublicationCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    return [
      {
        entryId: stringValue(item.entryId),
        source: stringValue(item.source),
        matchType: stringValue(item.matchType),
        confidence: typeof item.confidence === "number" ? item.confidence : 0,
        reason: stringValue(item.reason),
        data: toPublicationData(item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, unknown> : {})
      }
    ];
  });
}

function sourceHistory(existing: string, incoming: string) {
  return Array.from(new Set([...existing.split("+"), incoming].map((item) => item.trim()).filter(Boolean))).join("+");
}

function warningForEntry(source: string, data: PublicationData) {
  if (!data.doi && source !== "manual") return "Imported without DOI";
  if (source.includes("+")) return "Merged sources";
  return "";
}
