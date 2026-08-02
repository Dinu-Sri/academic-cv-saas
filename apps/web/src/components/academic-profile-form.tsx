"use client";

import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  FileUp,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CvActiveTimeTracker } from "@/components/cv-active-time-tracker";
import { SvgCvPreview } from "@/components/svg-cv-preview";
import { PDF_DOWNLOAD_LOCKED_CODE } from "@/lib/billing/plans";
import { academicFieldGroups, academicFieldsByGroup, countryOptions } from "@/lib/academic-taxonomy";
import {
  bioFields,
  editorProfileSections,
  entrySummary,
  personalDetailFields,
  personalFields,
  profileSections,
  publicationFieldExamples,
  type ProfileFieldDefinition
} from "@/lib/profile-sections";

type SaveState = "idle" | "saving" | "saved" | "error";
type CompileState = "idle" | "compiling" | "ready" | "error";

type ProfilePayload = {
  id: string;
  displayName: string;
  headline: string;
  affiliation: string;
  location: string;
  countryCode: string;
  academicFieldGroup: string;
  academicField: string;
  email: string;
  websiteUrl: string;
  googleScholarUrl: string;
  orcidUrl: string;
  linkedinUrl: string;
  bio: string;
  researchSummary: string;
  completeness: number;
};

type EntryPayload = {
  id: string;
  sectionKey: string;
  entryOrder: number;
  data: Record<string, string>;
  isVisible: boolean;
};

type SectionPayload = {
  id: string;
  key: string;
  title: string;
  sectionOrder: number;
  isVisible: boolean;
  entries: EntryPayload[];
};

type MissingField = {
  sectionKey: string;
  entryId?: string;
  label: string;
};

type ImportReview = {
  sectionsFound: { key: string; title: string; count: number }[];
  newItems: number;
  skippedDuplicates: number;
  conflicts: { field: string; label: string; current: string; incoming: string }[];
  fillablePersonalFields: { field: string; label: string; incoming: string }[];
  unmappedCount: number;
  warnings: string[];
};

type ImportJob = {
  id: string;
  status: "queued" | "processing" | "ready" | "applied" | "failed";
  stage: string;
  message: string;
  sourceFilename: string;
  byteSize: number;
  review: ImportReview | null;
  error: string;
  mergeResult?: {
    addedEntries?: number;
    filledPersonalFields?: number;
    skippedDuplicates?: number;
    conflicts?: number;
    unmappedCount?: number;
  };
};

type ChatMessage = {
  id?: string;
  role: "assistant" | "user";
  content: string;
  patchSummary?: {
    applied?: number;
    needsConfirmation?: number;
    conflicts?: number;
    skipped?: number;
    messages?: string[];
  };
  createdAt?: string;
};

type PendingApproval = {
  proposalId?: string;
  patchLogIds: string[];
  label: string;
  message: string;
  changes?: {
    label: string;
    before: string;
    after: string;
  }[];
} | null;

type AgentEditorPayload = {
  profile: ProfilePayload & { updatedAt?: string };
  sections: (SectionPayload & {
    entries: (EntryPayload & { summary?: string; updatedAt?: string })[];
  })[];
};

export function AcademicProfileForm({
  profile,
  sections,
  previewHtml,
  documentId = "",
  pdfReady,
  pdfError,
  saved = false,
  canDownloadPdf = false,
  isGuest
}: {
  profile: ProfilePayload;
  sections: SectionPayload[];
  previewHtml: string;
  documentId?: string;
  pdfReady: boolean;
  pdfError: string;
  saved?: boolean;
  canDownloadPdf?: boolean;
  isGuest: boolean;
}) {
  const [activeKey, setActiveKey] = useState("personal");
  const [personal, setPersonal] = useState(profile);
  const [sectionState, setSectionState] = useState(sections);
  const [saveState, setSaveState] = useState<SaveState>(saved ? "saved" : "idle");
  const [compileState, setCompileState] = useState<CompileState>(previewHtml ? "ready" : "idle");
  const [downloadReady, setDownloadReady] = useState(pdfReady);
  const [downloadUnlocked, setDownloadUnlocked] = useState(canDownloadPdf);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewDocumentId, setPreviewDocumentId] = useState(documentId);
  const [renderError, setRenderError] = useState(pdfError);
  const [completeness, setCompleteness] = useState(profile.completeness);
  const [renderProgress, setRenderProgress] = useState(0);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const searchParams = useSearchParams();
  const openAiFromUrl = searchParams.get("ai") === "1";
  const websiteOnboarding = searchParams.get("website") === "1";
  const requestedWebsiteUsername = websiteOnboarding ? (searchParams.get("username") || "").trim() : "";
  const [chatMode, setChatMode] = useState(openAiFromUrl);
  const [chatInput, setChatInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<File[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatApproving, setChatApproving] = useState(false);
  const [chatDeclining, setChatDeclining] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatProgress, setChatProgress] = useState("");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => initialChatMessages());
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importError, setImportError] = useState("");
  const [importStarting, setImportStarting] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [fieldSaveState, setFieldSaveState] = useState<SaveState>("saved");
  const [draftVisibleKeys, setDraftVisibleKeys] = useState<string[]>(() =>
    sections.filter((section) => section.isVisible).map((section) => section.key)
  );
  const [dragSectionKey, setDragSectionKey] = useState("");
  const [dragTargetKey, setDragTargetKey] = useState("");
  const personalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersonalChanges = useRef<Partial<ProfilePayload>>({});
  const personalSavePromise = useRef<Promise<boolean> | null>(null);
  const entryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingEntryChanges = useRef<Record<string, { sectionKey: string; dataPatch: Record<string, string> }>>({});
  const entrySavePromises = useRef<Record<string, Promise<boolean>>>({});
  const pdfRequestVersionRef = useRef(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const websiteCreationStartedRef = useRef(false);
  const [websiteOnboardingState, setWebsiteOnboardingState] = useState<"waiting" | "creating" | "error">("waiting");
  const [websiteOnboardingError, setWebsiteOnboardingError] = useState("");

  const visibleSections = sectionState.filter((section) => section.isVisible);
  const visibleContentSections = visibleSections.filter((section) => section.key !== "bio");
  const activeSection = visibleSections.find((section) => section.key === activeKey);
  const activeDefinition = profileSections.find((section) => section.key === activeKey);
  const missingBySection = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of missing) {
      grouped.set(item.sectionKey, (grouped.get(item.sectionKey) ?? 0) + 1);
    }
    return grouped;
  }, [missing]);

  const createOnboardingWebsite = useCallback(async (details: ProfilePayload) => {
    if (
      !websiteOnboarding ||
      !requestedWebsiteUsername ||
      websiteCreationStartedRef.current ||
      !details.displayName.trim() ||
      !details.headline.trim() ||
      !details.bio.trim()
    ) {
      return;
    }

    websiteCreationStartedRef.current = true;
    setWebsiteOnboardingState("creating");
    setWebsiteOnboardingError("");
    try {
      const response = await fetch("/api/website", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: requestedWebsiteUsername })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not create your academic website.");
      window.location.replace("/website?created=1");
    } catch (creationError) {
      setWebsiteOnboardingState("error");
      setWebsiteOnboardingError(
        creationError instanceof Error ? creationError.message : "Could not create your academic website."
      );
    }
  }, [requestedWebsiteUsername, websiteOnboarding]);

  useEffect(() => {
    if (saveState === "saving" || saveState === "error") return;
    queueMicrotask(() => void createOnboardingWebsite(personal));
  }, [createOnboardingWebsite, personal, saveState]);

  function queuePersonalSave(updates: Partial<ProfilePayload>) {
    pendingPersonalChanges.current = { ...pendingPersonalChanges.current, ...updates };
    setSaveState("saving");

    if (personalTimer.current) {
      clearTimeout(personalTimer.current);
    }

    personalTimer.current = setTimeout(() => void flushPersonalSave(), 700);
  }

  async function savePersonalPatch(updates: Partial<ProfilePayload>) {
    setSaveState("saving");
    const response = await fetch("/api/profile/personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as { completeness?: number };
    setCompleteness((current) => result.completeness ?? current);
    return true;
  }

  async function flushPersonalSave(): Promise<boolean> {
    if (personalTimer.current) {
      clearTimeout(personalTimer.current);
      personalTimer.current = null;
    }

    if (personalSavePromise.current) {
      const priorSaveSucceeded = await personalSavePromise.current;
      if (!priorSaveSucceeded) return false;
    }

    const updates = pendingPersonalChanges.current;
    if (Object.keys(updates).length === 0) return true;
    pendingPersonalChanges.current = {};

    const request = savePersonalPatch(updates);
    personalSavePromise.current = request;
    const savedSuccessfully = await request;
    personalSavePromise.current = null;

    if (!savedSuccessfully) {
      pendingPersonalChanges.current = { ...updates, ...pendingPersonalChanges.current };
      setSaveState("error");
      return false;
    }

    if (Object.keys(pendingPersonalChanges.current).length > 0) {
      return flushPersonalSave();
    }

    setSaveState("saved");
    return true;
  }

  function updatePersonalFields(updates: Partial<ProfilePayload>) {
    setPersonal((current) => ({ ...current, ...updates }));
    const completedLabels = new Set(
      Object.entries(updates)
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([name]) => personalFieldLabel(name))
    );
    setMissing((current) => current.filter((item) => item.sectionKey !== "personal" || !completedLabels.has(item.label)));
    queuePersonalSave(updates);
  }

  function updatePersonal(name: string, value: string) {
    updatePersonalFields({ [name]: value });
  }

  function updateEntry(sectionKey: string, entryId: string, name: string, value: string) {
    setSectionState((current) => current.map((section) => {
      if (section.key !== sectionKey) return section;
      return {
        ...section,
        entries: section.entries.map((entry) =>
          entry.id === entryId ? { ...entry, data: { ...entry.data, [name]: value } } : entry
        )
      };
    }));
    if (value.trim()) {
      const definition = profileSections.find((item) => item.key === sectionKey);
      const label = definition?.fields.find((field) => field.name === name)?.label;
      setMissing((current) =>
        current.filter((item) => !(item.sectionKey === sectionKey && item.entryId === entryId && item.label === label))
      );
    }
    queueEntrySave(entryId, sectionKey, { [name]: value });
  }

  function queueEntrySave(entryId: string, sectionKey: string, dataPatch: Record<string, string>) {
    const pending = pendingEntryChanges.current[entryId];
    pendingEntryChanges.current[entryId] = {
      sectionKey,
      dataPatch: { ...(pending?.dataPatch ?? {}), ...dataPatch }
    };
    setSaveState("saving");

    if (entryTimers.current[entryId]) clearTimeout(entryTimers.current[entryId]);
    entryTimers.current[entryId] = setTimeout(() => void flushEntrySave(entryId), 700);
  }

  async function flushEntrySave(entryId: string): Promise<boolean> {
    if (entryTimers.current[entryId]) {
      clearTimeout(entryTimers.current[entryId]);
      delete entryTimers.current[entryId];
    }

    const inFlight = entrySavePromises.current[entryId];
    if (inFlight && !(await inFlight)) return false;

    const pending = pendingEntryChanges.current[entryId];
    if (!pending) return true;
    delete pendingEntryChanges.current[entryId];

    const request = (async () => {
      const response = await fetch(`/api/profile/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending)
      });
      if (!response.ok) return false;

      const result = (await response.json()) as { completeness?: number };
      setCompleteness((current) => result.completeness ?? current);
      return true;
    })();

    entrySavePromises.current[entryId] = request;
    const savedSuccessfully = await request;
    delete entrySavePromises.current[entryId];

    if (!savedSuccessfully) {
      const newer = pendingEntryChanges.current[entryId];
      pendingEntryChanges.current[entryId] = {
        sectionKey: newer?.sectionKey ?? pending.sectionKey,
        dataPatch: { ...pending.dataPatch, ...(newer?.dataPatch ?? {}) }
      };
      setSaveState("error");
      return false;
    }

    if (pendingEntryChanges.current[entryId]) return flushEntrySave(entryId);
    setSaveState("saved");
    return true;
  }

  async function flushAllEntrySaves() {
    const entryIds = new Set([
      ...Object.keys(pendingEntryChanges.current),
      ...Object.keys(entrySavePromises.current)
    ]);
    const results = await Promise.all([...entryIds].map((entryId) => flushEntrySave(entryId)));
    return results.every(Boolean);
  }

  async function addEntry(sectionKey: string) {
    setSaveState("saving");
    const response = await fetch(`/api/profile/sections/${sectionKey}/entries`, {
      method: "POST"
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const result = (await response.json()) as { entry: EntryPayload; completeness?: number };
    setSectionState((current) =>
      current.map((section) =>
        section.key === sectionKey ? { ...section, entries: [...section.entries, result.entry] } : section
      )
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
  }

  async function deleteEntry(sectionKey: string, entryId: string) {
    if (!(await flushEntrySave(entryId))) return;
    setSaveState("saving");
    const response = await fetch(`/api/profile/entries/${entryId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const result = (await response.json()) as { completeness?: number };
    setSectionState((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? { ...section, entries: section.entries.filter((entry) => entry.id !== entryId) }
          : section
      )
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
  }

  async function moveEntry(sectionKey: string, entryId: string, direction: -1 | 1) {
    const section = sectionState.find((candidate) => candidate.key === sectionKey);
    if (!section) return;

    const index = section.entries.findIndex((entry) => entry.id === entryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= section.entries.length) return;

    const entries = [...section.entries];
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);

    setSectionState((current) =>
      current.map((candidate) =>
        candidate.key === sectionKey
          ? { ...candidate, entries: entries.map((item, itemIndex) => ({ ...item, entryOrder: itemIndex + 1 })) }
          : candidate
      )
    );

    setSaveState("saving");
    const response = await fetch(`/api/profile/sections/${sectionKey}/entries/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: entries.map((item) => item.id) })
    });

    setSaveState(response.ok ? "saved" : "error");
  }

  async function compileCv() {
    const validation = collectMissing();
    setMissing(validation);

    if (validation.length > 0) {
      setActiveKey(validation[0].sectionKey);
      return;
    }

    if (!(await flushPersonalSave()) || !(await flushAllEntrySaves())) {
      setRenderError("Save your profile details before generating your CV.");
      return;
    }

    await startCvCompile();
  }

  async function startCvCompile() {
    setCompileState("compiling");
    setRenderProgress(0);
    setDownloadReady(false);
    setRenderError("");
    setPreviewVersion((current) => current + 1);
    const response = await fetch("/api/cv/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleSectionKeys: visibleSections.map((section) => section.key) })
    });

    if (!response.ok) {
      if (response.status === 422) {
        const result = (await response.json()) as { code?: string; error?: string; missingFields?: string[] };
        if (result.code === "ACADEMIC_IDENTITY_REQUIRED") {
          const fieldLabels = (result.missingFields ?? []).map((name) => personalFieldLabel(name));
          setMissing(fieldLabels.map((label) => ({ sectionKey: "personal", label })));
          setActiveKey("personal");
          setCompileState("idle");
          setRenderError(result.error ?? "Add your academic identity before generating your CV.");
          return;
        }
      }
      const { handleGuestLimitResponse } = await import("@/lib/guest-client");
      if (await handleGuestLimitResponse(response)) {
        setCompileState("idle");
        return;
      }
      setCompileState("error");
      setRenderError("Could not start the PDF renderer.");
      return;
    }

    const result = (await response.json()) as { documentId?: string; previewHtml: string; completeness?: number; jobId?: string; pdfReady?: boolean; pdfError?: string };
    setPreviewDocumentId(result.documentId ?? "");
    setDownloadReady(Boolean(result.pdfReady));
    setRenderError(result.pdfError ?? "");
    setCompleteness(result.completeness ?? completeness);
    setCompileState(result.jobId ? "compiling" : result.pdfReady ? "ready" : "error");
    setRenderProgress(result.jobId ? 8 : result.pdfReady ? 100 : 0);

    if (result.jobId) {
      pollRenderJob(result.jobId);
    }
  }

  async function openImportModal() {
    setImportOpen(true);
    setImportError("");
    if (!importJob) {
      await checkActiveImport();
    }
  }

  async function checkActiveImport() {
    const response = await fetch("/api/import/cv", { credentials: "include" });
    if (!response.ok) return;
    const result = (await response.json()) as { job?: ImportJob | null };
    if (result.job) {
      setImportJob(result.job);
      if (["queued", "processing"].includes(result.job.status)) {
        pollImportJob(result.job.id);
      }
    }
  }

  async function startImport() {
    if (!importFile) {
      setImportError("Choose your old CV PDF first.");
      return;
    }

    setImportStarting(true);
    setImportError("");
    setImportJob(null);

    const formData = new FormData();
    formData.append("file", importFile);
    const response = await fetch("/api/import/cv", {
      method: "POST",
      body: formData,
      credentials: "include"
    });
    const result = (await response.json()) as { error?: string; job?: ImportJob };
    setImportStarting(false);

    if (!response.ok || !result.job) {
      setImportError(result.error ?? "Could not start the import.");
      return;
    }

    setImportJob(result.job);
    setImportFile(null);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }

    if (["queued", "processing"].includes(result.job.status)) {
      pollImportJob(result.job.id);
    }
  }

  function pollImportJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      const response = await fetch(`/api/import/cv/${jobId}`, { credentials: "include" });

      if (!response.ok) {
        setImportError("Could not check the import status.");
        return;
      }

      const result = (await response.json()) as { job: ImportJob };
      setImportJob(result.job);

      if (["ready", "applied", "failed"].includes(result.job.status)) {
        return;
      }

      if (attempts < 180) {
        window.setTimeout(check, 1200);
        return;
      }

      setImportError("Import is taking longer than expected. You can close this and check again shortly.");
    };

    window.setTimeout(check, 900);
  }

  async function applyImport() {
    if (!importJob || importJob.status !== "ready") return;

    setImportApplying(true);
    setImportError("");
    const response = await fetch(`/api/import/cv/${importJob.id}/apply`, {
      method: "POST",
      credentials: "include"
    });
    const result = (await response.json()) as { error?: string; result?: ImportJob["mergeResult"] };
    setImportApplying(false);

    if (!response.ok) {
      setImportError(result.error ?? "Could not apply imported data.");
      return;
    }

    setImportJob({
      ...importJob,
      status: "applied",
      stage: "applied",
      message: "Imported data applied.",
      mergeResult: result.result
    });
    setSaveState("saved");
  }

  const applyAgentEditor = useCallback((editor: AgentEditorPayload) => {
    setPersonal({
      id: editor.profile.id,
      displayName: editor.profile.displayName,
      headline: editor.profile.headline,
      affiliation: editor.profile.affiliation,
      location: editor.profile.location,
      countryCode: editor.profile.countryCode,
      academicFieldGroup: editor.profile.academicFieldGroup,
      academicField: editor.profile.academicField,
      email: editor.profile.email,
      websiteUrl: editor.profile.websiteUrl,
      googleScholarUrl: editor.profile.googleScholarUrl,
      orcidUrl: editor.profile.orcidUrl,
      linkedinUrl: editor.profile.linkedinUrl,
      bio: editor.profile.bio,
      researchSummary: editor.profile.researchSummary,
      completeness: editor.profile.completeness
    });
    setSectionState(editor.sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      sectionOrder: section.sectionOrder,
      isVisible: section.isVisible,
      entries: section.entries.map((entry) => ({
        id: entry.id,
        sectionKey: entry.sectionKey,
        entryOrder: entry.entryOrder,
        data: entry.data,
        isVisible: entry.isVisible
      }))
    })));
    setCompleteness(editor.profile.completeness);
  }, []);

  const loadAgentSession = useCallback(async () => {
    setChatError("");
    const response = await fetch("/api/cv-agent/session", { credentials: "include" });
    const result = (await response.json()) as {
      error?: string;
      messages?: ChatMessage[];
      editor?: AgentEditorPayload;
      pendingApproval?: PendingApproval;
    };

    if (!response.ok) {
      setChatError(result.error ?? "Could not load Build with AI.");
      return;
    }

    if (result.editor) {
      applyAgentEditor(result.editor);
    }

    setChatMessages(result.messages && result.messages.length > 0 ? result.messages : initialChatMessages());
    setPendingApproval(result.pendingApproval ?? null);
    setChatLoaded(true);
  }, [applyAgentEditor]);

  function toggleChatMode() {
    const nextMode = !chatMode;
    // Shared path with sidebar CTA (event listener updates mode + URL).
    window.dispatchEvent(new CustomEvent("cvscholar-ai-mode", { detail: { open: nextMode } }));
  }

  // Keep AI mode in sync with URL and sidebar/header toggle events.
  useEffect(() => {
    queueMicrotask(() => {
      if (openAiFromUrl) {
        setChatMode(true);
        if (!chatLoaded) void loadAgentSession();
      }
    });
  }, [openAiFromUrl, chatLoaded, loadAgentSession]);

  useEffect(() => {
    function onAiModeEvent(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open !== "boolean") return;
      setChatMode(detail.open);
      if (detail.open && !chatLoaded) void loadAgentSession();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (detail.open) url.searchParams.set("ai", "1");
        else url.searchParams.delete("ai");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
    window.addEventListener("cvscholar-ai-mode", onAiModeEvent as EventListener);
    return () => window.removeEventListener("cvscholar-ai-mode", onAiModeEvent as EventListener);
  }, [chatLoaded, loadAgentSession]);

  async function sendChatMessage() {
    const text = chatInput.trim();
    if ((!text && chatAttachments.length === 0) || chatSending) return;

    setChatSending(true);
    setChatError("");
    const pendingAttachments = chatAttachments;
    setChatMessages((current) => [
      ...current,
      {
        role: "user",
        content: `${text || "I attached files for my CV."}${pendingAttachments.length > 0 ? `\n\nAttached: ${pendingAttachments.map((file) => file.name).join(", ")}` : ""}`
      }
    ]);
    setChatInput("");
    setChatAttachments([]);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = "";
    }

    try {
      const attachmentIds = pendingAttachments.length > 0 ? await uploadAgentAttachments(pendingAttachments) : [];
      const response = await fetch("/api/agent/runs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, attachmentIds })
      });
      const result = (await response.json()) as {
        error?: string;
        messages?: ChatMessage[];
        editor?: AgentEditorPayload;
        patchSummary?: ChatMessage["patchSummary"];
        pendingApproval?: PendingApproval;
        runId?: string;
        queued?: boolean;
      };

      if (!response.ok) {
        const { handleGuestLimitResponse } = await import("@/lib/guest-client");
        if (await handleGuestLimitResponse(response)) {
          return;
        }
        throw new Error(result.error ?? "Build with AI could not reply.");
      }

      if (result.editor) {
        applyAgentEditor(result.editor);
      }

      setChatMessages(result.messages && result.messages.length > 0 ? result.messages : initialChatMessages());
      setPendingApproval(result.pendingApproval ?? null);
      if (result.queued && result.runId) {
        await streamAgentRun(result.runId);
        return;
      }
      if ((result.patchSummary?.applied ?? 0) > 0) {
        void startCvCompile();
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Build with AI could not reply.";
      // Never show raw "Agent run timed out." — use calm capacity guidance instead.
      const friendly =
        /timed?\s*out|timeout|deadline|aborted|lost the run stream|could not finish this run|technical issue connecting to our AI/i.test(
          raw
        )
          ? "I’m having a temporary technical issue connecting to our AI reasoning service — this can happen when the models are under high demand or capacity limits. Please try again in a short while. If it keeps happening, open a support ticket and include a screenshot of this chat so we can investigate."
          : raw;
      setChatMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant" && last.content === friendly) return current;
        return [...current, { role: "assistant", content: friendly }];
      });
      setChatError("");
    } finally {
      setChatSending(false);
      setChatLoaded(true);
    }
  }

  async function streamAgentRun(runId: string) {
    await new Promise<void>((resolve) => {
      const source = new EventSource(`/api/agent/runs/${runId}/events`, { withCredentials: true });
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        source.close();
        setChatProgress("");
        await loadAgentSession();
        resolve();
      };

      source.addEventListener("graph_node", (event) => {
        const payload = parseAgentEvent(event);
        const nodeName =
          typeof payload?.payload === "object" && payload.payload && "nodeName" in payload.payload ? String(payload.payload.nodeName) : "";
        setChatProgress(nodeName ? `Working: ${nodeName.replace(/_/g, " ")}` : payload?.message ?? "Working through your CV...");
      });
      source.addEventListener("run_started", (event) => {
        const payload = parseAgentEvent(event);
        setChatProgress(payload?.message ?? "Agent run started.");
      });
      source.addEventListener("tool_started", (event) => {
        const payload = parseAgentEvent(event);
        setChatProgress(payload?.message ?? "Checking your CV details...");
      });
      source.addEventListener("approval_interrupt", () => {
        void finish();
      });
      source.addEventListener("final_response", () => {
        void finish();
      });
      source.addEventListener("run_failed", (event) => {
        const payload = parseAgentEvent(event);
        settled = true;
        source.close();
        setChatProgress("");
        const message =
          payload?.message ||
          "I’m having a temporary technical issue connecting to our AI reasoning service. Please try again in a short while. If it keeps happening, open a support ticket with a screenshot of this chat.";
        // Prefer a calm assistant bubble over a harsh red "timed out" line.
        setChatMessages((current) => [...current, { role: "assistant", content: message }]);
        void loadAgentSession()
          .then(() => resolve())
          .catch(() => resolve());
      });
      source.onerror = () => {
        if (settled) return;
        settled = true;
        source.close();
        setChatProgress("");
        const message =
          "I’m having a temporary technical issue connecting to our AI reasoning service. Please try again in a short while. If it keeps happening, open a support ticket with a screenshot of this chat.";
        setChatMessages((current) => [...current, { role: "assistant", content: message }]);
        void loadAgentSession()
          .then(() => resolve())
          .catch(() => resolve());
      };
    });
  }

  async function approveAgentUpdate() {
    if (!pendingApproval || chatApproving || chatDeclining) return;

    setChatApproving(true);
    setChatError("");
    const response = await fetch(pendingApproval.proposalId ? `/api/agent/proposals/${pendingApproval.proposalId}/approve` : "/api/cv-agent/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: pendingApproval.proposalId, patchLogIds: pendingApproval.patchLogIds })
    });
    const result = (await response.json()) as {
      error?: string;
      editor?: AgentEditorPayload;
      patchSummary?: ChatMessage["patchSummary"];
    };
    setChatApproving(false);

    if (!response.ok) {
      setChatError(result.error ?? "Could not apply the approved CV update.");
      return;
    }

    if (result.editor) {
      applyAgentEditor(result.editor);
    }

    setPendingApproval(null);
    setChatMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "Approved update applied to your CV.",
        patchSummary: result.patchSummary
      }
    ]);
    void startCvCompile();
  }

  async function declineAgentUpdate() {
    if (!pendingApproval || chatApproving || chatDeclining) return;

    setChatDeclining(true);
    setChatError("");
    const response = await fetch(pendingApproval.proposalId ? `/api/agent/proposals/${pendingApproval.proposalId}/decline` : "/api/cv-agent/decline", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: pendingApproval.proposalId, patchLogIds: pendingApproval.patchLogIds })
    });
    const result = (await response.json()) as {
      error?: string;
      pendingApproval?: PendingApproval;
    };
    setChatDeclining(false);

    if (!response.ok) {
      setChatError(result.error ?? "Could not decline the AI update.");
      return;
    }

    setPendingApproval(result.pendingApproval ?? null);
    setChatMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "No problem. I did not change your CV."
      }
    ]);
  }

  async function uploadAgentAttachments(files: File[]) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await fetch("/api/cv-agent/attachments", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    const result = (await response.json()) as { error?: string; attachments?: { id: string }[] };

    if (!response.ok) {
      throw new Error(result.error ?? "Could not upload attachment.");
    }

    return (result.attachments ?? []).map((attachment) => attachment.id);
  }

  function openFieldsModal() {
    setDraftVisibleKeys(sectionState.filter((section) => section.isVisible).map((section) => section.key));
    setFieldSaveState("saved");
    setFieldsOpen(true);
  }

  function toggleDraftSection(key: string) {
    const nextKeys = draftVisibleKeys.includes(key)
      ? draftVisibleKeys.filter((item) => item !== key)
      : [...draftVisibleKeys, key];
    setDraftVisibleKeys(nextKeys);
    void saveVisibleSections(nextKeys);
  }

  function reorderDraftSection(targetKey: string) {
    if (!dragSectionKey || dragSectionKey === targetKey) return;
    const nextKeys = reorderKeys(draftVisibleKeys, dragSectionKey, targetKey);
    setDraftVisibleKeys(nextKeys);
    void saveVisibleSections(nextKeys);
  }

  function reorderVisibleSection(targetKey: string) {
    if (!dragSectionKey || dragSectionKey === targetKey) return;
    const nextKeys = reorderKeys(visibleSections.map((section) => section.key), dragSectionKey, targetKey);
    setDraftVisibleKeys(nextKeys);
    void saveVisibleSections(nextKeys);
  }

  async function saveVisibleSections(activeKeys: string[]) {
    setSaveState("saving");
    setFieldSaveState("saving");
    const response = await fetch("/api/profile/sections/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeKeys })
    });

    if (!response.ok) {
      setSaveState("error");
      setFieldSaveState("error");
      return;
    }

    const result = (await response.json()) as { completeness?: number };
    const nextVisible = new Set(activeKeys);
    const orderIndex = new Map(activeKeys.map((key, index) => [key, index]));
    setSectionState((current) =>
      [...current]
        .map((section) => ({ ...section, isVisible: nextVisible.has(section.key) }))
        .sort((a, b) => {
          const aIndex = orderIndex.get(a.key);
          const bIndex = orderIndex.get(b.key);
          if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
          if (aIndex !== undefined) return -1;
          if (bIndex !== undefined) return 1;
          return a.sectionOrder - b.sectionOrder;
        })
        .map((section, index) => ({ ...section, sectionOrder: (index + 1) * 10 }))
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
    setFieldSaveState("saved");

    if (activeKey !== "personal" && !nextVisible.has(activeKey)) {
      setActiveKey(activeKeys[0] ?? "personal");
    }
  }

  function pollRenderJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      setRenderProgress((current) => Math.min(96, Math.max(current + 4, attempts * 4)));
      const response = await fetch(`/api/cv/jobs/${jobId}`);
      if (!response.ok) {
        setCompileState("error");
        setRenderError("Could not check PDF render status.");
        return;
      }

      const result = (await response.json()) as {
        status: string;
        message?: string;
        previewHtml?: string;
        pdfReady?: boolean;
        pdfError?: string;
      };

      if (result.pdfReady) {
        setRenderProgress(100);
        setDownloadReady(true);
        setRenderError("");
        setCompileState("ready");
        setPreviewVersion((current) => current + 1);
        return;
      }

      if (result.status === "failed") {
        setRenderProgress(0);
        setDownloadReady(false);
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setCompileState("error");
        return;
      }

      if (attempts < 90) {
        window.setTimeout(check, 1000);
        return;
      }

      setCompileState("error");
      setRenderError("PDF rendering is taking longer than expected. Please check again shortly.");
    };

    window.setTimeout(check, 700);
  }

  async function downloadPdf() {
    if (!downloadUnlocked) {
      setPaywallOpen(true);
      return;
    }

    pdfRequestVersionRef.current += 1;
    const response = await fetch(`/api/cv/download?v=${pdfRequestVersionRef.current}`, {
      credentials: "include"
    });

    if (!response.ok) {
      if (response.status === 402) {
        try {
          const body = await response.json();
          if (body.code === PDF_DOWNLOAD_LOCKED_CODE) {
            setDownloadUnlocked(false);
            setPaywallOpen(true);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setRenderError(response.status === 401 ? "Please login again before downloading the PDF." : "Could not download the generated PDF.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "academic-cv.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function collectMissing() {
    const nextMissing: MissingField[] = [];

    if (!personal.displayName.trim()) {
      nextMissing.push({ sectionKey: "personal", label: "Full Name" });
    }

    if (!isGuest) {
      if (!personal.countryCode.trim()) nextMissing.push({ sectionKey: "personal", label: "Country" });
      if (!personal.academicFieldGroup.trim()) nextMissing.push({ sectionKey: "personal", label: "Major Academic Field" });
      if (!personal.academicField.trim()) nextMissing.push({ sectionKey: "personal", label: "Specific Academic Field" });
    }

    for (const section of visibleContentSections) {
      const definition = profileSections.find((item) => item.key === section.key);
      const requiredFields = definition?.fields.filter((field) => "required" in field && field.required) ?? [];

      for (const entry of section.entries) {
        for (const field of requiredFields) {
          if (!entry.data[field.name]?.trim()) {
            nextMissing.push({ sectionKey: section.key, entryId: entry.id, label: field.label });
          }
        }
      }
    }

    return nextMissing;
  }

  const isGenerating = compileState === "compiling";
  const statusPercent = isGenerating ? renderProgress : completeness;
  const completionCoach = buildCompletionCoach(personal, visibleContentSections);

  return (
    <div className="profile-editor-shell">
      <CvActiveTimeTracker />
      <div className="profile-editor-main">
        {websiteOnboarding ? (
          <div className={`website-profile-onboarding is-${websiteOnboardingState}`} role="status">
            <div>
              <strong>
                {websiteOnboardingState === "creating"
                  ? "Generating your academic website..."
                  : `Complete your website basics for ${requestedWebsiteUsername || "your username"}`}
              </strong>
              <span>
                {websiteOnboardingState === "error"
                  ? websiteOnboardingError
                  : "Complete Personal details and Summary. Your website will be created automatically after those details save."}
              </span>
            </div>
            {websiteOnboardingState === "creating" ? <Loader2 size={18} className="spin" /> : null}
            {websiteOnboardingState === "error" ? <Link href="/website">Choose another username</Link> : null}
          </div>
        ) : null}
        <div className="editor-toolbar">
          <button className="secondary-action compact-action ai-chat-toggle" type="button" onClick={toggleChatMode}>
            {chatMode ? <SlidersHorizontal size={16} /> : <Sparkles size={16} />}
            {chatMode ? "Switch to Editor" : "Build with AI"}
          </button>
          <div className="editor-toolbar-actions">
            <button className="secondary-action compact-action import-cv-action" type="button" onClick={() => void openImportModal()}>
              <FileUp size={16} />
              Import Old CV
            </button>
            <button className="secondary-action compact-action" type="button" onClick={openFieldsModal} disabled={chatMode}>
              <SlidersHorizontal size={16} />
              Add CV fields
            </button>
            {downloadReady ? (
              <button className="secondary-action compact-action" type="button" onClick={() => void downloadPdf()}>
                {downloadUnlocked ? <Download size={16} /> : <Lock size={16} />}
                {downloadUnlocked ? "Download PDF" : "Unlock PDF"}
              </button>
            ) : null}
            <button className="primary-action generate-action" type="button" onClick={compileCv} disabled={compileState === "compiling"}>
              {compileState === "compiling" ? <Loader2 className="spin-icon" size={16} /> : <FileText size={16} />}
              {compileState === "compiling" ? "Generating" : "Generate My CV"}
            </button>
          </div>
        </div>

        {chatMode ? null : (
          <nav className="editor-tabs" aria-label="Profile sections">
            <span className="tab-drag-hint" aria-hidden="true" title="Drag tabs to reorder">
              <ArrowUpDown size={16} />
            </span>
            <button className={`editor-tab ${activeKey === "personal" ? "is-active" : ""} ${personal.displayName ? "is-complete" : ""}`} type="button" onClick={() => setActiveKey("personal")}>
              <span>Personal</span>
              {missingBySection.has("personal") ? <AlertCircle size={14} /> : personal.displayName ? <CheckCircle2 className="tab-check" size={15} strokeWidth={2.8} /> : null}
            </button>
            {visibleSections.map((section) => {
              const definition = editorProfileSections.find((item) => item.key === section.key);
              const hasEntries = section.key === "bio" ? Boolean(personal.bio.trim()) : section.entries.length > 0;
              const hasMissing = missingBySection.has(section.key);

              return (
                <button
                  className={`editor-tab is-draggable ${dragTargetKey === section.key ? "is-drop-target" : ""} ${activeKey === section.key ? "is-active" : ""} ${hasMissing ? "has-error" : ""} ${hasEntries ? "is-complete" : ""}`}
                  key={section.key}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDragSectionKey(section.key);
                    setDragTargetKey("");
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTargetKey(section.key);
                  }}
                  onDrop={() => {
                    reorderVisibleSection(section.key);
                    setDragTargetKey("");
                    setDragSectionKey("");
                  }}
                  onDragEnd={() => {
                    setDragSectionKey("");
                    setDragTargetKey("");
                  }}
                  onClick={() => setActiveKey(section.key)}
                >
                  <span>{definition?.shortTitle ?? section.title}</span>
                  {hasMissing ? <AlertCircle size={14} /> : hasEntries ? <CheckCircle2 className="tab-check" size={15} strokeWidth={2.8} /> : null}
                </button>
              );
            })}
          </nav>
        )}

        <section className={`editor-panel ${chatMode ? "chat-panel-wrap" : ""}`}>
          {chatMode ? (
            <AiChatBuilder
              messages={chatMessages}
              input={chatInput}
              attachments={chatAttachments}
              fileInputRef={chatFileInputRef}
              onInputChange={setChatInput}
              onAttachmentsChange={setChatAttachments}
              onSend={sendChatMessage}
              sending={chatSending}
              progress={chatProgress}
              approving={chatApproving}
              declining={chatDeclining}
              error={chatError}
              pendingApproval={pendingApproval}
              onApprove={approveAgentUpdate}
              onDecline={declineAgentUpdate}
            />
          ) : activeKey === "personal" ? (
            <PersonalEditor
              personal={personal}
              onChange={updatePersonal}
              onChangeMany={updatePersonalFields}
              missing={missing.filter((item) => item.sectionKey === "personal")}
              websiteOnboarding={websiteOnboarding}
              requireAcademicIdentity={!isGuest}
            />
          ) : activeKey === "bio" ? (
            <BioEditor personal={personal} onChange={updatePersonal} websiteOnboarding={websiteOnboarding} />
          ) : activeSection && activeDefinition ? (
            <SectionEditor
              definition={activeDefinition}
              section={activeSection}
              missing={missing}
              onAdd={() => void addEntry(activeSection.key)}
              onDelete={(entryId) => void deleteEntry(activeSection.key, entryId)}
              onMove={(entryId, direction) => void moveEntry(activeSection.key, entryId, direction)}
              onEntryChange={(entryId, name, value) => updateEntry(activeSection.key, entryId, name, value)}
            />
          ) : null}
        </section>
      </div>

      <aside className={`editor-status-card ${isGenerating ? "is-generating" : ""}`}>
        <div className="editor-status-header">
          <span className="section-label">{isGenerating ? "Making your LaTeX CV" : "CV Status"}</span>
          {!isGenerating ? (
            <button
              className="completion-coach-inline"
              type="button"
              title={completionCoach.message}
              onClick={() => setActiveKey(completionCoach.sectionKey)}
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>
                {completionCoach.shortLabel}
                {completionCoach.target > completeness ? ` to ${completionCoach.target}%` : ""}
              </span>
            </button>
          ) : null}
          <strong>{statusPercent}%</strong>
        </div>
        <div className="status-meter"><span style={{ width: `${statusPercent}%` }} /></div>
        {renderError ? <p className="render-error">{renderError}</p> : null}
        {missing.length > 0 ? (
          <button className="missing-jump" type="button" onClick={() => setActiveKey(missing[0].sectionKey)}>
            Fix {missing[0].label}
          </button>
        ) : null}
        <div className="cv-preview-frame">
          {downloadReady ? (
            <SvgCvPreview documentId={previewDocumentId || undefined} version={previewVersion} />
          ) : isGenerating ? (
            <div className="preview-empty preview-progress">
              <Loader2 className="spin-icon" size={34} />
              <span>We are making your LaTeX CV.</span>
              <small>The PDF will appear here automatically.</small>
            </div>
          ) : (
            <div className="preview-empty">
              <FileText size={34} />
              <span>Add your entries and click Generate My CV to see your CV.</span>
            </div>
          )}
        </div>
      </aside>

      {paywallOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPaywallOpen(false)}>
          <section
            className="billing-checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-pdf-paywall-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setPaywallOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="profile-pdf-paywall-title">Unlock PDF download</h2>
            <p className="billing-checkout-lead">
              Preview is free. Download the official PDF with PDF Pass ($5 / 30 days) or Scholar Annual.
            </p>
            <Link className="primary-action billing-pay-btn" href="/billing" onClick={() => setPaywallOpen(false)}>
              View plans
            </Link>
          </section>
        </div>
      ) : null}

      {importOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setImportOpen(false)}>
          <section
            className="cv-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv-import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="field-picker-head">
              <div>
                <span className="section-label">Old CV Import</span>
                <h2 id="cv-import-title">Import Old CV</h2>
                <small className="import-helper">Upload a PDF. We read it, map it into your CV fields, and ask before applying.</small>
              </div>
              <button className="modal-close-inline" type="button" aria-label="Close CV import" onClick={() => setImportOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {importJob?.status === "applied" ? (
              <div className="import-result">
                <CheckCircle2 size={28} />
                <h3>Imported data added</h3>
                <div className="import-summary-grid">
                  <ImportFact label="Entries added" value={importJob.mergeResult?.addedEntries ?? 0} />
                  <ImportFact label="Profile fields filled" value={importJob.mergeResult?.filledPersonalFields ?? 0} />
                  <ImportFact label="Duplicates skipped" value={importJob.mergeResult?.skippedDuplicates ?? 0} />
                  <ImportFact label="Conflicts unchanged" value={importJob.mergeResult?.conflicts ?? 0} />
                </div>
                <button className="primary-action" type="button" onClick={() => window.location.reload()}>
                  Back to Build CV
                </button>
              </div>
            ) : importJob?.status === "ready" && importJob.review ? (
              <div className="import-review">
                <div className="import-progress is-ready">
                  <CheckCircle2 size={18} />
                  <span>Ready to review</span>
                </div>
                <div className="import-summary-grid">
                  <ImportFact label="New items" value={importJob.review.newItems} />
                  <ImportFact label="Profile fields" value={importJob.review.fillablePersonalFields.length} />
                  <ImportFact label="Duplicates" value={importJob.review.skippedDuplicates} />
                  <ImportFact label="Conflicts" value={importJob.review.conflicts.length} />
                </div>

                {importJob.review.sectionsFound.length > 0 ? (
                  <div className="import-section-list">
                    {importJob.review.sectionsFound.map((section) => (
                      <span key={section.key}>{section.title}: {section.count}</span>
                    ))}
                  </div>
                ) : null}

                {importJob.review.conflicts.length > 0 ? (
                  <p className="import-note">Existing profile fields with different values will stay unchanged.</p>
                ) : null}
                {importJob.review.unmappedCount > 0 ? (
                  <p className="import-note">{importJob.review.unmappedCount} item(s) were left unmapped because no matching CV field was clear.</p>
                ) : null}
                {importError ? <p className="form-error">{importError}</p> : null}

                <button className="primary-action" type="button" onClick={() => void applyImport()} disabled={importApplying}>
                  {importApplying ? <Loader2 className="spin-icon" size={16} /> : <CheckCircle2 size={16} />}
                  {importApplying ? "Applying" : "Apply Imported Data"}
                </button>
              </div>
            ) : importJob && ["queued", "processing"].includes(importJob.status) ? (
              <div className="import-processing">
                <div className="import-progress">
                  <Loader2 className="spin-icon" size={22} />
                  <span>{importStageLabel(importJob.stage)}</span>
                </div>
                <div className="import-step-list">
                  {["Uploading CV", "Reading PDF", "Mapping fields", "Ready to review"].map((step, index) => (
                    <span className={index <= importStepIndex(importJob.stage) ? "is-done" : ""} key={step}>
                      {step}
                    </span>
                  ))}
                </div>
                <p className="import-note">You can close this window. The import will continue in the background.</p>
              </div>
            ) : importJob?.status === "failed" ? (
              <div className="import-result import-failed">
                <AlertCircle size={28} />
                <h3>Import could not finish</h3>
                <p>{importJob.error || importJob.message || "Please try another PDF."}</p>
                <button className="secondary-action" type="button" onClick={() => setImportJob(null)}>
                  Try another PDF
                </button>
              </div>
            ) : (
              <div className="import-upload">
                <label className="import-drop-zone">
                  <FileUp size={28} />
                  <strong>{importFile ? importFile.name : "Choose old CV PDF"}</strong>
                  <span>PDF only. Maximum {process.env.NEXT_PUBLIC_CV_IMPORT_MAX_UPLOAD_MB || "8"} MB.</span>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {importError ? <p className="form-error">{importError}</p> : null}
                <button className="primary-action" type="button" onClick={() => void startImport()} disabled={importStarting}>
                  {importStarting ? <Loader2 className="spin-icon" size={16} /> : <FileUp size={16} />}
                  {importStarting ? "Uploading" : "Start Import"}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {fieldsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setFieldsOpen(false)}>
          <section
            className="field-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="field-picker-head">
              <div>
                <span className="section-label">CV Fields</span>
                <h2 id="field-picker-title">Choose editor sections</h2>
                <small className={`field-save-note ${fieldSaveState}`}>{fieldSaveState === "saving" ? "Saving" : fieldSaveState === "error" ? "Could not save" : "Saved"}</small>
              </div>
              <button className="modal-close-inline" type="button" aria-label="Close field picker" onClick={() => setFieldsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <SectionPickerGroups
              activeKeys={draftVisibleKeys}
              counts={entryCountsBySection(sectionState, Boolean(personal.bio.trim()))}
              dropTargetKey={dragTargetKey}
              onToggle={toggleDraftSection}
              onDragStart={setDragSectionKey}
              onDragTarget={setDragTargetKey}
              onDrop={reorderDraftSection}
              onDragEnd={() => {
                setDragSectionKey("");
                setDragTargetKey("");
              }}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function buildCompletionCoach(personal: ProfilePayload, sections: SectionPayload[]) {
  const corePersonal = ["displayName", "headline", "affiliation", "email", "bio"] as const;
  const completedPersonal = corePersonal.filter((field) => personal[field].trim()).length;
  const sectionHasContent = (section: SectionPayload) =>
    section.entries.some((entry) => Object.values(entry.data).some((value) => value.trim()));
  const completedSections = sections.filter(sectionHasContent).length;
  const totalUnits = corePersonal.length + sections.length;
  const nextTarget = Math.min(100, Math.round(((completedPersonal + completedSections + 1) / Math.max(1, totalUnits)) * 100));

  const personalSteps: { field: (typeof corePersonal)[number]; shortLabel: string; message: string }[] = [
    { field: "displayName", shortLabel: "Add name", message: "Add your full name so every CV version has a clear academic identity." },
    { field: "headline", shortLabel: "Add title", message: "Add your academic title so readers understand your role immediately." },
    { field: "bio", shortLabel: "Add summary", message: "Write a short academic summary to introduce your CV and website." }
  ];
  const missingPersonal = personalSteps.find((step) => !personal[step.field].trim());
  if (missingPersonal) {
    return { sectionKey: missingPersonal.field === "bio" ? "bio" : "personal", target: nextTarget, shortLabel: missingPersonal.shortLabel, message: missingPersonal.message };
  }

  const strategicSections = [
    ["education", "Add education", "Add your education next; it is the strongest foundation for an academic CV."],
    ["experience", "Add a role", "Add your current or recent academic role to establish your career position."],
    ["publications", "Add publication", "Add a publication to show research output and strengthen your academic profile."],
    ["teaching", "Add teaching", "Add teaching experience to show your contribution beyond research."],
    ["awards", "Add award", "Add an award, scholarship, or recognition to strengthen academic credibility."]
  ] as const;
  for (const [sectionKey, shortLabel, message] of strategicSections) {
    const section = sections.find((item) => item.key === sectionKey);
    if (section && !sectionHasContent(section)) return { sectionKey, target: nextTarget, shortLabel, message };
  }

  const nextSection = sections.find((section) => !sectionHasContent(section));
  if (nextSection) {
    return {
      sectionKey: nextSection.key,
      target: nextTarget,
      shortLabel: `Add ${nextSection.title.toLowerCase()}`,
      message: `Add one strong ${nextSection.title.toLowerCase()} entry to keep building profile depth.`
    };
  }

  const remainingPersonal = corePersonal.find((field) => !personal[field].trim());
  if (remainingPersonal) {
    return { sectionKey: remainingPersonal === "bio" ? "bio" : "personal", target: nextTarget, shortLabel: "Add details", message: "Complete the remaining profile detail to finish your CV." };
  }

  return {
    sectionKey: "personal",
    target: 100,
    shortLabel: "Refine CV",
    message: "Your core CV is complete. Review wording, ordering, and publication quality before downloading."
  };
}

function ImportFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="import-fact">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionPickerGroups({
  activeKeys,
  counts,
  dropTargetKey,
  onToggle,
  onDragStart,
  onDragTarget,
  onDrop,
  onDragEnd
}: {
  activeKeys: string[];
  counts: Map<string, number>;
  dropTargetKey: string;
  onToggle: (key: string) => void;
  onDragStart: (key: string) => void;
  onDragTarget: (key: string) => void;
  onDrop: (key: string) => void;
  onDragEnd: () => void;
}) {
  const activeSet = new Set(activeKeys);
  const activeSections = activeKeys
    .map((key) => editorProfileSections.find((section) => section.key === key))
    .filter((section): section is (typeof editorProfileSections)[number] => Boolean(section));
  const inactiveSections = editorProfileSections.filter((section) => !activeSet.has(section.key));

  return (
    <div className="field-picker-groups">
      <section className="field-picker-group">
        <div className="field-picker-group-head">
          <strong>Core sections</strong>
          <small>Always included</small>
        </div>
        <div className="field-picker-grid field-picker-core-grid">
          <div className="field-choice is-selected is-fixed">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              <strong>Personal Details</strong>
              <em>Identity, contact, country, and academic field</em>
            </span>
          </div>
        </div>
      </section>
      <div className="field-picker-inline-hint">
        <ArrowUpDown size={16} />
        <span>Drag active sections to reorder</span>
      </div>
      <FieldPickerGroup
        title="Active sections"
        sections={activeSections}
        active
        counts={counts}
        dropTargetKey={dropTargetKey}
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragTarget={onDragTarget}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
      <FieldPickerGroup
        title="Available sections"
        sections={inactiveSections}
        counts={counts}
        dropTargetKey=""
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragTarget={onDragTarget}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
    </div>
  );
}

function FieldPickerGroup({
  title,
  sections,
  active = false,
  counts,
  dropTargetKey,
  onToggle,
  onDragStart,
  onDragTarget,
  onDrop,
  onDragEnd
}: {
  title: string;
  sections: readonly (typeof editorProfileSections)[number][];
  active?: boolean;
  counts: Map<string, number>;
  dropTargetKey: string;
  onToggle: (key: string) => void;
  onDragStart: (key: string) => void;
  onDragTarget: (key: string) => void;
  onDrop: (key: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <section className="field-picker-group">
      <div className="field-picker-group-head">
        <strong>{title}</strong>
        <small>{active ? "Drag to reorder" : "Click to activate"}</small>
      </div>
      <div className="field-picker-grid">
        {sections.map((section) => {
          const count = counts.get(section.key) ?? 0;
          return (
            <button
              className={`field-choice ${active ? "is-selected is-draggable" : ""} ${dropTargetKey === section.key ? "is-drop-target" : ""}`}
              key={section.key}
              type="button"
              draggable={active}
              onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                if (!active) return;
                onDragStart(section.key);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (active) {
                  event.preventDefault();
                  onDragTarget(section.key);
                }
              }}
              onDrop={() => {
                if (active) onDrop(section.key);
              }}
              onDragEnd={onDragEnd}
              onClick={() => onToggle(section.key)}
            >
              <span className="field-choice-toggle">
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
              </span>
              <span>
                <strong>{section.title}</strong>
                <em>{sectionHint(section.key)}</em>
                <small>{count ? `${count} entr${count === 1 ? "y" : "ies"} available` : "No entries yet"}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AiChatBuilder({
  messages,
  input,
  attachments,
  fileInputRef,
  onInputChange,
  onAttachmentsChange,
  onSend,
  sending,
  progress,
  approving,
  declining,
  error,
  pendingApproval,
  onApprove,
  onDecline
}: {
  messages: ChatMessage[];
  input: string;
  attachments: File[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onAttachmentsChange: (files: File[]) => void;
  onSend: () => void;
  sending: boolean;
  progress: string;
  approving: boolean;
  declining: boolean;
  error: string;
  pendingApproval: PendingApproval;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const streamRef = useRef<HTMLDivElement | null>(null);
  const showWelcome = messages.length <= 1 && messages.every((message) => message.role === "assistant" && !message.id);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages, sending, attachments]);

  return (
    <div className="ai-chat-builder">
      <div className="ai-chat-stream" ref={streamRef} aria-live="polite">
        {showWelcome ? (
          <div className="ai-chat-welcome">
            <Bot size={34} />
            <h2>Welcome to CVScholar</h2>
            <p>You can chat with me and I will help you fill the fields and finish your CV properly.</p>
          </div>
        ) : null}
        {messages.map((message, index) => (
          <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
            <p>{message.content}</p>
            {message.patchSummary?.messages?.length ? (
              <div className="ai-patch-summary">
                {message.patchSummary.messages.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
          </div>
        ))}
        {sending ? (
          <div className="ai-message assistant">
            <p className="ai-thinking"><Loader2 className="spin-icon" size={15} /> {progress || "Thinking through your CV..."}</p>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="ai-message user ai-attachment-message">
            <p>I attached {attachments.length} file{attachments.length === 1 ? "" : "s"} for my CV.</p>
            <div className="ai-attachment-list">
              {attachments.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error ai-chat-error">{error}</p> : null}
      {pendingApproval ? (
        <div className="ai-approval-card">
          <div className="ai-approval-head">
            <div>
              <strong>Review CV update</strong>
              <span>{pendingApproval.message}</span>
            </div>
            <button className="icon-button" type="button" aria-label="Decline CV update" onClick={onDecline} disabled={approving || declining}>
              {declining ? <Loader2 className="spin-icon" size={16} /> : <X size={16} />}
            </button>
          </div>
          {pendingApproval.changes?.length ? (
            <div className="ai-approval-changes">
              {pendingApproval.changes.map((change, index) => (
                <div className="ai-approval-change" key={`${change.label}-${index}`}>
                  <strong>{change.label}</strong>
                  <div>
                    <span>Current</span>
                    <p>{change.before}</p>
                  </div>
                  <div>
                    <span>New</span>
                    <p>{change.after}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="ai-approval-empty">Review this drafted change before applying it to your CV.</p>
          )}
          <div className="ai-approval-actions">
            <button className="secondary-action compact-action" type="button" onClick={onDecline} disabled={approving || declining}>
              {declining ? "Declining" : "Decline"}
            </button>
            <button className="primary-action compact-action" type="button" onClick={onApprove} disabled={approving || declining}>
              {approving ? <Loader2 className="spin-icon" size={16} /> : <CheckCircle2 size={16} />}
              {approving ? "Applying" : pendingApproval.label}
            </button>
          </div>
        </div>
      ) : null}

      <div className="ai-chat-composer">
        <button className="icon-button" type="button" aria-label="Attach images or PDFs" onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          onChange={(event) => onAttachmentsChange(Array.from(event.target.files ?? []))}
        />
        <textarea
          value={input}
          rows={1}
          placeholder="Message CVScholar..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button className="primary-action ai-send" type="button" aria-label="Send message" onClick={onSend} disabled={sending}>
          {sending ? <Loader2 className="spin-icon" size={17} /> : <ArrowUp size={18} />}
        </button>
      </div>
    </div>
  );
}

function initialChatMessages(): ChatMessage[] {
  return [
    {
      role: "assistant",
      content:
        "Welcome to CVScholar. Chat with me and I will help you complete your academic CV step by step. First, tell me your full name and current academic title."
    }
  ];
}

function parseAgentEvent(event: Event) {
  if (!("data" in event) || typeof event.data !== "string") return null;
  try {
    return JSON.parse(event.data) as {
      message?: string;
      payload?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
}

function importStepIndex(stage: string) {
  if (stage === "uploaded") return 0;
  if (stage === "reading_pdf") return 1;
  if (stage === "mapping_fields") return 2;
  if (stage === "ready_to_review") return 3;
  return 0;
}

function importStageLabel(stage: string) {
  if (stage === "reading_pdf") return "Reading your old CV";
  if (stage === "mapping_fields") return "Mapping CV fields";
  if (stage === "ready_to_review") return "Ready to review";
  return "Uploading CV";
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "";
}

function PersonalEditor({
  personal,
  onChange,
  onChangeMany,
  missing,
  websiteOnboarding,
  requireAcademicIdentity
}: {
  personal: ProfilePayload;
  onChange: (name: string, value: string) => void;
  onChangeMany: (updates: Partial<ProfilePayload>) => void;
  missing: MissingField[];
  websiteOnboarding: boolean;
  requireAcademicIdentity: boolean;
}) {
  const fieldSuggestions = academicFieldsByGroup[personal.academicFieldGroup] ?? [];
  const missingLabels = new Set(missing.map((item) => item.label));

  return (
    <div>
      <div className="section-topline">
        <div>
          <h2>Personal Details</h2>
          <p>Core details used by your CV and website.</p>
        </div>
      </div>
      <div className="entry-form-grid">
        {personalDetailFields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            value={String(personal[field.name as keyof ProfilePayload] ?? "")}
            invalid={missingLabels.has(field.label)}
            labelNote={websiteOnboarding && ["displayName", "headline"].includes(field.name) ? "used for academic website" : undefined}
            onChange={(value) => onChange(field.name, value)}
          />
        ))}
        <label>
          <span>Country {requireAcademicIdentity ? <b>*</b> : null}</span>
          <select className={missingLabels.has("Country") ? "is-invalid" : ""} name="countryCode" value={personal.countryCode} onChange={(event) => onChange("countryCode", event.target.value)}>
            <option value="">Select country</option>
            {countryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Major Academic Field {requireAcademicIdentity ? <b>*</b> : null}</span>
          <select
            className={missingLabels.has("Major Academic Field") ? "is-invalid" : ""}
            name="academicFieldGroup"
            value={personal.academicFieldGroup}
            onChange={(event) => onChangeMany({ academicFieldGroup: event.target.value, academicField: "" })}
          >
            <option value="">Select major field</option>
            {academicFieldGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </label>
        <label>
          <span>Specific Academic Field {requireAcademicIdentity ? <b>*</b> : null}</span>
          <span className="clearable-field">
            <input
              className={missingLabels.has("Specific Academic Field") ? "is-invalid" : ""}
              name="academicField"
              type="text"
              list="academic-field-options"
              value={personal.academicField}
              placeholder={personal.academicFieldGroup ? "Choose or type your own field" : "Select a major field first"}
              disabled={!personal.academicFieldGroup}
              onChange={(event) => onChange("academicField", event.target.value)}
            />
            {personal.academicField ? (
              <button type="button" title="Clear academic field" aria-label="Clear specific academic field" onClick={() => onChange("academicField", "")}>
                <X size={15} />
              </button>
            ) : null}
          </span>
          <datalist id="academic-field-options">
            {fieldSuggestions.map((field) => <option key={field} value={field} />)}
          </datalist>
        </label>
      </div>
    </div>
  );
}

function BioEditor({
  personal,
  onChange,
  websiteOnboarding
}: {
  personal: ProfilePayload;
  onChange: (name: string, value: string) => void;
  websiteOnboarding: boolean;
}) {
  const field = bioFields[0];
  const [editing, setEditing] = useState(Boolean(personal.bio.trim()));
  const hasBio = Boolean(personal.bio.trim());
  const summary = hasBio
    ? personal.bio.trim().split(/\s+/).slice(0, 12).join(" ") + (personal.bio.trim().split(/\s+/).length > 12 ? "..." : "")
    : "New summary";

  return (
    <div>
      <div className="section-topline">
        <div>
          <h2>Summary</h2>
          <p>A concise academic introduction used by your CV and website.</p>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setEditing(true)} disabled={editing || hasBio}>
          <Plus size={16} />
          Add summary
        </button>
      </div>
      <div className="entry-list">
        {!editing && !hasBio ? (
          <button className="empty-entry-button" type="button" onClick={() => setEditing(true)}>
            <Plus size={18} />
            Add summary
          </button>
        ) : null}
        {editing || hasBio ? (
          <details className="entry-card" open>
            <summary>
              <span className="entry-move">
                <button type="button" aria-label="Move up" disabled><ArrowUp size={14} /></button>
                <button type="button" aria-label="Move down" disabled><ArrowDown size={14} /></button>
              </span>
              <strong>{summary}</strong>
              <ChevronDown size={16} />
            </summary>
            <div className="entry-card-body">
              <div className="entry-form-grid bio-editor-grid">
                <FieldControl
                  field={field}
                  value={personal.bio}
                  labelNote={websiteOnboarding ? "used for academic website" : undefined}
                  onChange={(value) => onChange("bio", value)}
                />
              </div>
              <div className="entry-actions">
                <button
                  className="danger-action"
                  type="button"
                  onClick={() => {
                    onChange("bio", "");
                    setEditing(false);
                  }}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function personalFieldLabel(name: string) {
  if (name === "countryCode") return "Country";
  if (name === "academicFieldGroup") return "Major Academic Field";
  if (name === "academicField") return "Specific Academic Field";
  return personalFields.find((field) => field.name === name)?.label ?? name;
}

function SectionEditor({
  definition,
  section,
  missing,
  onAdd,
  onDelete,
  onMove,
  onEntryChange
}: {
  definition: (typeof profileSections)[number];
  section: SectionPayload;
  missing: MissingField[];
  onAdd: () => void;
  onDelete: (entryId: string) => void;
  onMove: (entryId: string, direction: -1 | 1) => void;
  onEntryChange: (entryId: string, name: string, value: string) => void;
}) {
  return (
    <div>
      <div className="section-topline">
        <div>
          <h2>{definition.title}</h2>
          <p>{definition.description}</p>
        </div>
        <button className="primary-action compact-action" type="button" onClick={onAdd}>
          <Plus size={16} />
          {definition.addLabel}
        </button>
      </div>

      <div className="entry-list">
        {section.entries.length === 0 ? (
          <button className="empty-entry-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            {definition.addLabel}
          </button>
        ) : null}
        {section.entries.map((entry, index) => {
          const entryMissing = missing.filter((item) => item.entryId === entry.id);
          return (
            <details className={`entry-card ${entryMissing.length ? "has-error" : ""}`} key={entry.id} open={index === section.entries.length - 1}>
              <summary>
                <span className="entry-move">
                  <button type="button" aria-label="Move up" onClick={(event) => { event.preventDefault(); onMove(entry.id, -1); }} disabled={index === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label="Move down" onClick={(event) => { event.preventDefault(); onMove(entry.id, 1); }} disabled={index === section.entries.length - 1}>
                    <ArrowDown size={14} />
                  </button>
                </span>
                <strong>{entrySummary(section.key, entry.data)}</strong>
                {entryMissing.length ? <span className="entry-error-pill">Needs info</span> : null}
                <ChevronDown size={16} />
              </summary>
              <div className="entry-card-body">
                <div className="entry-form-grid">
                  {definition.fields.map((field) => (
                    <FieldControl
                      key={field.name}
                      field={field}
                      sectionKey={section.key}
                      value={entry.data[field.name] ?? ""}
                      invalid={entryMissing.some((item) => item.label === field.label)}
                      onChange={(value) => onEntryChange(entry.id, field.name, value)}
                    />
                  ))}
                </div>
                <div className="entry-actions">
                  <button className="danger-action" type="button" onClick={() => onDelete(entry.id)}>
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function FieldControl({
  field,
  sectionKey,
  value,
  invalid,
  labelNote,
  onChange
}: {
  field: ProfileFieldDefinition;
  sectionKey?: string;
  value: string;
  invalid?: boolean;
  labelNote?: string;
  onChange: (value: string) => void;
}) {
  const placeholder = sectionKey === "publications" ? publicationFieldExamples[field.name] ?? field.placeholder ?? "" : field.placeholder ?? "";
  const shared = {
    name: field.name,
    value,
    placeholder,
    className: invalid ? "is-invalid" : field.required && value.trim() ? "is-complete-field" : "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value)
  };

  return (
    <label className={field.type === "textarea" ? "full" : ""}>
      <span>
        {field.label}{field.required ? <b>*</b> : null}
        {labelNote ? <small className="field-label-note">({labelNote})</small> : null}
      </span>
      {field.type === "textarea" ? (
        <textarea {...shared} rows={3} />
      ) : field.type === "select" ? (
        <select {...shared}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input {...shared} type={field.type} />
      )}
      {sectionKey === "publications" && placeholder ? <small className="field-example">Example: {placeholder}</small> : null}
    </label>
  );
}

function reorderKeys(keys: string[], sourceKey: string, targetKey: string) {
  const next = [...keys];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return keys;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function entryCountsBySection(sections: SectionPayload[], hasBio: boolean) {
  return new Map(sections.map((section) => [section.key, section.key === "bio" ? Number(hasBio) : section.entries.length]));
}

function sectionHint(key: string) {
  const hints: Record<string, string> = {
    bio: "Academic introduction used by your CV and website",
    education: "Degrees and academic training",
    languages: "Languages and proficiency",
    experience: "Employment and academic roles",
    teaching: "Courses and teaching work",
    awards: "Honors and recognitions",
    memberships: "Professional affiliations",
    grants: "Funding and fellowships",
    publications: "Papers and research outputs",
    references: "Referees or reference note",
    declaration: "Formal closing statement",
    research_interests: "Core research themes",
    academic_appointments: "Faculty and academic posts",
    research_experience: "Research roles and projects",
    projects: "Selected project work",
    conferences: "Talks and presentations",
    supervision: "Student mentoring work",
    patents: "Patents and applications",
    invited_talks: "Invited talks and seminars",
    academic_service: "Committees and service",
    editorial: "Editorial and reviewing work",
    certifications: "Certificates and credentials",
    skills: "Methods and technical skills"
  };
  return hints[key] ?? "CV section details";
}
